import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import useNotificationStore from './store/notificationStore';
import { initSocket } from './services/socket';
import { getSocket } from './services/socket';
import QuotationPrintView from './pages/client/QuotationPrintView';

// Auth pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

// Admin pages
import AdminLayout from './components/layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminEvents from './pages/admin/Events';
import AdminEventDetail from './pages/admin/EventDetail';
import AdminQuotations from './pages/admin/Quotations';
import AdminQuotationCreate from './pages/admin/QuotationCreate';
import AdminPayments from './pages/admin/Payments';
import AdminFreelancers from './pages/admin/Freelancers';
import AdminEquipment from './pages/admin/Equipment';
import AdminEquipmentRequests from './pages/admin/EquipmentRequests';
import AdminPayroll from './pages/admin/Payroll';
import AdminUsers from './pages/admin/Users';
import AdminReports from './pages/admin/Reports';
import AdminMeetings from './pages/admin/Meetings';
import AdminHomepage from './pages/admin/AdminHomepage';


// Client pages
import ClientLayout from './components/layouts/ClientLayout';
import ClientDashboard from './pages/client/Dashboard';
import ClientInquiry from './pages/client/Inquiry';
import ClientEvents from './pages/client/Events';
import ClientEventDetail from './pages/client/EventDetail';
import ClientQuotations from './pages/client/Quotations';
import ClientPayments from './pages/client/Payments';
import ClientMeetings from './pages/client/Meetings';

// Freelancer pages
import FreelancerLayout from './components/layouts/FreelancerLayout';
import FreelancerDashboard from './pages/freelancer/Dashboard';
import FreelancerEvents from './pages/freelancer/Events';
import FreelancerEventDetail from './pages/freelancer/EventDetail';
import FreelancerSchedule from './pages/freelancer/Schedule';
import FreelancerDamageReports from './pages/freelancer/DamageReports';
import FreelancerMeetings from './pages/freelancer/Meetings';
import FreelancerPayroll from './pages/freelancer/Payroll';
import FreelancerProfile from './pages/freelancer/Profile';

// Shared
import VideoCall from './pages/VideoCall';
import NotFound from './pages/NotFound';
import HomePage from './pages/HomePage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, token, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f1a]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Loading OneTake...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'client') return <Navigate to="/client" replace />;
    if (user.role === 'freelancer') return <Navigate to="/freelancer" replace />;
  }
  return children;
};

// Shows HomePage to guests; redirects logged-in users to their dashboard
const HomeRoute = () => {
  const { user, loading } = useAuthStore();
  if (loading) return null;
  if (!user) return <HomePage />;
  if (user.role === 'admin')      return <Navigate to="/admin"      replace />;
  if (user.role === 'client')     return <Navigate to="/client"     replace />;
  if (user.role === 'freelancer') return <Navigate to="/freelancer" replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  const { user, init } = useAuthStore();
  const { fetchNotifications, addNotification } = useNotificationStore();

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!user) return;
    const socket = initSocket(user._id);
    fetchNotifications();

    socket.on('new_notification', (notif) => {
      addNotification(notif);
    });

    if (user.role === 'freelancer') {
      socket.on('payroll_created', (data) => {
        addNotification({
          _id:       Date.now().toString(),
          type:      'general',
          title:     '📋 New Payroll Entry',
          message:   `A payroll entry of ₱${data.netPay?.toLocaleString() || '—'} has been added to your account.`,
          isRead:    false,
          link:      '/freelancer/payroll',
          createdAt: new Date().toISOString()
        });
        import('react-hot-toast').then(({ default: toast }) => {
          toast('📋 New payroll entry added to your account!', {
            duration: 5000,
            style: { background: '#1a1a2e', color: '#f0f0f5', border: '1px solid rgba(255,255,255,0.1)' }
          });
        });
      });

      socket.on('payroll_updated', (data) => {
        if (data.status === 'pending') {
          addNotification({
            _id:       Date.now().toString(),
            type:      'general',
            title:     '⏳ Payroll Ready',
            message:   `Your payroll of ₱${data.netPay?.toLocaleString() || '—'} is ready for release.`,
            isRead:    false,
            link:      '/freelancer/payroll',
            createdAt: new Date().toISOString()
          });
          import('react-hot-toast').then(({ default: toast }) => {
            toast('⏳ Your payroll is ready for release!', {
              duration: 5000,
              style: { background: '#1a1a2e', color: '#f0f0f5', border: '1px solid rgba(255,255,255,0.1)' }
            });
          });
        }
      });
    }

    return () => {
      socket.off('new_notification');
      socket.off('payroll_created');
      socket.off('payroll_updated');
    };
  }, [user?._id]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"          element={<HomeRoute />} />
        <Route path="/login"     element={<LoginPage />} />
        <Route path="/register"  element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/quotation/print/:id" element={<QuotationPrintView />} />
        <Route path="/meeting/:roomId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/:id" element={<AdminEventDetail />} />
          <Route path="quotations" element={<AdminQuotations />} />
          <Route path="quotations/create/:eventId" element={<AdminQuotationCreate />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="freelancers" element={<AdminFreelancers />} />
          <Route path="equipment" element={<AdminEquipment />} />
          <Route path="equipment-requests" element={<AdminEquipmentRequests />} />
          <Route path="payroll" element={<AdminPayroll />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="meetings" element={<AdminMeetings />} />
          <Route path="homepage" element={<AdminHomepage />} />

        </Route>

        {/* Client */}
        <Route path="/client" element={<ProtectedRoute allowedRoles={['client']}><ClientLayout /></ProtectedRoute>}>
          <Route index element={<ClientDashboard />} />
          <Route path="inquiry" element={<ClientInquiry />} />
          <Route path="events" element={<ClientEvents />} />
          <Route path="events/:id" element={<ClientEventDetail />} />
          <Route path="quotations" element={<ClientQuotations />} />
          <Route path="payments" element={<ClientPayments />} />
          <Route path="meetings" element={<ClientMeetings />} />
        </Route>

        {/* Freelancer */}
        <Route path="/freelancer" element={<ProtectedRoute allowedRoles={['freelancer']}><FreelancerLayout /></ProtectedRoute>}>
          <Route index element={<FreelancerDashboard />} />
          <Route path="events" element={<FreelancerEvents />} />
          <Route path="events/:id" element={<FreelancerEventDetail />} />
          <Route path="schedule" element={<FreelancerSchedule />} />
          <Route path="meetings" element={<FreelancerMeetings />} />
          <Route path="payroll" element={<FreelancerPayroll />} />
          <Route path="profile" element={<FreelancerProfile />} />
          <Route path="damage-reports" element={<FreelancerDamageReports />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}