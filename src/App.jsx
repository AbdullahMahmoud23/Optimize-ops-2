import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Ratings from "./pages/admin/Ratings";
import Tasks from "./pages/admin/Tasks";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import SuperAssignTask from "./pages/supervisor/SuperTasks";
import TechnicianDashboard from "./pages/technician/TechnicianDashboard";
import RecordAudio from "./pages/technician/RecordAudio";
import Recordings from "./pages/technician/Recording.jsx";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Supervisors from "./pages/Supervisors";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute.jsx";
import { RoleBasedRoute } from "./components/RoleBasedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function AppLayout({ children }) {
  const location = useLocation();
  const isAuthPage =
    location.pathname.startsWith("/signin") ||
    location.pathname.startsWith("/signup");

  if (isAuthPage) return <div className="min-h-screen">{children}</div>;

  return (
    <div className="drawer lg:drawer-open">
      <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        <Header />
        <main className="flex-grow bg-base-100">{children}</main>
      </div>
      <div className="drawer-side">
        <label htmlFor="my-drawer-2" className="drawer-overlay"></label>
        <Sidebar />
      </div>
    </div>
  );
}

// Redirect root "/" or /dashboard based on user role
function RootRedirect() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated || !role) return <Navigate to="/signin" replace />;
  return <Navigate to={`/${role}/dashboard`} replace />;
}

function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          {/* Root redirects */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={<RootRedirect />} />

          {/* Public routes */}
          <Route element={<PublicRoute />}>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>

          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="ratings" element={<Ratings />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route
                    path="*"
                    element={<Navigate to="/admin/dashboard" replace />}
                  />
                </Routes>
              </RoleBasedRoute>
            }
          />

          {/* Supervisor routes */}
          <Route
            path="/supervisor/*"
            element={
              <RoleBasedRoute allowedRoles={["supervisor"]}>
                <Routes>
                  <Route path="dashboard" element={<SupervisorDashboard />} />
                  <Route path="tasks" element={<SuperAssignTask />} />
                  <Route
                    path="*"
                    element={<Navigate to="/supervisor/dashboard" replace />}
                  />
                </Routes>
              </RoleBasedRoute>
            }
          />

          {/* Technician routes */}
<Route
  path="/technician/*"
  element={
    <RoleBasedRoute allowedRoles={["technician"]}>
      <Routes>
        <Route path="dashboard" element={<TechnicianDashboard />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="record-audio" element={<RecordAudio />} />
        <Route
          path="*"
          element={<Navigate to="/technician/dashboard" replace />}
        />
      </Routes>
    </RoleBasedRoute>
  }
/>

          {/* Catch-all 404 */}
          <Route
            path="*"
            element={<h1 className="p-8 text-red-500">404 Not Found</h1>}
          />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
