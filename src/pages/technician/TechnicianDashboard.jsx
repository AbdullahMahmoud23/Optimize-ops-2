import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_URL } from "../../config";

function TechnicianDashboard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [selectedShift, setSelectedShift] = useState('First Shift');
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  // Fetch tasks when shift changes
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoadingTasks(true);
        const response = await fetch(
          `${API_URL}/api/technician/tasks?date=${today}&shift=${selectedShift}`,
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
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    if (selectedShift) {
      fetchTasks();
    }
  }, [selectedShift, token, today]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 px-4 py-6 sm:px-6 lg:px-8 overflow-hidden overflow-x-hidden">
      <div className="hidden md:block absolute -top-40 -right-40 w-[400px] h-[400px] bg-purple-300/10 blur-[100px] rounded-full" />
      <div className="hidden md:block absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-purple-400/10 blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text">
            Technician Dashboard
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
            Track your assignments and work progress
          </p>
        </div>

        {/* My Assignments - Full Width */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-purple-50 via-white to-purple-100/50 border border-purple-200/50 shadow-lg transition-all duration-300 rounded-xl p-5 card-lift hover:shadow-purple-300/30 hover-glow-purple">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-200 to-purple-300 flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 float-soft">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-6 h-6 sm:w-8 sm:h-8 text-purple-700"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm sm:text-base font-medium text-gray-600">
                    My Assignments
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-purple-700">
                    {loadingTasks ? (
                      <span className="loading loading-spinner loading-md"></span>
                    ) : (
                      <>
                        {tasks.length} <span className="text-lg font-medium text-gray-500">task{tasks.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Shift Tabs */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedShift('First Shift')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold shadow-md transition-all duration-300 ripple ${selectedShift === 'First Shift'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:shadow-purple-400/50 scale-105'
                    : 'bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-600 hover:scale-105'
                    }`}
                >
                  First Shift
                </button>
                <button
                  onClick={() => setSelectedShift('Second Shift')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold shadow-md transition-all duration-300 ripple ${selectedShift === 'Second Shift'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:shadow-purple-400/50 scale-105'
                    : 'bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-600 hover:scale-105'
                    }`}
                >
                  Second Shift
                </button>
                <button
                  onClick={() => setSelectedShift('Third Shift')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold shadow-md transition-all duration-300 ripple ${selectedShift === 'Third Shift'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:shadow-purple-400/50 scale-105'
                    : 'bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-600 hover:scale-105'
                    }`}
                >
                  Third Shift
                </button>
              </div>
            </div>

            {/* Task List */}
            <div className="border-t border-purple-200 pt-4">
              {loadingTasks ? (
                <div className="flex items-center justify-center py-6">
                  <span className="loading loading-spinner loading-lg text-purple-600"></span>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">No tasks assigned for {selectedShift} shift</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <div
                      key={task.TaskID || index}
                      className="flex items-start gap-3 p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-purple-100/50 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01] hover:bg-white"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <p className="text-gray-800 font-medium" dir="auto">
                        {task.TargetDescription}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card bg-white/90 backdrop-blur-sm shadow-xl border border-gray-200/50 rounded-2xl card-lift">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-purple-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="card-title text-xl sm:text-2xl font-bold text-gray-800">
                  Quick Actions
                </h2>
                <p className="text-gray-500 text-xs sm:text-sm">
                  Frequently used actions
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* <button
                onClick={() => navigate("/technician/assignments")}
                className="btn bg-gradient-to-r from-purple-700 to-purple-500 border-none text-white btn-md sm:btn-lg gap-3 hover:scale-[1.02] transition-transform shadow-lg hover:shadow-purple-400/40 rounded-lg w-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-left">
                  <div className="font-bold">View Assignments</div>
                  <div className="text-xs opacity-80">See my tasks</div>
                </div>
              </button> */}

              <button
                onClick={() => navigate("/technician/record-audio")}
                className="btn bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 border-none text-white btn-md sm:btn-lg gap-3 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 shadow-lg hover:shadow-gray-600/50 rounded-xl w-full btn-premium shine-effect icon-bounce"
              ><svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>

                <div className="text-left">
                  <div className="font-bold">Submit Report</div>
                  <div className="text-xs opacity-80">Report progress</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TechnicianDashboard;

