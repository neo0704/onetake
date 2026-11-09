import React, { useEffect, useRef, useState } from 'react';
import { Mail, Camera, Trash2, Save, Maximize2, X, Sun, Moon, AlertTriangle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatDate } from '../../utils/helpers';import useAuthStore from '../../store/authStore'; // adjust path if needed
import { Bone } from '../../components/shared/Skeletons';
import { useTheme } from '../../components/shared/theme';

const EMPTY = { name: '', email: '', phone: '', company: '', address: '' };

export default function ClientProfile() {
  const store = useAuthStore();
  const { user, init } = store;
  const userId = user?._id || user?.id;

  // ── Profile details ────────────────────────────────────────────────────────
  const [profile, setProfile]   = useState(null);   // latest user object from the server
  const [form, setForm]         = useState(EMPTY);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile]   = useState(false);
  const [avatarBusy, setAvatarBusy]         = useState(false);
  const fileRef = useRef(null);
  const [showFullImage, setShowFullImage] = useState(false);

  const toForm = (u) => ({
    name:    u?.name    || '',
    email:   u?.email   || '',
    phone:   u?.phone   || '',
    company: u?.company || '',
    address: u?.address || '',
  });

  // Refresh the auth store (same as the freelancer profile) so the sidebar/header
  // show the new name and photo.
  const syncStore = async () => {
    try { await init?.(); } catch { /* non-fatal */ }
  };

  useEffect(() => {
    if (!userId) { setLoadingProfile(false); return; }
    api.get(`/users/${userId}`)
      .then(({ data }) => {
        setProfile(data.user);
        setForm(toForm(data.user));
      })
      .catch(() => {
        // Fall back to whatever the store already knows
        setProfile(user || null);
        setForm(toForm(user));
        toast.error('Could not load your latest profile details');
      })
      .finally(() => setLoadingProfile(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const dirty = profile
    ? Object.keys(EMPTY).some(k => (form[k] || '') !== (profile[k] || ''))
    : false;

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.email.trim()) return toast.error('Email is required');
    setSavingProfile(true);
    try {
      const { data } = await api.put('/users/profile', {
        name:    form.name.trim(),
        email:   form.email.trim(),
        phone:   form.phone.trim(),
        company: form.company.trim(),
        address: form.address.trim(),
      });
      setProfile(data.user);
      setForm(toForm(data.user));
      syncStore(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be 5 MB or smaller');

    const body = new FormData();
    body.append('avatar', file);
    setAvatarBusy(true);
    try {
      const { data } = await api.post('/users/profile/avatar', body);
      setProfile(data.user);
      syncStore(data.user);
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      const { data } = await api.delete('/users/profile/avatar');
      setProfile(data.user);
      syncStore(data.user);
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove photo');
    } finally {
      setAvatarBusy(false);
    }
  };

  // ── Theme (light / dark) ───────────────────────────────────────────────────
  const { theme, toggle: toggleTheme } = useTheme('client');

  // ── Email notification preference ──────────────────────────────────────────
  const [enabled, setEnabled] = useState(null); // null = not loaded yet
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs]   = useState(false);
  const [prefsError, setPrefsError]     = useState('');

  useEffect(() => {
    api.get('/notification-preferences')
      .then(({ data }) => {
        if (data.success) setEnabled(data.emailNotificationsEnabled);
        else setPrefsError(data.message || 'Failed to load preferences');
      })
      .catch(err => setPrefsError(err.response?.data?.message || 'Failed to load preferences'))
      .finally(() => setLoadingPrefs(false));
  }, []);

  const togglePrefs = async () => {
    if (enabled === null || savingPrefs) return;
    setSavingPrefs(true);
    setPrefsError('');
    try {
      const { data } = await api.patch('/notification-preferences', { emailNotificationsEnabled: !enabled });
      if (data.success) setEnabled(data.emailNotificationsEnabled);
      else setPrefsError(data.message || 'Failed to update preference');
    } catch (err) {
      setPrefsError(err.response?.data?.message || 'Failed to update preference');
    } finally {
      setSavingPrefs(false);
    }
  };

  // ── Account deletion (email code verification) ────────────────────────────
  // Projects in these statuses are finished, so they don't block deletion.
  // Anything else (inquiries, quotations, confirmed, in progress, unpaid balance…) does.
  const FINISHED_STATUSES = ['completed_paid', 'cancelled'];
  const [activeEvents, setActiveEvents] = useState(null); // null = unknown / not loaded
  const [delOpen, setDelOpen]   = useState(false);
  const [delStep, setDelStep]   = useState('confirm');     // 'confirm' | 'code'
  const [delCode, setDelCode]   = useState('');
  const [delBusy, setDelBusy]   = useState(false);
  const [delError, setDelError] = useState('');
  const [resendIn, setResendIn] = useState(0);

  // Pre-check so the button can be disabled up front. The server enforces the same rule.
  useEffect(() => {
    api.get('/events')
      .then(({ data }) => setActiveEvents((data.events || []).filter(e => !FINISHED_STATUSES.includes(e.status))))
      .catch(() => setActiveEvents(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const hasActiveEvents = (activeEvents?.length || 0) > 0;

  const openDelete = () => {
    setDelStep('confirm'); setDelCode(''); setDelError(''); setResendIn(0);
    setDelOpen(true);
  };
  const closeDelete = () => { if (!delBusy) setDelOpen(false); };

  const sendDeleteCode = async () => {
    setDelBusy(true); setDelError('');
    try {
      await api.post('/users/account/delete-request');
      setDelStep('code'); setDelCode(''); setResendIn(60);
      toast.success('Verification code sent to your email');
    } catch (err) {
      setDelError(err.response?.data?.message || 'Could not send the verification code');
    } finally {
      setDelBusy(false);
    }
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(delCode)) return setDelError('Enter the 6-digit code from your email');
    setDelBusy(true); setDelError('');
    try {
      await api.delete('/users/account', { data: { code: delCode } });
      toast.success('Your account has been deleted');
      try { await store.logout?.(); } catch { /* account is already gone */ }
      window.location.href = '/login';
    } catch (err) {
      setDelError(err.response?.data?.message || 'Failed to delete account');
      setDelBusy(false);
    }
  };

  const shown = profile || user;
  const initial = (shown?.name || '?')[0]?.toUpperCase();
  // New avatars are absolute Cloudinary URLs; only old relative '/uploads/...' paths
  // need the backend origin prepended (same handling as the freelancer profile).
  const API_ORIGIN = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
  const avatarSrc = shown?.avatar
    ? (/^https?:\/\//i.test(shown.avatar) ? shown.avatar : `${API_ORIGIN}${shown.avatar}`)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-white/40 text-sm mt-1">{shown?.name} · {shown?.email}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* ── Details ─────────────────────────────────────────────────────── */}
      <div className="card lg:col-span-2">
        <h3 className="section-title mb-4">Your details</h3>

        {loadingProfile ? (
          <div className="space-y-4" aria-busy="true">
            <div className="flex items-center gap-4">
              <Bone className="w-16 h-16 rounded-full" />
              <Bone className="h-8 w-32" />
            </div>
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={saveProfile} className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              {avatarSrc ? (
                <div className="relative flex-shrink-0">
                  <img src={avatarSrc} alt="Profile" onClick={() => setShowFullImage(true)}
                    className="w-16 h-16 rounded-full object-cover border border-white/10 cursor-zoom-in" />
                  <button type="button" onClick={() => setShowFullImage(true)}
                    title="View full size" aria-label="View photo full size"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-dark-800 border border-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors">
                    <Maximize2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
                  {initial}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={avatarBusy}
                  className="btn-secondary text-sm disabled:opacity-50">
                  <Camera className="w-4 h-4" /> {avatarBusy ? 'Working...' : shown?.avatar ? 'Change photo' : 'Upload photo'}
                </button>
                {shown?.avatar && (
                  <button type="button" onClick={removeAvatar} disabled={avatarBusy}
                    className="btn-secondary text-sm text-red-400 hover:text-red-300 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={form.name} required
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} required
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Company <span className="text-white/30 font-normal">(optional)</span></label>
                <input className="input" value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="label">Address <span className="text-white/30 font-normal">(optional)</span></label>
              <textarea className="input min-h-[70px]" value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={savingProfile || !dirty}
                className="btn-primary text-sm disabled:opacity-50">
                <Save className="w-4 h-4" /> {savingProfile ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Right column ────────────────────────────────────────────────── */}
      <div className="space-y-6">

      {/* Account summary */}
      <div className="card">
        <h3 className="section-title mb-4">Account</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-white/40">Role</dt>
            <dd className="text-white capitalize">{shown?.role || 'client'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-white/40">Member since</dt>
            <dd className="text-white">{shown?.createdAt ? formatDate(shown.createdAt) : '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-white/40">Status</dt>
            <dd>
              <span className={`badge ${shown?.isActive === false ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                {shown?.isActive === false ? 'Inactive' : 'Active'}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Notifications ───────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="section-title mb-4">Notifications</h3>

        {loadingPrefs ? (
          <div className="flex items-start justify-between gap-3" aria-busy="true">
            <div className="flex gap-2.5 flex-1">
              <Bone className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-36" />
                <Bone className="h-3 w-full max-w-sm" />
                <Bone className="h-3 w-2/3 max-w-sm" />
              </div>
            </div>
            <Bone className="h-6 w-11 rounded-full shrink-0" />
          </div>
        ) : enabled === null ? (
          <p className="text-red-400 text-sm">{prefsError || 'Could not load your preferences.'}</p>
        ) : (
          <>
            {prefsError && <p className="text-red-400 text-xs mb-3">{prefsError}</p>}
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
                type="button"
                onClick={togglePrefs}
                disabled={savingPrefs}
                aria-pressed={enabled}
                aria-label="Toggle email notifications"
                style={{ width: '44px', height: '24px' }}
                className={`relative rounded-full transition-colors flex-shrink-0 overflow-hidden ${
                  enabled ? 'bg-green-500' : 'bg-white/20'
                } ${savingPrefs ? 'opacity-50' : ''}`}
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

      {/* ── Theme ───────────────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="section-title mb-1">Theme</h3>
        <p className="text-white/40 text-xs mb-3">Choose how OneTake looks for you.</p>
        <div className="grid grid-cols-2 gap-2">
          {[['dark', 'Dark', Moon], ['light', 'Light', Sun]].map(([value, label, Icon]) => (
            <button key={value} type="button"
              onClick={() => { if (theme !== value) toggleTheme(); }}
              aria-pressed={theme === value}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors
                ${theme === value
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-white/10 text-white/60 hover:bg-white/5'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Delete account ──────────────────────────────────────────────── */}
      <div className="card border border-red-500/20">
        <h3 className="section-title mb-1 text-red-400">Delete account</h3>
        <p className="text-white/40 text-xs mb-3">
          Permanently delete your account and personal data. This can't be undone.
        </p>
        {hasActiveEvents && (
          <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              You have {activeEvents.length} active project{activeEvents.length === 1 ? '' : 's'}.
              Your account can only be deleted once all projects are completed or cancelled.
            </span>
          </div>
        )}
        <button type="button" onClick={openDelete} disabled={hasActiveEvents}
          className="btn-secondary text-sm text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center">
          <Trash2 className="w-4 h-4" /> Delete my account
        </button>
      </div>

      </div>
      </div>

      {showFullImage && avatarSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setShowFullImage(false)}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={avatarSrc}
            alt={shown?.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full rounded-xl object-contain cursor-default"
          />
        </div>
      )}
      {delOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={closeDelete}>
          <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-white font-semibold">Delete your account</h3>
              </div>
              <button type="button" onClick={closeDelete} disabled={delBusy} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {delStep === 'confirm' ? (
              <div className="space-y-4">
                <p className="text-white/60 text-sm">
                  This will permanently delete your account and personal data. You won't be able to log in or
                  recover your project history. For your security, we'll email a verification code to{' '}
                  <span className="text-white">{shown?.email}</span>.
                </p>
                {delError && <p className="text-red-400 text-sm">{delError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={closeDelete} disabled={delBusy}>Cancel</button>
                  <button type="button" className="btn-primary text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50"
                    onClick={sendDeleteCode} disabled={delBusy}>
                    {delBusy ? 'Sending...' : 'Send verification code'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={confirmDelete} className="space-y-4">
                <p className="text-white/60 text-sm">
                  Enter the 6-digit code we sent to <span className="text-white">{shown?.email}</span>. It expires shortly.
                </p>
                <input
                  className="input text-center text-2xl tracking-[0.5em] font-mono"
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                  placeholder="······" value={delCode}
                  onChange={e => { setDelCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setDelError(''); }}
                />
                {delError && <p className="text-red-400 text-sm">{delError}</p>}
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={sendDeleteCode} disabled={delBusy || resendIn > 0}
                    className="text-sm text-primary hover:underline disabled:text-white/30 disabled:no-underline">
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                  </button>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary text-sm" onClick={closeDelete} disabled={delBusy}>Cancel</button>
                    <button type="submit" disabled={delBusy || delCode.length !== 6}
                      className="btn-primary text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50">
                      {delBusy ? 'Deleting...' : 'Delete account'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}