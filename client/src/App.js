import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import FollowupReminderModal from './components/common/FollowupReminderModal';
import LoginSummaryModal from './components/common/LoginSummaryModal';

// Eager-load auth page
import Login from './pages/Login';

// Public pages
const Pricing = lazy(() => import('./pages/Pricing'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Lazy-load all other pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const TasksPipeline = lazy(() => import('./pages/TasksPipeline'));
const Followups = lazy(() => import('./pages/Followups'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Quotations = lazy(() => import('./pages/Quotations'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Payments = lazy(() => import('./pages/Payments'));
const Content = lazy(() => import('./pages/Content'));
const Reports = lazy(() => import('./pages/Reports'));
const TeamActivity = lazy(() => import('./pages/TeamActivity'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));

// Owner pages
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard'));
const WorkspaceList = lazy(() => import('./pages/owner/WorkspaceList'));
const WorkspaceDetail = lazy(() => import('./pages/owner/WorkspaceDetail'));
const OwnerUsers = lazy(() => import('./pages/owner/OwnerUsers'));

// Super admin pages
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'));
const Organizations = lazy(() => import('./pages/superadmin/Organizations'));
const OrganizationDetail = lazy(() => import('./pages/superadmin/OrganizationDetail'));
const OrganizationNew = lazy(() => import('./pages/superadmin/OrganizationNew'));
const Plans = lazy(() => import('./pages/superadmin/Plans'));

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d1a' }}>
    <div style={{ width: 40, height: 40, border: '3px solid #1e1e3a', borderTopColor: '#e94560', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>
);

// Guards
const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) {
    if (user.role === 'superadmin') return <Navigate to="/superadmin/dashboard" replace />;
    if (user.role === 'owner') return <Navigate to="/owner/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const AppRoutes = () => (
  <Suspense fallback={<Spinner />}>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Employee / Admin / Owner shared routes */}
      <Route path="/dashboard" element={<PrivateRoute roles={['admin', 'employee']}><Dashboard /></PrivateRoute>} />
      <Route path="/leads" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><Leads /></PrivateRoute>} />
      <Route path="/leads/:id" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><LeadDetail /></PrivateRoute>} />
      <Route path="/pipeline" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><Pipeline /></PrivateRoute>} />
      <Route path="/tasks-pipeline" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><TasksPipeline /></PrivateRoute>} />
      <Route path="/followups" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><Followups /></PrivateRoute>} />
      <Route path="/appointments" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><Appointments /></PrivateRoute>} />
      <Route path="/quotations" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><Quotations /></PrivateRoute>} />
      <Route path="/invoices" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><Invoices /></PrivateRoute>} />
      <Route path="/payments" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><Payments /></PrivateRoute>} />
      <Route path="/content" element={<PrivateRoute roles={['admin', 'employee', 'owner']}><Content /></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute roles={['admin', 'owner']}><Reports /></PrivateRoute>} />
      <Route path="/team-activity" element={<PrivateRoute roles={['admin', 'owner']}><TeamActivity /></PrivateRoute>} />
      <Route path="/notifications" element={<PrivateRoute roles={['admin', 'employee']}><Notifications /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute roles={['admin', 'owner']}><Users /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute roles={['admin', 'owner']}><Settings /></PrivateRoute>} />

      {/* Owner routes */}
      <Route path="/owner/dashboard" element={<PrivateRoute roles={['owner']}><OwnerDashboard /></PrivateRoute>} />
      <Route path="/owner/workspaces" element={<PrivateRoute roles={['owner']}><WorkspaceList /></PrivateRoute>} />
      <Route path="/owner/workspaces/:id" element={<PrivateRoute roles={['owner']}><WorkspaceDetail /></PrivateRoute>} />
      <Route path="/owner/notifications" element={<PrivateRoute roles={['owner']}><Notifications /></PrivateRoute>} />
      <Route path="/owner/users" element={<PrivateRoute roles={['owner']}><OwnerUsers /></PrivateRoute>} />
      <Route path="/owner/settings" element={<PrivateRoute roles={['owner']}><Settings /></PrivateRoute>} />

      {/* Super admin routes */}
      <Route path="/superadmin/dashboard" element={<PrivateRoute roles={['superadmin']}><SuperAdminDashboard /></PrivateRoute>} />
      <Route path="/superadmin/organizations" element={<PrivateRoute roles={['superadmin']}><Organizations /></PrivateRoute>} />
      <Route path="/superadmin/organizations/new" element={<PrivateRoute roles={['superadmin']}><OrganizationNew /></PrivateRoute>} />
      <Route path="/superadmin/organizations/:id" element={<PrivateRoute roles={['superadmin']}><OrganizationDetail /></PrivateRoute>} />
      <Route path="/superadmin/plans" element={<PrivateRoute roles={['superadmin']}><Plans /></PrivateRoute>} />

      {/* Fallback */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </Suspense>
);

const GlobalModals = () => {
  const { followupReminder, dismissFollowupReminder } = useSocket();
  return (
    <>
      <LoginSummaryModal />
      <FollowupReminderModal reminder={followupReminder} onDismiss={dismissFollowupReminder} />
    </>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
        <GlobalModals />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1a1a2e', color: '#e2e8f0', border: '1px solid #2a2a4a', fontSize: 13 },
            success: { iconTheme: { primary: '#22c55e', secondary: '#0d0d1a' } },
            error: { iconTheme: { primary: '#e94560', secondary: '#0d0d1a' } },
          }}
        />
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
