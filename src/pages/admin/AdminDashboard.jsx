import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_URL } from "../../config";

function AdminDashboard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch technician performance data
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
      } catch (err) {
        console.error('Error fetching performance:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchPerformanceData();
    }
  }, [token]);

  // Get the two worst performing technicians (sorted by overallScore ascending)
  const worstTechnicians = [...technicians]
    .sort((a, b) => a.overallScore - b.overallScore)
    .slice(0, 2);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 px-4 py-6 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Blurs */}
      <div className="hidden md:block absolute -top-40 -right-40 w-[400px] h-[400px] bg-blue-300/10 blur-[100px] rounded-full" />
      <div className="hidden md:block absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-black/10 blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-gradient-to-r from-blue-700 to-black bg-clip-text">
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
            Welcome back! Here's your overview.
          </p>
        </div>

        {/* Quick Actions Card*/}
        <div className="mb-8">
          <div className="card bg-white/90 backdrop-blur-sm shadow-xl border border-gray-200/50 rounded-2xl p-6 card-lift">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              {/* Show Graphs */}
              <button
                onClick={() => navigate("/admin/ratings")}
                className="btn bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 border-none text-white w-full btn-lg gap-3 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 shadow-lg hover:shadow-blue-500/50 rounded-xl btn-premium shine-effect icon-bounce"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 012-2h8a2 2 0 012 2v6" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l9 6 9-6" />
                </svg>
                <span className="font-bold">Show Graphs</span>
              </button>

              {/* Assign Target */}
              <button
                onClick={() => navigate("/admin/tasks")}
                className="btn bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 border-none text-white w-full btn-lg gap-3 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 shadow-lg hover:shadow-gray-600/50 rounded-xl btn-premium shine-effect icon-bounce"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="font-bold">Assign Target</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content - دلوقتي full width وأكبر بكتير */}
        <div className="space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
            {/* Number of Technicians */}
            <div className="stats bg-gradient-to-br from-blue-50 via-white to-blue-100/50 border border-blue-200/50 shadow-md transition-all duration-300 rounded-xl card-lift hover:shadow-blue-300/30 hover-glow-blue">
              <div className="stat flex items-center justify-between gap-4">
                <div>
                  <div className="stat-title text-sm sm:text-base font-medium text-gray-600">
                    Number of Technicians
                  </div>
                  <div className="stat-value text-4xl sm:text-6xl font-bold text-blue-700">
                    {loading ? (
                      <span className="animate-pulse">...</span>
                    ) : technicians.length}
                  </div>
                </div>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 float-soft">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-blue-700">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Worst Achieving Technicians */}
            <div className="stats bg-gradient-to-br from-red-50 via-white to-red-100/50 border border-red-200/50 shadow-md transition-all duration-300 rounded-xl card-lift hover:shadow-red-300/30 hover-glow-purple">
              <div className="stat flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="stat-title text-sm sm:text-base font-medium text-gray-600 mb-3">
                    Worst Achieving Technicians
                  </div>
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                      <span className="text-gray-500">Loading...</span>
                    </div>
                  ) : worstTechnicians.length === 0 ? (
                    <div className="text-gray-500">No data available</div>
                  ) : (
                    <div className="space-y-3">
                      {worstTechnicians.map((tech, index) => (
                        <div key={tech.id} className="flex items-center gap-3">
                          <span className="text-lg font-bold text-red-700">#{index + 1}</span>
                          <div>
                            <div className="text-xl sm:text-2xl font-bold text-red-700">
                              {tech.email}
                            </div>
                            <div className="text-sm text-red-600">
                              Achievement: {tech.overallScore}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-200 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-red-700">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;