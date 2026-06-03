
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/shared/LoginPage';
import Layout from './components/shared/Layout';
import Dashboard from './components/dashboard/Dashboard';
import AssetsPage from './components/assets/AssetsPage';
import BulkImportPage from './components/assets/BulkImportPage';
import ProjectsPage from './components/projects/ProjectsPage';
import TimelinePage from './components/projects/TimelinePage';
import MaintenancePage from './components/maintenance/MaintenancePage';
import ManpowerPage from './components/manpower/ManpowerPage';
import OperationsPage from './components/operations/OperationsPage';
import MovementPage from './components/operations/MovementPage';
import ResourcePlanningPage from './components/planning/ResourcePlanningPage';
import ReportsPage from './components/reports/ReportsPage';
import HistoryPage from './components/history/HistoryPage';
import HelpPage from './components/help/HelpPage';
import toast from 'react-hot-toast';

// A wrapper for routes that require admin privileges.
function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null; // Or a loading spinner

  if (!isAdmin) {
    // Redirect non-admins to the dashboard and show a toast.
    // Using a navigation component is the standard way.
    // We show a toast for better UX.
    toast.error("You don't have permission to access this page.");
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Prevent logged in user from accessing /login
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

// Protect routes that require authentication
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{background:'#0a0f1a'}}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-sm" style={{color:'#64748b'}}>
            Loading OGS OpsCenter...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage/>
          </PublicRoute>
        }
      />

      <Route path="/" element={<ProtectedRoute><Layout/></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace/>}/>
        <Route path="dashboard"   element={<Dashboard/>}/>
        <Route path="assets"      element={<AssetsPage/>}/>
        <Route 
          path="import"      
          element={
            <AdminRoute>
              <BulkImportPage/>
            </AdminRoute>
          }
        />
        <Route path="projects"    element={<ProjectsPage/>}/>
        <Route path="timeline"    element={<TimelinePage/>}/>
        <Route path="maintenance" element={<MaintenancePage/>}/>
        <Route path="manpower"    element={<ManpowerPage/>}/>
        <Route path="operations"  element={<OperationsPage/>}/>
        <Route path="movement"    element={<MovementPage/>}/>
        <Route path="planning"    element={<ResourcePlanningPage/>}/>
        <Route path="reports"     element={<ReportsPage/>}/>
        <Route path="history"     element={<HistoryPage/>}/>
        <Route path="help"        element={<HelpPage/>}/>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
    </Routes>
  );
}
