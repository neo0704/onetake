import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, Clock,
  Video, LogOut, Menu, X, Bell, Banknote, UserCircle, AlertTriangle, Settings
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';
import NotificationPanel from '../shared/NotificationPanel';
import NotificationPreferencesPanel from '../shared/NotificationPreferencesPanel';

const LINKS = [
  { to: '/freelancer',          icon: LayoutDashboard, label: 'Dashboard',  end: true },
  { to: '/freelancer/events',   icon: CalendarDays,    label: 'My Projects' },
  { to: '/freelancer/schedule', icon: Clock,           label: 'Schedule'    },
  { to: '/freelancer/damage-reports', icon: AlertTriangle, label: 'Damage Reports' },
  { to: '/freelancer/meetings', icon: Video,           label: 'Meetings'    },
  { to: '/freelancer/payroll',  icon: Banknote,        label: 'Payroll'     },
  { to: '/freelancer/profile',  icon: UserCircle,      label: 'My Profile'  },
];

export default function FreelancerLayout() {
  const { user, logout } = useAuthStore();
  const { notifications } = useNotificationStore();
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const navigate = useNavigate();

  const [sidebarOpen,   setSidebarOpen]   = useState(false);   // mobile slide-in
  const [collapsed,     setCollapsed]     = useState(false);   // desktop rail collapse (pinned)
  const [hoverExpanded, setHoverExpanded] = useState(false);   // temp expand on hover, only when collapsed
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Visually expanded = pinned open, or collapsed-but-hovered
  const expanded = !collapsed || hoverExpanded;

  return (
    <div className="flex h-screen bg-[#0f0f1a] overflow-hidden">
      {/* Sidebar */}
      <aside
        onMouseLeave={() => setHoverExpanded(false)}
        className={`fixed inset-y-0 left-0 z-40 bg-dark-800 border-r border-white/10 transform transition-all duration-300 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        ${collapsed ? 'lg:fixed' : 'lg:relative'}
        ${expanded ? 'lg:w-64' : 'lg:w-20'}
        ${collapsed && hoverExpanded ? 'lg:shadow-2xl' : ''}
        w-64`}>

        {/* Logo — layout is pinned-state only, never shifts on hover, so the toggle stays clickable */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b border-white/10 ${collapsed ? 'lg:flex-col lg:gap-2' : 'justify-between'}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'lg:justify-center' : ''}`}>
            <img src="/logo.jpg" alt="LiveTake" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
            <div className={collapsed ? 'lg:hidden' : ''}>
              <h1 className="font-black text-white text-base leading-none tracking-widest uppercase">OneTake</h1>
              <p className="text-xs text-white/40 mt-0.5">Freelancer Portal</p>
            </div>
          </div>
          <button onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors flex-shrink-0">
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          onMouseEnter={() => collapsed && setHoverExpanded(true)}
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {LINKS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={!expanded ? label : undefined}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!expanded ? 'lg:justify-center lg:px-0' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className={!expanded ? 'lg:hidden' : ''}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div
          onMouseEnter={() => collapsed && setHoverExpanded(true)}
          className="px-3 py-4 border-t border-white/10">
          <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${!expanded ? 'lg:justify-center lg:px-0' : ''}`}>
            <div className="w-8 h-8 bg-primary/30 rounded-full flex items-center justify-center text-sm font-bold text-primary flex-shrink-0 overflow-hidden">
              {user?.avatar ? (
                <img
                  src={`${import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'}${user.avatar}`}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                user?.name?.[0]?.toUpperCase() || 'F'
              )}
            </div>
            <div className={`flex-1 min-w-0 ${!expanded ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/40">Freelancer</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title={!expanded ? 'Logout' : undefined}
            className={`btn-ghost w-full mt-2 text-sm ${!expanded ? 'lg:justify-center' : ''}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" /> <span className={!expanded ? 'lg:hidden' : ''}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${collapsed ? 'lg:ml-20' : ''}`}>
        <header className="h-16 bg-dark-800 border-b border-white/10 flex items-center gap-4 px-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="lg:hidden text-white/60 hover:text-white"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1" />

          {/* Notification Settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            {showSettings && <NotificationPreferencesPanel onClose={() => setShowSettings(false)} />}
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && <NotificationPanel onClose={() => setShowNotifs(false)} />}
          </div>
        </header>

        {/* Content — centered wrapper so pages don't visually shift as the sidebar collapses/expands */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}