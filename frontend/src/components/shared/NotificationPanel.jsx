import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import useNotificationStore from '../../store/notificationStore';
import { timeAgo } from '../../utils/helpers';

const typeColors = {
  payment_verified: 'bg-green-500/20 text-green-400',
  payment_rejected: 'bg-red-500/20 text-red-400',
  quotation_sent: 'bg-yellow-500/20 text-yellow-400',
  event_confirmed: 'bg-green-500/20 text-green-400',
  event_completed: 'bg-amber-500/20 text-amber-400',
  freelancer_assigned: 'bg-blue-500/20 text-blue-400',
  meeting_scheduled: 'bg-purple-500/20 text-purple-400',
  default: 'bg-white/10 text-white/60'
};

export default function NotificationPanel({ onClose }) {
  const { notifications, markRead, markAllRead, fetchNotifications } = useNotificationStore();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  // Stable reference to onClose so it doesn't re-trigger the effect
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Guards against React StrictMode double-invoking the mount effect
  // and against re-marking if fetchNotifications/markAllRead identity ever changes.
  const hasAutoMarkedRef = useRef(false);

  useEffect(() => {
    // Fetch once on mount — stable because fetchNotifications from Zustand is already stable
    Promise.resolve(fetchNotifications()).finally(() => {
      // Opening the bell icon is treated as "seen" — auto mark everything read
      // so the user no longer has to click "Mark all read" manually.
      if (!hasAutoMarkedRef.current) {
        hasAutoMarkedRef.current = true;
        markAllRead();
      }
    });

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onCloseRef.current();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []); // Empty deps: runs once on mount only, preventing duplicate fetches

  const handleNotificationClick = useCallback(async (notif) => {
    if (!notif.isRead) {
      await markRead(notif._id);
    }
    if (notif.link) {
      const isExternal = /^https?:\/\//i.test(notif.link);
      if (isExternal) {
        // Genuine external URL — a real navigation is correct here
        window.location.href = notif.link;
      } else {
        // Internal app route — use the router so React Router matches it
        // client-side instead of asking the server for a page that only
        // exists as a client-rendered route (which was causing the 404s).
        navigate(notif.link);
      }
      onCloseRef.current();
    }
  }, [markRead, navigate]);

  return (
    <div
      ref={panelRef}
      className="fixed top-14 left-4 right-4 sm:left-auto sm:right-4 w-auto sm:w-96 bg-[#1a2338] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#161f2e]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="font-semibold text-white">Notifications</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={markAllRead}
            className="text-xs flex items-center gap-1 text-white/60 hover:text-white transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white p-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-[420px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="w-10 h-10 mx-auto mb-3 text-white/20" />
            <p className="text-white/40">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif._id}
              onClick={() => handleNotificationClick(notif)}
              className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all
                ${!notif.isRead ? 'bg-primary/5' : ''}`}
            >
              <div className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.isRead ? 'bg-primary animate-pulse' : 'bg-transparent'}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white leading-tight truncate">{notif.title}</p>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wide ${
                        typeColors[notif.type] || typeColors.default
                      }`}
                    >
                      {(notif.type || 'update').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 mt-1 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-white/30 mt-1.5">
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}