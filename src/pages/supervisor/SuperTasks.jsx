import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_URL } from "../../config";

function SuperTasks() {
  const { token } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetAmount, setTargetAmount] = useState('');
  const [targetUnit, setTargetUnit] = useState('كيلو');
  const [targetText, setTargetText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [submissionMessage, setSubmissionMessage] = useState('');

  const handleSubmit = async () => {
    if (!targetAmount.trim() || !targetText.trim()) {
      setSubmissionStatus('error');
      setSubmissionMessage('Please enter both amount and description');
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus(null);

    try {
      // Combine the three parts into target description
      const fullTarget = `${targetAmount} ${targetUnit} ${targetText}`;
      
      const response = await fetch(`${API_URL}/api/supervisor/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || ''
        },
        body: JSON.stringify({
          date,
          target: fullTarget
        })
      });

      if (!response.ok) throw new Error('Failed to assign task');

      setSubmissionStatus('success');
      setSubmissionMessage('✓ Target assigned successfully for all shifts!');
      
      // Clear form
      setTargetAmount('');
      setTargetUnit('كيلو');
      setTargetText('');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSubmissionStatus(null);
        setSubmissionMessage('');
      }, 3000);

    } catch (err) {
      console.error('Submission error:', err);
      setSubmissionStatus('error');
      setSubmissionMessage(err.message || 'Failed to assign target');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <header className="space-y-3">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Assign Daily Target</h1>
            <p className="text-gray-500 mt-1">Set production targets for all shifts</p>
          </div>
        </header>

        {/* Main Form */}
        <section className="space-y-6">
          {/* Date Card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="text-xs font-semibold text-gray-400 tracking-[0.4em]">DATE</div>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="absolute inset-y-0 right-4 flex items-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
            </div>
          </div>

          {/* Target Input Card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">Target Description</p>
                <p className="text-sm text-gray-500 mt-0.5">This target will apply to all shifts (First, Second, Third)</p>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 space-y-4">
              {/* Three-part input */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Amount Input */}
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-2">AMOUNT</label>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="مثال: 500"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    dir="auto"
                  />
                </div>

                {/* Unit Selector */}
                <div className="sm:w-32">
                  <label className="block text-xs font-semibold text-gray-500 mb-2">UNIT</label>
                  <select
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="طن">طن</option>
                    <option value="كيلو">كيلو</option>
                  </select>
                </div>

                {/* Text Description */}
                <div className="flex-[2]">
                  <label className="block text-xs font-semibold text-gray-500 mb-2">DESCRIPTION</label>
                  <input
                    type="text"
                    value={targetText}
                    onChange={(e) => setTargetText(e.target.value)}
                    placeholder="مثال: جيهنة 105 جرام"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    dir="auto"
                  />
                </div>
              </div>

              {/* Preview */}
              {(targetAmount || targetText) && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-400 mb-2">PREVIEW</p>
                  <p className="text-lg font-semibold text-gray-900" dir="auto">
                    {targetAmount} {targetUnit} {targetText}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Submit Button & Status */}
        <div className="space-y-4">
          {/* Status Message */}
          {submissionStatus && (
            <div className={`p-4 rounded-xl text-sm font-semibold ${
              submissionStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {submissionMessage}
            </div>
          )}
          
          <div className="flex justify-end">
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`px-8 py-3 font-semibold rounded-xl transition-colors ${
                isSubmitting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Assign Target'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuperTasks;