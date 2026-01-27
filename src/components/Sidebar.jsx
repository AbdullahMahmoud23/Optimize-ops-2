import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import Logo from "../assets/Logo.jpeg";
import { useAuth } from "../context/AuthContext.jsx";

function Sidebar() {
  const { role, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const roleTitle = role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";

  const getMenuItems = () => {
    switch (role) {
      case "admin":
        return [
          { to: "/admin/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
          { to: "/admin/ratings", label: "Ratings", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
          { to: "/admin/tasks", label: "Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
        ];
      case "supervisor":
        return [
          { to: "/supervisor/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
          { to: "/supervisor/tasks", label: "Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
        ];
      case "technician":
        return [
          { to: "/technician/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
          { to: "/technician/recordings", label: "All Recordings", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
          { to: "/technician/record-audio", label: "Record Audio", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
        ];
      default:
        return [
          { to: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
        ];
    }
  };

  const menuItems = getMenuItems();
  const colorClass = role === "admin" ? "blue" : role === "supervisor" ? "green" : role === "technician" ? "purple" : "blue";

  useEffect(() => {
    // If visitor opens site on a small screen (phone), open the sidebar by default
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setSidebarOpen(true);
    }
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(prev => !prev)}
        className={`lg:hidden fixed top-4 left-4 z-60 p-3 rounded-full bg-indigo-600 text-white shadow-xl border border-indigo-700/30 focus:ring-2 focus:ring-indigo-400 transition-opacity ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        aria-label="Toggle sidebar"
        aria-expanded={sidebarOpen}
        aria-controls="main-sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>


      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-50 lg:hidden transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <aside id="main-sidebar" className={`fixed inset-y-0 left-0 z-60 w-64 min-h-screen bg-base-200 transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Header / Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-base-300 relative">
          <img
            src={Logo}
            alt="Factory Logo"
            className="w-28 h-20 rounded-full object-cover"
          />
          <div>
            <h2 className="text-sm font-bold">{roleTitle} Panel</h2>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-3 right-3 p-2 rounded-md bg-white text-gray-700 border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-300"
            aria-label="Close sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <ul className="menu p-4 gap-3">
          {menuItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 p-3 rounded-xl transition-all duration-300 transform focus:outline-none focus:ring-2 focus:ring-offset-2 icon-bounce shine-effect ${isActive
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 text-white shadow-lg scale-[1.02] border-transparent glow-blue'
                    : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-700 hover:shadow-md hover:scale-[1.03] border border-transparent hover:border-indigo-200/50'
                  }`
                }
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 group-hover:bg-indigo-100/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 transition-transform duration-300 group-hover:scale-110"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d={item.icon}
                    />
                  </svg>
                </span>
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}

export default Sidebar;
