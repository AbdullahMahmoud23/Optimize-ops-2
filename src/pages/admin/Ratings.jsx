import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_URL } from "../../config";

function AdminRatings() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('performance'); // performance, name, recordings

  // Modal state for shift details
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [shiftDetails, setShiftDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Audio player state
  const [recordings, setRecordings] = useState([]);
  const [selectedShiftForAudio, setSelectedShiftForAudio] = useState(null);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/admin/technicians/performance`, {
          headers: {
            'Authorization': token || ''
          }
        });
        if (!response.ok) throw new Error('Failed to fetch performance data');
        const data = await response.json();
        setTechnicians(Array.isArray(data) ? data : []);
        console.log('[DEBUG] Fetched technicians:', data);
      } catch (err) {
        console.error('Error fetching performance:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchPerformanceData();
    }
  }, [token]);

  // Fetch shift details for a specific technician
  const fetchShiftDetails = async (tech) => {
    try {
      setLoadingDetails(true);
      setSelectedTechnician(tech);
      setShowModal(true);

      const response = await fetch(`${API_URL}/api/admin/technicians/${tech.id}/shifts`, {
        headers: {
          'Authorization': token || ''
        }
      });

      if (!response.ok) throw new Error('Failed to fetch shift details');
      const data = await response.json();
      setShiftDetails(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching shift details:', err);
      setShiftDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTechnician(null);
    setShiftDetails([]);
    setRecordings([]);
    setSelectedShiftForAudio(null);
    setCurrentAudio(null);
  };

  // Fetch recordings for a specific shift
  const fetchRecordingsForShift = async (tech, shift) => {
    try {
      setLoadingRecordings(true);
      setSelectedShiftForAudio(shift);
      setRecordings([]);

      // Format date to YYYY-MM-DD in LOCAL timezone (not UTC)
      let dateStr = shift.date;
      if (shift.date) {
        // Convert to Date object and get local date
        const dateObj = new Date(shift.date);
        // Get year, month, day in local timezone
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }

      console.log('[DEBUG] Fetching recordings - operatorId:', tech.id, 'date:', dateStr, 'originalDate:', shift.date, 'shift:', shift.shift);

      const response = await fetch(
        `${API_URL}/api/admin/technicians/${tech.id}/recordings?date=${dateStr}&shift=${shift.shift}`,
        {
          headers: {
            'Authorization': token || ''
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch recordings');
      const data = await response.json();
      setRecordings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching recordings:', err);
      setRecordings([]);
    } finally {
      setLoadingRecordings(false);
    }
  };

  // Play/Pause audio
  const toggleAudio = async (recordingId) => {
    try {
      // If same audio is playing, pause it
      if (currentAudio === recordingId && isPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        return;
      }

      // If different audio or not playing, stop current and play new
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setCurrentAudio(recordingId);
      setIsPlaying(true);
      const audioUrl = `${API_URL}/api/admin/recordings/${recordingId}/audio`;

      // Fetch audio with Authorization header
      const response = await fetch(audioUrl, {
        headers: {
          'Authorization': token || ''
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to load audio');
      }

      // Get the audio blob
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create audio element and play
      const audio = new Audio(blobUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(blobUrl);
        setCurrentAudio(null);
        setIsPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        setCurrentAudio(null);
        setIsPlaying(false);
        audioRef.current = null;
        alert('Error playing audio file');
      };
      await audio.play();
    } catch (err) {
      console.error('Error playing audio:', err);
      alert('Audio file not found: ' + err.message);
      setCurrentAudio(null);
      setIsPlaying(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'Good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Average': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Needs Improvement': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressBarColor = (level) => {
    if (level >= 80) return 'bg-green-500';
    if (level >= 60) return 'bg-blue-500';
    if (level >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Sort technicians based on selected sort
  const sortedTechnicians = [...technicians].sort((a, b) => {
    if (sortBy === 'performance') {
      return b.performanceLevel - a.performanceLevel;
    } else if (sortBy === 'name') {
      return a.email.localeCompare(b.email);
    } else if (sortBy === 'recordings') {
      return b.totalRecordings - a.totalRecordings;
    }
    return 0;
  });

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 px-4 py-6 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Blurs */}
      <div className="hidden md:block absolute -top-40 -right-40 w-[400px] h-[400px] bg-blue-300/10 blur-[100px] rounded-full" />
      <div className="hidden md:block absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-black/10 blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-gradient-to-r from-blue-700 to-black bg-clip-text">
            Performance Analysis
          </h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">
            Track and compare technician performance metrics across targets and recordings
          </p>
        </div>

        {/* Main Performance Chart */}
        <div className="bg-white shadow-2xl border border-gray-200 rounded-2xl p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0H5a2 2 0 01-2-2v-6a2 2 0 012-2h2M19 19h-2a2 2 0 01-2-2v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2z" />
              </svg>
              Technician Performance Ratings
            </h2>

            {/* Sort Options */}
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('performance')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${sortBy === 'performance'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Performance
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${sortBy === 'name'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Name
              </button>
              <button
                onClick={() => setSortBy('recordings')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${sortBy === 'recordings'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Recordings
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
              </div>
              <p className="text-gray-500 mt-4">Loading performance data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-600 font-semibold text-lg">⚠️ Error: {error}</p>
            </div>
          ) : technicians.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">No technician data available yet</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Total Technicians</p>
                      <p className="text-4xl font-bold text-blue-700 mt-2">{technicians.length}</p>
                    </div>
                    <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Average Performance</p>
                      <p className="text-4xl font-bold text-green-700 mt-2">
                        {technicians.length > 0
                          ? (technicians.reduce((sum, t) => sum + t.overallScore, 0) / technicians.length).toFixed(2)
                          : '0.00'}%
                      </p>
                    </div>
                    <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-6 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Total Recordings</p>
                      <p className="text-4xl font-bold text-purple-700 mt-2">
                        {technicians.reduce((sum, t) => sum + t.totalRecordings, 0)}
                      </p>
                    </div>
                    <div className="w-16 h-16 bg-purple-200 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Technician</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Performance</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {sortedTechnicians.map((tech, index) => (
                      <tr key={tech.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <span className="text-lg font-bold text-gray-900">#{index + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900">{tech.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 w-48">
                              <div className="w-full bg-gray-300 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all ${getProgressBarColor(tech.overallScore)}`}
                                  style={{ width: `${tech.overallScore}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-bold text-gray-900 w-12 text-right">{tech.overallScore}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(tech.status)}`}>
                            {tech.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => fetchShiftDetails(tech)}
                            className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Performance Level Legend */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                <p className="text-sm font-semibold text-gray-800 mb-4">📊 Performance Levels</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-700">Excellent (80-100%)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-gray-700">Good (60-79%)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-gray-700">Average (40-59%)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-sm text-gray-700">Needs Help (&lt;40%)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shift Details Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">📊 Shift Details</h3>
                {selectedTechnician && (
                  <p className="text-blue-100 text-sm mt-1">{selectedTechnician.email}</p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : shiftDetails.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No shift data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shiftDetails.map((shift, index) => (
                    <div
                      key={index}
                      className={`border rounded-xl p-4 ${shift.overallScore >= 80 ? 'border-green-200 bg-green-50' :
                        shift.overallScore >= 60 ? 'border-blue-200 bg-blue-50' :
                          shift.overallScore >= 40 ? 'border-yellow-200 bg-yellow-50' :
                            'border-red-200 bg-red-50'
                        }`}
                    >
                      <div className="flex flex-wrap justify-between items-start gap-4">
                        {/* Date and Shift */}
                        <div>
                          <p className="text-lg font-bold text-gray-800">
                            📅 {new Date(shift.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">🕐 {shift.shift}</p>
                        </div>

                        {/* Score */}
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${shift.overallScore >= 80 ? 'text-green-600' :
                            shift.overallScore >= 60 ? 'text-blue-600' :
                              shift.overallScore >= 40 ? 'text-yellow-600' :
                                'text-red-600'
                            }`}>
                            {shift.overallScore}%
                          </div>
                          <p className={`text-sm font-semibold ${shift.overallScore >= 80 ? 'text-green-700' :
                            shift.overallScore >= 60 ? 'text-blue-700' :
                              shift.overallScore >= 40 ? 'text-yellow-700' :
                                'text-red-700'
                            }`}>
                            {shift.status}
                          </p>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500">Achievement</p>
                          <p className="text-lg font-bold text-gray-800">{Number(shift.achievementPercentage || 0).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Delay</p>
                          <p className="text-lg font-bold text-orange-600">{(shift.delayTime / 60).toFixed(2)} hrs</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Effective Time</p>
                          <p className="text-lg font-bold text-gray-800">{(shift.effectiveWorkingTime / 60).toFixed(2)} hrs</p>
                        </div>
                      </div>

                      {shift.message && (
                        <p className="text-sm text-gray-600 mt-3 italic">💡 {shift.message}</p>
                      )}

                      {/* Audio Player Button */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => fetchRecordingsForShift(selectedTechnician, shift)}
                          className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          🎧 Listen to Recordings
                        </button>

                        {/* Show recordings for this shift */}
                        {selectedShiftForAudio && selectedShiftForAudio.date === shift.date && selectedShiftForAudio.shift === shift.shift && (
                          <div className="mt-3 bg-gray-50 rounded-lg p-3">
                            {loadingRecordings ? (
                              <div className="flex items-center gap-2 text-gray-500">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                <span>Loading recordings...</span>
                              </div>
                            ) : recordings.length === 0 ? (
                              <p className="text-gray-500 text-sm">No recordings for this shift</p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-gray-700">📁 {recordings.length} Recording(s)</p>
                                {recordings.map((rec) => (
                                  <div key={rec.RecordingID} className="flex items-center justify-between bg-white rounded-lg p-2 border">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">
                                        🎤 Recording #{rec.RecordingID}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {rec.Type || 'Unknown'} - {new Date(rec.CreatedAt).toLocaleTimeString('en-US')}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => toggleAudio(rec.RecordingID)}
                                      className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all flex items-center gap-1 ${
                                        currentAudio === rec.RecordingID && isPlaying
                                          ? 'bg-green-500 text-white'
                                          : currentAudio === rec.RecordingID && !isPlaying
                                          ? 'bg-yellow-500 text-white'
                                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                      }`}
                                    >
                                      {currentAudio === rec.RecordingID && isPlaying 
                                        ? '⏸️ Pause' 
                                        : currentAudio === rec.RecordingID && !isPlaying
                                        ? '▶️ Resume'
                                        : '▶️ Play'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminRatings;