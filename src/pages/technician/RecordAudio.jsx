import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_URL } from "../../config";

const faultNamesByCode = {
  "01": "التوقف لضبط الالوان اكثر من مرة",
  "02": "التوقف لتغيير عدة كاوتشات لضبط الريجيستر",
  "03": "التوقف لصنفرة خبطات في السلندر",
  "04": "التوقف لمراجعة الالوان والبيانات والمقاسات مع الجودة",
  "05": "التوقف لتغيير الاكسات لضبط الريجيستر",
  "06": "تغير الطلبية / انتظار التجهيزات",
  "07": "التوقف للاعتماد مع العميل وضبط الالوان",
  "08": "التوقف لتغيير بكر الخامة لوجود ترخية او اي مشاكل اخري للخامة من تكسير او تقطيع",
  "09": "التوقف لاعطال الصيانة متنوعة",
  "10": "انقطاع التيار الكهربائي",
  "11": "اعطاء حرارة او انتظار والتوقف علي خامات",
  "12": "تغيير السكينة او اللامات"
};

// Faults that require quantity (cylinders or axles)
const faultsRequiringQuantity = {
  "03": "مع ذكر عدد السلندرات",
  "05": "مع ذكر عدد الاكسات",
  "06": "مع ذكر عدد السلندرات",
  "12": "مع ذكر عدد السلندرات"
};

