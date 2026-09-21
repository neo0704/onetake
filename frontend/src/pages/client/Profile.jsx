import React, { useEffect, useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/authStore'; // adjust path if needed

export default function ClientProfile() {
  const { token, user } = useAuthStore(); // adjust if your store exposes these differently
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-white/40 text-sm mt-1">{user?.name} · {user?.email}</p>
      </div>

      <div className="card">
        <h3 className="section-title mb-4">Notifications</h3>

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
                    Quotations ready, payment confirmations, and event reminders sent to your email.
                    In-app notifications are unaffected.
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