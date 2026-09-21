import React, { useEffect, useState } from 'react';
import { MessageSquare, Users, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/authStore'; // adjust path to match your project

// ── Reusable toggle row ────────────────────────────────────────────────────
function ToggleRow({ icon: Icon, label, description, checked, onToggle, disabled }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-white text-sm font-medium">{label}</p>
          <p className="text-white/40 text-xs mt-1">{description}</p>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={checked}
        style={{ width: '44px', height: '24px' }}
        className={`relative rounded-full transition-colors flex-shrink-0 overflow-hidden ${
          checked ? 'bg-green-500' : 'bg-white/20'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <span
          style={{
            width: '18px',
            height: '18px',
            top: '3px',
            left: '3px',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
          className="absolute bg-white rounded-full transition-transform duration-200"
        />
      </button>
    </div>
  );
}

export default function SettingsPanel({ onClose }) {
  const { token } = useAuthStore(); // adjust if your auth store exposes the token differently
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false); // tracks whether a save is in flight
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

  const toggleField = async (field) => {
    if (!settings || saving) return;
    const next = !settings[field];
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: next }),
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

  return (
    <div className="fixed left-4 right-4 top-20 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 w-auto max-h-[75vh] overflow-y-auto bg-dark-800 border border-white/10 rounded-xl shadow-2xl z-50">
      <div className="sticky top-0 bg-dark-800 px-4 py-3 border-b border-white/10 rounded-t-xl">
        <h3 className="text-white font-medium text-sm">Platform Settings</h3>
      </div>

      <div className="p-4 rounded-b-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !settings ? (
          <p className="text-red-400 text-sm">{error || 'Could not load settings.'}</p>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-red-400 text-xs">{error}</p>}

            <ToggleRow
              icon={MessageSquare}
              label="Direct client ↔ freelancer messaging"
              description="When off, they can only reach each other through the admin."
              checked={settings.allowClientFreelancerDirectMessages}
              onToggle={() => toggleField('allowClientFreelancerDirectMessages')}
              disabled={saving}
            />

            <div className="border-t border-white/10" />

            <ToggleRow
              icon={Users}
              label="Direct freelancer ↔ freelancer messaging"
              description="When off, teammates on the same project can no longer message each other directly."
              checked={settings.allowFreelancerFreelancerDirectMessages}
              onToggle={() => toggleField('allowFreelancerFreelancerDirectMessages')}
              disabled={saving}
            />
          </div>
        )}
      </div>
    </div>
  );
}