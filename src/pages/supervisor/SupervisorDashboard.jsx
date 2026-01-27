import { useNavigate } from "react-router-dom";

function SupervisorDashboard() {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 px-4 py-6 sm:px-6 lg:px-8 overflow-hidden overflow-x-hidden">
      <div className="hidden md:block absolute -top-40 -right-40 w-[400px] h-[400px] bg-green-300/10 blur-[100px] rounded-full" />
      <div className="hidden md:block absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-green-400/10 blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-gradient-to-r from-green-700 to-green-500 bg-clip-text">
            Manager Dashboard
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
            Manage your team and oversee operations
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Team Members */}
          <div className="stats bg-gradient-to-r from-green-50 to-green-100/50 border border-green-200 shadow-md hover:shadow-lg transition-all rounded-xl">
            <div className="stat flex items-center justify-between gap-4">
              <div>
                <div className="stat-title text-sm sm:text-base font-medium text-gray-600">
                  Team Members
                </div>
                <div className="stat-value text-3xl sm:text-5xl font-bold text-green-700">
                  8
                </div>
              </div>
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-200 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-6 h-6 sm:w-8 sm:h-8 text-green-700"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Active Tasks */}
          <div className="stats bg-gradient-to-r from-gray-50 to-gray-200/60 border border-gray-300 shadow-md hover:shadow-lg transition-all rounded-xl">
            <div className="stat flex items-center justify-between gap-4">
              <div>
                <div className="stat-title text-sm sm:text-base font-medium text-gray-600">
                  Active Tasks
                </div>
                <div className="stat-value text-3xl sm:text-5xl font-bold text-gray-800">
                  15
                </div>
              </div>
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-300 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-6 h-6 sm:w-8 sm:h-8 text-gray-800"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card bg-white shadow-xl border border-gray-200 rounded-2xl">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-green-700"
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
              <button
                onClick={() => navigate("/supervisor/tasks")}
                className="btn bg-gradient-to-r from-green-700 to-green-500 border-none text-white btn-md sm:btn-lg gap-3 hover:scale-[1.02] transition-transform shadow-lg hover:shadow-green-400/40 rounded-lg w-full"
              >
                <svg
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
                  <div className="font-bold">View Tasks</div>
                  <div className="text-xs opacity-80">Manage team tasks</div>
                </div>
              </button>

              <button
                onClick={() => navigate("/supervisor/team")}
                className="btn bg-gradient-to-r from-gray-900 to-gray-700 border-none text-white btn-md sm:btn-lg gap-3 hover:scale-[1.02] transition-transform shadow-lg hover:shadow-gray-500/40 rounded-lg w-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-left">
                  <div className="font-bold">View Team</div>
                  <div className="text-xs opacity-80">See team members</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupervisorDashboard;

