import React, { useEffect, useState } from 'react';
import { Ban, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/authStore'; // adjust path to match your project

export default function AdminSettings() {
  const { token } = useAuthStore(); // adjust if your auth store exposes the token differently
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setSettings(data.settings);
        else setError(data.message || 'Failed to load settings');
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleDirectMessages = async () => {
    if (!settings || saving) return;
    const next = !settings.allowClientFreelancerDirectMessages;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ allowClientFreelancerDirectMessages: next }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      } else {
        setError(data.message || 'Failed to update setting');
      }
    } catch {
      setError('Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error || 'Could not load settings.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
        <p className="text-white/40 text-sm mt-1">Control platform-wide behavior for clients and freelancers.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-dark-800 border border-white/10 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Ban className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-white font-medium">Direct client ↔ freelancer messaging</h3>
              <p className="text-white/40 text-sm mt-1 max-w-md">
                When disabled, clients and freelancers can no longer message each other
                directly on a project. They can still reach the admin, and existing
                message history stays visible.
              </p>
            </div>
          </div>

          <button
            onClick={toggleDirectMessages}
            disabled={saving}
            aria-pressed={settings.allowClientFreelancerDirectMessages}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
              settings.allowClientFreelancerDirectMessages ? 'bg-primary' : 'bg-white/20'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings.allowClientFreelancerDirectMessages ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// Register this in your router, e.g.:
//   <Route path="settings" element={<SettingsPage />} /> inside your /admin route tree