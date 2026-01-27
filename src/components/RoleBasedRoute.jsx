import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function RoleBasedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (!role) {
    return <Navigate to="/signin" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Redirect to their role's dashboard if they don't have access
    return <Navigate to={`/${role}/dashboard`} replace />;
  }

  return children;
}

