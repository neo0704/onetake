import React, { useEffect, useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/authStore'; // adjust path if needed

export default function NotificationPreferencesPanel({ onClose }) {
  const { token } = useAuthStore();
  const [enabled, setEnabled] = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch('/api/notification-preferences', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setEnabled(data.emailNotificationsEnabled);
        else setError(data.message || 'Failed to load preferences');
      })
      .catch(() => setError('Failed to load preferences'))
      .finally(() => setLoading(false));
  }, [token]);

  const toggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emailNotificationsEnabled: next }),
      });
      const data = await res.json();
      if (data.success) setEnabled(data.emailNotificationsEnabled);
      else setError(data.message || 'Failed to update preference');
    } catch {
      setError('Failed to update preference');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 bg-dark-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-medium text-sm">Notification Settings</h3>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : enabled === null ? (
          <p className="text-red-400 text-sm">{error || 'Could not load your preferences.'}</p>
        ) : (
          <>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Email notifications</p>
                  <p className="text-white/40 text-xs mt-1">
                    Quotations ready, payment confirmations, and event reminders.
                    In-app notifications aren't affected.
                  </p>
                </div>
              </div>

              <button
                onClick={toggle}
                disabled={saving}
                aria-pressed={enabled}
                style={{ width: '44px', height: '24px' }}
                className={`relative rounded-full transition-colors flex-shrink-0 overflow-hidden ${
                  enabled ? 'bg-green-500' : 'bg-white/20'
                } ${saving ? 'opacity-50' : ''}`}
              >
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    top: '3px',
                    left: '3px',
                    transform: enabled ? 'translateX(20px)' : 'translateX(0)',
                  }}
                  className="absolute bg-white rounded-full transition-transform duration-200"
                />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}