function RecordAudio() {
  const [selectedShift, setSelectedShift] = useState('First Shift');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { token } = useAuth();
  const [achievementValues, setAchievementValues] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('0:00');
  const [isUploading, setIsUploading] = useState(false);
  const [audioUploaded, setAudioUploaded] = useState(false);
  const [savedRecordingId, setSavedRecordingId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showFaultCodesModal, setShowFaultCodesModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  // Fetch tasks when date or shift changes
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoadingTasks(true);
        const response = await fetch(
          `${API_URL}/api/technician/tasks?date=${date}&shift=${selectedShift}`,
          {
            headers: {
              'Authorization': token || ''
            }
          }
        );
        if (!response.ok) {
          console.error('Failed to fetch tasks');
          setTasks([]);
          return;
        }
        const data = await response.json();
        setTasks(Array.isArray(data) ? data : []);
        console.log('[DEBUG] Fetched tasks:', data);

        // 🔧 FIX: Populate achievementValues from saved achievements
        const savedAchievements = {};
        (data || []).forEach(task => {
          if (task.savedAchievement) {
            // Parse the saved achievement string (e.g., "1335 كيلو")
            const match = task.savedAchievement.match(/^(\d+\.?\d*)\s*(كيلو|طن)?/);
            if (match) {
              savedAchievements[task.TaskID] = {
                amount: match[1],
                unit: match[2] || 'كيلو',
                text: ''
              };
            }
          }
        });
        setAchievementValues(savedAchievements);
        console.log('[DEBUG] Loaded saved achievements:', savedAchievements);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    if (date && selectedShift) {
      fetchTasks();
    }
  }, [date, selectedShift, token]);


  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) { }
      clearInterval(timerRef.current);
    };
  }, []);

  // Reset shift to First if Third Shift is selected and date changes to Friday
  useEffect(() => {
    const dayOfWeek = new Date(date).getDay();
    const isFriday = dayOfWeek === 5;
    if (isFriday && selectedShift === 'Third Shift') {
      setSelectedShift('First Shift');
    }
  }, [date, selectedShift]);

  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [submissionMessage, setSubmissionMessage] = useState('');

  const stepper = [
    { label: "Date" },
    { label: "Shift" },
    { label: "Targets" },
    { label: "Record" },
  ];

  // Helper function to update achievement values (three parts)
  const updateAchievement = (taskId, field, value) => {
    setAchievementValues(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }));
  };

  // Helper function to get full achievement string
  const getAchievementString = (taskId) => {
    const ach = achievementValues[taskId];
    if (!ach) return '';
    const { amount = '', unit = 'كيلو', text = '' } = ach;
    return `${amount} ${unit} ${text}`.trim();
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <header className="space-y-3">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Daily Recording Portal</h1>
            <p className="text-gray-500 mt-1">Follow the steps below to submit your daily summary</p>
          </div>

          {/* Stepper Card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-wrap gap-4">
              {stepper.map((step, index) => {
                const isDone = index < stepIndex;
                const isActive = index === stepIndex;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center rounded-full ${isDone ? "bg-indigo-600 text-white" : isActive ? "bg-indigo-600 text-white" : "border-2 border-gray-200 text-gray-400"
                        }`}
                      style={{ width: "44px", height: "44px" }}
                    >
                      {isDone ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Step {index + 1}</p>
                      <p className={`font-semibold ${isActive ? "text-gray-900" : "text-gray-600"}`}>{step.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status Chips */}
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-full border border-gray-200">Date: {date}</span>
              <span className={`px-4 py-2 ${selectedShift ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-500'} text-sm rounded-full border border-indigo-100`}>Shift: {selectedShift}</span>
              <span className="px-4 py-2 bg-green-50 text-green-600 text-sm rounded-full border border-green-100">Targets: {Object.keys(achievementValues).length > 0 ? 'saved' : 'pending'}</span>
              <span className="px-4 py-2 bg-amber-50 text-amber-600 text-sm rounded-full border border-amber-100">Record: {isRecording ? 'Recording...' : (stepIndex >= 3 ? 'Done' : 'Awaiting recording')}</span>
            </div>
          </div>
        </header>

        {/* Form Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Date Card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="text-xs font-semibold text-gray-400 tracking-[0.4em]">DATE</div>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (stepIndex === 0) setStepIndex(1);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <span className="absolute inset-y-0 right-4 flex items-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Shifts Card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="text-xs font-semibold text-gray-400 tracking-[0.4em]">YOUR SHIFTS</div>
              {/* Show shift duration info based on selected day */}
              {(() => {
                const dayOfWeek = new Date(date).getDay();
                const isFriday = dayOfWeek === 5;
                return (
                  <p className="text-sm text-gray-500">
                    {isFriday ? '(Friday: 2 shifts × 12 hours each)' : '(3 shifts × 8 hours each)'}
                  </p>
                );
              })()}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setSelectedShift('First Shift');
                    if (stepIndex <= 1) setStepIndex(2);
                  }}
                  className={`px-6 py-3 rounded-full font-semibold shadow transition-colors ${selectedShift === 'First Shift' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                >
                  First Shift
                </button>
                <button
                  onClick={() => {
                    setSelectedShift('Second Shift');
                    if (stepIndex <= 1) setStepIndex(2);
                  }}
                  className={`px-6 py-3 rounded-full font-semibold shadow transition-colors ${selectedShift === 'Second Shift' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                >
                  Second Shift
                </button>
                {/* Show Third Shift only if NOT Friday */}
                {(() => {
                  const dayOfWeek = new Date(date).getDay();
                  const isFriday = dayOfWeek === 5;
                  if (isFriday) return null;
                  return (
                    <button
                      onClick={() => {
                        setSelectedShift('Third Shift');
                        if (stepIndex <= 1) setStepIndex(2);
                      }}
                      className={`px-6 py-3 rounded-full font-semibold shadow transition-colors ${selectedShift === 'Third Shift' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                    >
                      Third Shift
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Target Achievements Card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">Target Achievements</p>
                  <p className="text-sm text-gray-500 mt-0.5">Update the achievement values</p>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600">{tasks.length} total</span>
                  <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-600">{Object.keys(achievementValues).length === tasks.length ? '0' : tasks.length - Object.keys(achievementValues).length} pending</span>
                </div>
              </div>

              {loadingTasks ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500">Loading tasks...</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-500">No targets assigned for this shift</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task, index) => {
                    const ach = achievementValues[task.TaskID] || { amount: '', unit: 'كيلو', text: '' };
                    return (
                      <div key={task.TaskID || index} className="border border-gray-200 rounded-xl p-4 space-y-3">
                        {/* Target Description */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-1">TARGET</p>
                          <p className="text-base font-semibold text-gray-900" dir="auto">{task.TargetDescription}</p>
                        </div>

                        {/* Three-part Achievement Input */}
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2">ACHIEVEMENT</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            {/* Amount */}
                            <input
                              type="number"
                              placeholder="الكمية مثال: 500"
                              value={ach.amount}
                              onChange={(e) => updateAchievement(task.TaskID, 'amount', e.target.value)}
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />

                            {/* Unit */}
                            <select
                              value={ach.unit}
                              onChange={(e) => updateAchievement(task.TaskID, 'unit', e.target.value)}
                              className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                              <option value="طن">طن</option>
                              <option value="كيلو">كيلو</option>
                            </select>

                            {/* Text
                            <input
                              type="text"
                              placeholder="Description"
                              value={ach.text}
                              onChange={(e) => updateAchievement(task.TaskID, 'text', e.target.value)}
                              className="flex-[2] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              dir="auto"
                            /> */}

                            {/* Save Button */}
                            <button
                              onClick={async () => {
                                try {
                                  const achievementString = getAchievementString(task.TaskID);
                                  if (!achievementString) {
                                    alert('Please fill in all fields');
                                    return;
                                  }
                                  const res = await fetch(`${API_URL}/api/technician/targets/${task.TaskID}/achievement`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': token || '' },
                                    body: JSON.stringify({ achievement: achievementString })
                                  });
                                  if (!res.ok) throw new Error('Failed to save achievement');
                                  setStepIndex(3);
                                  alert('Achievement saved');
                                } catch (err) {
                                  console.error(err);
                                  alert(err.message || 'Save failed');
                                }
                              }}
                              className="px-4 py-2 rounded-lg bg-green-600 text-white whitespace-nowrap font-semibold hover:bg-green-700 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
                            Pending
                          </span>
                          {getAchievementString(task.TaskID) && (
                            <p className="text-xs text-gray-500" dir="auto">Preview: {getAchievementString(task.TaskID)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fault Codes Reference Card - Shows on mobile between Target Achievements and Record Excuse */}
            <div className="lg:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">نسيت الاكواد؟</p>
                  <p className="text-sm text-gray-500 mt-0.5">اضغط هنا لمراجعة أكواد الأعطال</p>
                </div>
                <button
                  onClick={() => setShowFaultCodesModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  عرض الأكواد
                </button>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Fault Codes Reference Card - Shows on desktop in right column */}
            <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">نسيت الاكواد؟</p>
                  <p className="text-sm text-gray-500 mt-0.5">اضغط هنا لمراجعة أكواد الأعطال</p>
                </div>
                <button
                  onClick={() => setShowFaultCodesModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  عرض الأكواد
                </button>
              </div>
            </div>

            {/* Optional Recording Card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">Optional: Record Excuse/Problem</p>
                  <p className="text-sm text-gray-500 mt-1">Record any issues, obstacles, or excuses...</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-500">Optional Step</span>
              </div>

              {/* Inner Recording Box */}
              <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 min-h-[320px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-base font-semibold text-gray-900">Optional Problem/Excuse Recording</p>
                    <p className="text-sm text-gray-500 mt-1">Challenges or problems (context)</p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-gray-500 border border-gray-200">Optional</span>
                </div>

                <div className="flex-grow flex flex-col justify-between">
                  {/* Timer */}
                  <div className="text-right">
                    <span className="text-3xl font-mono font-bold text-orange-500">{recordingTime}</span>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={async () => {
                      if (!isRecording) {
                        try {
                          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                          mediaRecorderRef.current = new MediaRecorder(stream);
                          chunksRef.current = [];
                          mediaRecorderRef.current.ondataavailable = (e) => {
                            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
                          };
                          mediaRecorderRef.current.onstop = async () => {
                            setIsUploading(true)

                            const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
                            const filename = `recording_${Date.now()}.webm`;
                            const file = new File([blob], filename, { type: blob.type });
                            const fd = new FormData();
                            fd.append('audio', file);
                            fd.append('shift', selectedShift);
                            fd.append('type', 'excuse');
                            fd.append('date', date);

                            // Debug: log what we're sending
                            console.log('[DEBUG] Uploading recording with:', {
                              shift: selectedShift,
                              type: 'excuse',
                              date: date,
                              audioFile: file.name
                            });

                            try {
                              const resp = await fetch(`${API_URL}/api/recordings`, {
                                method: 'POST',
                                headers: { 'Authorization': token || '' },
                                body: fd
                              });
                              if (!resp.ok) {
                                let errorMsg = 'Upload failed';
                                try {
                                  const errData = await resp.json();
                                  errorMsg = errData.error || errData.details || errorMsg;
                                } catch {
                                  const errText = await resp.text();
                                  errorMsg = errText || errorMsg;
                                }
                                alert('Upload failed: ' + errorMsg);
                              } else {
                                const j = await resp.json().catch(() => ({}));
                                setSavedRecordingId(j.recordingId);
                                setAudioUploaded(true);
                                setStepIndex(3);
                              }
                            } catch (uploadErr) {
                              console.error('Upload error', uploadErr);
                              alert('Upload error: ' + uploadErr.message);
                            } finally {
                              setIsUploading(false);
                            }
                          };
                          mediaRecorderRef.current.start();
                          secondsRef.current = 0;
                          setRecordingTime('0:00');
                          timerRef.current = setInterval(() => {
                            secondsRef.current += 1;
                            const s = secondsRef.current % 60;
                            const m = Math.floor(secondsRef.current / 60);
                            setRecordingTime(`${m}:${s.toString().padStart(2, '0')}`);
                          }, 1000);
                          setIsRecording(true);
                        } catch (err) {
                          console.error('Could not start recording', err);
                          alert('Could not start recording: ' + (err.message || err));
                        }
                      } else {
                        try {
                          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                            mediaRecorderRef.current.stop();
                          }
                        } catch (e) { console.warn(e); }
                        clearInterval(timerRef.current);
                        setIsRecording(false);
                      }
                    }}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl font-semibold py-4 text-lg shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'
                      }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    {isRecording ? 'Stop Recording' : 'Start'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Submit Button & Status */}
        <div className="space-y-4">
          {/* Status Message */}
          {submissionStatus && (
            <div className={`p-4 rounded-xl text-sm font-semibold ${submissionStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
              {submissionMessage}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={async () => {
                setIsSubmitting(true);
                setSubmissionStatus(null);
                setFinalizeResult(null);
                try {
                  // Step 1: Save all achievements
                  for (const taskId of Object.keys(achievementValues)) {
                    const achievementString = getAchievementString(taskId);
                    if (!achievementString) continue;

                    const achRes = await fetch(`${API_URL}/api/technician/targets/${taskId}/achievement`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                      },
                      body: JSON.stringify({ achievement: achievementString })
                    });
                    if (!achRes.ok) throw new Error('فشل في حفظ الإنجاز');
                  }

                  // Step 2: Create recording metadata if no audio was uploaded
                  if (!audioUploaded) {
                    const metaRes = await fetch(`${API_URL}/api/recordings/metadata`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                      },
                      body: JSON.stringify({ shift: selectedShift, type: 'excuse', date })
                    });
                    if (!metaRes.ok) {
                      const err = await metaRes.json().catch(() => ({}));
                      throw new Error(err.error || 'فشل في إنشاء التسجيل');
                    }
                  }

                  // Step 3: Trigger AI Rollover
                  setIsFinalizing(true);
                  const finalizeRes = await fetch(`${API_URL}/api/technician/finalize-shift`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': token || ''
                    },
                    body: JSON.stringify({ date, shift: selectedShift })
                  });
                  const finalizeData = await finalizeRes.json();

                  if (!finalizeRes.ok) {
                    throw new Error(finalizeData.error || 'فشل في تأكيد الوردية');
                  }

                  setFinalizeResult({ success: true });
                  setSubmissionStatus('success');
                } catch (err) {
                  console.error('Submission error:', err);
                  setFinalizeResult({ success: false, error: err.message });
                  setSubmissionStatus('error');
                  setSubmissionMessage(err.message || 'فشل في الحفظ');
                } finally {
                  setIsSubmitting(false);
                  setIsFinalizing(false);
                }
              }}
              disabled={isSubmitting || isUploading || isFinalizing}
              className={`px-8 py-3 font-semibold rounded-xl transition-colors ${isSubmitting || isUploading || isFinalizing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
              {isUploading ? 'جاري الرفع...' : (isSubmitting ? 'جاري الحفظ...' : (isFinalizing ? 'جاري التحليل...' : 'تأكيد الوردية ✓'))}
            </button>
          </div>

          {/* Simple Success/Error Message */}
          {finalizeResult && (
            <div className={`p-3 rounded-xl text-sm text-center ${finalizeResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {finalizeResult.success ? '✅ تم التأكيد بنجاح' : `❌ ${finalizeResult.error}`}
            </div>
          )}
        </div>
      </div>

      {/* Fault Codes Modal */}
      {showFaultCodesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFaultCodesModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-indigo-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">أكواد الأعطال</h2>
              </div>
              <button
                onClick={() => setShowFaultCodesModal(false)}
                className="p-2 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="grid gap-3">
                {Object.entries(faultNamesByCode).sort((a, b) => a[0].localeCompare(b[0])).map(([code, name]) => (
                  <div key={code} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex-shrink-0 w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
                      {code}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-gray-900 font-semibold text-sm leading-relaxed" dir="rtl">{name}</p>
                      {faultsRequiringQuantity[code] && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-amber-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="text-xs font-bold text-amber-700" dir="rtl">{faultsRequiringQuantity[code]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowFaultCodesModal(false)}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecordAudio;