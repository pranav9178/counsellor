import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { CouncilorDashboard } from './pages/CouncilorDashboard';
import { StudentDashboard } from './pages/StudentDashboard';
import { Loader2 } from 'lucide-react';

const DashboardRouter = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (user.role === 'superadmin') return <SuperAdminDashboard />;
  if (user.role === 'councilor')  return <CouncilorDashboard />;
  return <StudentDashboard />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<DashboardRouter />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

