import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function ProtectedRoute({ redirectTo = "/signin" }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}

export function PublicRoute({ redirectTo = "/dashboard" }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}
