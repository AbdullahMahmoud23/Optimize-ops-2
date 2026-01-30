import { useNavigate } from "react-router-dom";
import Logo from "../assets/Logo.jpeg";
import { useAuth } from "../context/AuthContext.jsx";

function Header() {
  const navigate = useNavigate();
  const { logout, role, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/signin", { replace: true });
  };

  const handleLogoClick = () => {
    if (role) {
      navigate(`/${role}/dashboard`);
    } else {
      navigate("/dashboard");
    }
  };

  const getRoleBadgeColor = () => {
    switch (role) {
      case "admin":
        return "badge-primary";
      case "supervisor":
        return "badge-Accent";
      case "technician":
        return "badge-Neutral";
      default:
        return "badge-neutral";
    }
  };

  const roleTitle = role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";

  return (
    <div className="navbar bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg z-50 relative glass-effect">
      {/* Left side: Logo + Title */}
      <div
        className="flex items-center gap-3 px-4 cursor-pointer group"
        onClick={handleLogoClick}
      >
        <img
          src={Logo}
          alt="Factory Logo"
          className="w-10 h-10 rounded-lg object-cover shadow-lg transition-all duration-300 group-hover:shadow-blue-400/50 group-hover:scale-105"
        />
        <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 via-purple-500 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:via-blue-500 group-hover:to-cyan-400">
          Factory Dashboard
        </h1>
      </div>
      <div className="flex-1"></div>

      {/* Right side: Role Badge + User + Logout */}
      <div className="flex items-center gap-4 px-4">
        {role && (
          <div className={`badge ${getRoleBadgeColor()} badge-lg shadow-md transition-all duration-300 hover:scale-105 pulse-soft`}>
            {roleTitle}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="btn bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-none shadow-lg transition-all duration-300 hover:shadow-blue-500/50 hover:scale-105 hover:-translate-y-0.5 btn-premium shine-effect"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Header;
