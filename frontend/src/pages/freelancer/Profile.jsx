import React, { useEffect, useState } from 'react';
import {
  User, Mail, Phone, MapPin, Calendar, Save, Edit3, X,
  CheckCircle, Facebook, Instagram, AlertCircle, DollarSign, KeyRound, Camera, Maximize2
} from 'lucide-react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { LoadingSpinner } from '../../components/shared';
import ChangePasswordModal from '../../components/shared/ChangePasswordModal';
import toast from 'react-hot-toast';

const SKILLS = [
  'Camera Operator', 'Videographer', 'Photographer',
  'Livestream Operator', 'Video Editor', 'Audio Engineer',
  'Lighting Technician', 'Technical Director', 'Drone Pilot',
  'Stream Operator', 'Director of Photography',
];

const AVAIL_OPTIONS = [
  { value: 'available',   label: '● Available',   cls: 'border-green-500  bg-green-500/20  text-green-400'  },
  { value: 'unavailable', label: '● Unavailable',  cls: 'border-red-500    bg-red-500/20    text-red-400'    },
];

export default function FreelancerProfile() {
  const { user, init } = useAuthStore();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [editMode,  setEditMode]  = useState(false);
  const [profile,   setProfile]   = useState(null);
  const [form,      setForm]      = useState({});
  const [showChangePw, setShowChangePw] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const avatarInputRef = React.useRef(null);

  const handleAvatarRemove = async () => {
    setUploadingAvatar(true);
    try {
      await api.delete('/users/profile/avatar');
      setProfile(p => ({ ...p, avatar: '' }));
      await init();
      toast.success('Profile picture removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so selecting the same file again still fires onChange
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.post('/users/profile/avatar', formData);
      setProfile(p => ({ ...p, avatar: data.avatar }));
      await init(); // refresh auth store so sidebar/header reflect the new avatar too
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const loadProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      const u = data.user;
      setProfile(u);
      setForm({
        name:             u.name             || '',
        email:            u.email            || '',
        phone:            u.phone            || '',
        address:          u.address          || '',
        age:              u.age              || '',
        bio:              u.bio              || '',
        skills:           u.skills           || [],
        availability:     u.availability     || 'available',
        rate:             u.rate             ?? '',
        rateType:         u.rateType         || 'hourly',
        emergencyContact: u.emergencyContact || '',
        emergencyPhone:   u.emergencyPhone   || '',
        socialFacebook:   u.socialFacebook   || '',
        socialInstagram:  u.socialInstagram  || '',
      });
    } catch {
      toast.error('Failed to load profile');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadProfile(); }, []);

  const toggleSkill = (skill) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter(s => s !== skill)
        : [...f.skills, skill],
    }));
  };

  // ── Set availability immediately (no edit mode needed) ─────────────────────
  const setAvailability = async (val) => {
    try {
      const { data } = await api.put('/users/profile', { availability: val });
      setProfile(p => ({ ...p, availability: val }));
      setForm(f => ({ ...f, availability: val }));
      await init();  // refresh auth store so header reflects change
      toast.success(`Status set to "${val.replace('_', ' ')}"`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  // ── Set rate immediately (no edit mode needed) ──────────────────────────────
  const [rateInput, setRateInput] = useState('');
  const [rateTypeInput, setRateTypeInput] = useState('hourly');
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    if (profile) {
      setRateInput(profile.rate ?? '');
      setRateTypeInput(profile.rateType || 'hourly');
    }
  }, [profile]);

  const saveRate = async () => {
    if (rateInput === '' || Number(rateInput) < 0) { toast.error('Enter a valid rate'); return; }
    setSavingRate(true);
    try {
      const { data } = await api.put('/users/profile', { rate: Number(rateInput), rateType: rateTypeInput });
      setProfile(p => ({ ...p, rate: Number(rateInput), rateType: rateTypeInput }));
      setForm(f => ({ ...f, rate: Number(rateInput), rateType: rateTypeInput }));
      await init();
      toast.success('Rate updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update rate');
    } finally { setSavingRate(false); }
  };

  // ── Save full profile ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { data } = await api.put('/users/profile', form);
      setProfile(prev => ({ ...prev, ...data.user }));
      setEditMode(false);
      await init();
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save profile');
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  const avCfg = AVAIL_OPTIONS.find(a => a.value === (profile?.availability || 'available'));
  // New avatars are absolute Cloudinary URLs (https://res.cloudinary.com/...) and are
  // used as-is. Only old-style relative paths like '/uploads/avatars/xxx.jpg' — saved
  // before avatar uploads moved to Cloudinary — need the backend origin prepended.
  const API_ORIGIN = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
  const avatarSrc = profile?.avatar
    ? (/^https?:\/\//i.test(profile.avatar) ? profile.avatar : `${API_ORIGIN}${profile.avatar}`)
    : null;

  return (
    <div className="space-y-5 animate-fade-in max-w-6xl">

      {/* ── Hero card ── */}
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(233,69,96,0.6) 0%, transparent 60%)' }} />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change profile picture"
                  className="relative w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-2xl font-black text-primary overflow-hidden group"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={profile?.name} className="w-full h-full object-cover" />
                  ) : (
                    (profile?.name || 'F')[0].toUpperCase()
                  )}
                  <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity
                    ${uploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {uploadingAvatar
                      ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <Camera className="w-5 h-5 text-white" />}
                  </div>
                </button>
                {avatarSrc && !uploadingAvatar && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowFullImage(true); }}
                    title="View full size"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-dark-800 border border-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  >
                    <Maximize2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              {avatarSrc && !uploadingAvatar && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  className="text-white/30 hover:text-red-400 text-[11px] transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-black text-xl leading-tight break-words">{profile?.name}</h1>
              <p className="text-white/50 text-sm truncate">{profile?.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`badge border ${avCfg?.cls}`}>{avCfg?.label}</span>
                {profile?.rate != null && profile?.rate !== '' && (
                  <span className="badge bg-primary/20 text-primary border border-primary/30">
                    ₱{Number(profile.rate).toLocaleString()}{profile.rateType === 'fixed' ? ' / project' : ' / hr'}
                  </span>
                )}
                {(profile?.skills || []).slice(0, 3).map(s => (
                  <span key={s} className="badge bg-white/10 text-white/60 text-xs">{s}</span>
                ))}
                {(profile?.skills || []).length > 3 && (
                  <span className="badge bg-white/10 text-white/40 text-xs">+{profile.skills.length - 3} more</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 self-start sm:self-auto">
            <button onClick={() => setShowChangePw(true)} className="btn-secondary text-sm">
              <KeyRound className="w-4 h-4" /> Change Password
            </button>
            <button onClick={() => setEditMode(!editMode)}
              className={`btn-secondary text-sm ${editMode ? 'bg-red-500/10 text-red-400 border-red-500/30' : ''}`}>
              {editMode ? <><X className="w-4 h-4" /> Cancel</> : <><Edit3 className="w-4 h-4" /> Edit Profile</>}
            </button>
          </div>
        </div>
      </div>

      <ChangePasswordModal isOpen={showChangePw} onClose={() => setShowChangePw(false)} />

      {/* ── Two-column body: main content (left) + sidebar (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* ══ LEFT / MAIN COLUMN ══ */}
        <div className="lg:col-span-2 space-y-5">

          {!editMode ? (
            <>
              <div className="card">
                <h3 className="section-title mb-4">Personal Information</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  {[
                    { icon: User,     label: 'Full Name',    value: profile?.name },
                    { icon: Mail,     label: 'Email',        value: profile?.email },
                    { icon: Phone,    label: 'Phone',        value: profile?.phone || '—' },
                    { icon: MapPin,   label: 'Address',      value: profile?.address || '—' },
                    { icon: Calendar, label: 'Age',          value: profile?.age ? `${profile.age} years old` : '—' },
                    { icon: DollarSign, label: 'Rate',       value: (profile?.rate != null && profile?.rate !== '')
                        ? `₱${Number(profile.rate).toLocaleString()} ${profile.rateType === 'fixed' ? 'per project' : 'per hour'}`
                        : '—' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 py-2 border-b border-white/5">
                      <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-white/40" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white/40 text-xs">{label}</p>
                        <p className="text-white text-sm mt-0.5 truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </dl>
                {profile?.bio && (
                  <div className="pt-3 mt-1 border-t border-white/5">
                    <p className="text-white/40 text-xs mb-1">Bio</p>
                    <p className="text-white/70 text-sm leading-relaxed">{profile.bio}</p>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="section-title mb-3">Skills & Expertise</h3>
                {(profile?.skills || []).length === 0
                  ? <p className="text-white/30 text-sm">No skills added — click "Edit Profile" to add</p>
                  : (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map(s => (
                        <span key={s} className="badge bg-primary/20 text-primary">{s}</span>
                      ))}
                    </div>
                  )}
              </div>
            </>
          ) : (
            <>
              <div className="card">
                <h3 className="section-title mb-4">Edit Personal Information</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Full Name *</label>
                      <input className="input" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Age</label>
                      <input type="number" min="18" max="70" className="input" value={form.age}
                        onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="e.g. 25" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Rate</label>
                      <input type="number" min="0" className="input" placeholder="e.g. 500" value={form.rate}
                        onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Rate Type</label>
                      <select className="input" value={form.rateType}
                        onChange={e => setForm(f => ({ ...f, rateType: e.target.value }))}>
                        <option value="hourly">Per Hour</option>
                        <option value="fixed">Per Project</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Email Address *</label>
                      <input type="email" className="input" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Phone Number</label>
                      <input type="tel" className="input" placeholder="+63 9XX XXX XXXX" value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Home Address</label>
                    <textarea className="input min-h-[70px]" placeholder="Street, Barangay, City, Province"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Bio</label>
                    <textarea className="input min-h-[80px]" placeholder="Tell us about your experience..."
                      value={form.bio}
                      onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="section-title mb-3">Skills & Expertise</h3>
                <p className="text-white/40 text-xs mb-3">Select all that apply</p>
                <div className="flex flex-wrap gap-2">
                  {SKILLS.map(skill => {
                    const sel = form.skills.includes(skill);
                    return (
                      <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all
                          ${sel
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white'}`}>
                        {sel && <CheckCircle className="w-3.5 h-3.5 inline mr-1" />}
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save / Cancel stays with the main form content it belongs to */}
              <div className="flex gap-3 pb-2">
                <button type="button" onClick={() => setEditMode(false)} className="btn-secondary flex-1 justify-center">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ══ RIGHT / SIDEBAR COLUMN ══ */}
        <div className="lg:col-span-1 space-y-5">

          {/* Availability quick-set */}
          <div className="card">
            <h3 className="section-title mb-1">My Availability</h3>
            <p className="text-white/40 text-xs mb-3">Visible to admin when assigning project teams</p>
            <div className="grid grid-cols-2 gap-2">
              {AVAIL_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setAvailability(opt.value)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                    ${(profile?.availability || 'available') === opt.value
                      ? opt.cls
                      : 'border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/20'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rate quick-set */}
          <div className="card">
            <h3 className="section-title mb-1">My Rate</h3>
            <p className="text-white/40 text-xs mb-3">Shown to admin/clients when reviewing your profile</p>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <span className="text-white/30 absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none">₱</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input pl-8"
                  placeholder="e.g. 500"
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                />
              </div>
              <select
                className="input"
                value={rateTypeInput}
                onChange={e => setRateTypeInput(e.target.value)}
              >
                <option value="hourly">Per Hour</option>
                <option value="fixed">Per Project</option>
              </select>
              <button
                type="button"
                onClick={saveRate}
                disabled={savingRate}
                className="btn-primary justify-center"
              >
                {savingRate ? 'Saving...' : 'Save Rate'}
              </button>
            </div>
          </div>

          {!editMode ? (
            <>
              <div className="card">
                <h3 className="section-title mb-3">Emergency Contact</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/40">Name</span>
                    <span className="text-white text-right">{profile?.emergencyContact || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-white/40">Phone</span>
                    <span className="text-white text-right">{profile?.emergencyPhone || '—'}</span>
                  </div>
                </div>
              </div>

              {(profile?.socialFacebook || profile?.socialInstagram) && (
                <div className="card">
                  <h3 className="section-title mb-3">Social Media</h3>
                  <div className="space-y-2">
                    {profile.socialFacebook && (
                      <a href={profile.socialFacebook} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 text-primary text-sm hover:underline">
                        <Facebook className="w-4 h-4" /> Facebook Profile
                      </a>
                    )}
                    {profile.socialInstagram && (
                      <a href={profile.socialInstagram} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 text-pink-400 text-sm hover:underline">
                        <Instagram className="w-4 h-4" /> Instagram Profile
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="card">
                <h3 className="section-title mb-4">Emergency Contact</h3>
                <div className="space-y-3">
                  <div>
                    <label className="label">Contact Name</label>
                    <input className="input" placeholder="Full name" value={form.emergencyContact}
                      onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Contact Phone</label>
                    <input type="tel" className="input" placeholder="+63 9XX XXX XXXX" value={form.emergencyPhone}
                      onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="section-title mb-4">Social Media <span className="text-white/30 font-normal text-sm">(Optional)</span></h3>
                <div className="space-y-3">
                  <div>
                    <label className="label"><Facebook className="w-4 h-4 inline mr-1" /> Facebook URL</label>
                    <input className="input" placeholder="https://facebook.com/yourname" value={form.socialFacebook}
                      onChange={e => setForm(f => ({ ...f, socialFacebook: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label"><Instagram className="w-4 h-4 inline mr-1" /> Instagram URL</label>
                    <input className="input" placeholder="https://instagram.com/yourname" value={form.socialInstagram}
                      onChange={e => setForm(f => ({ ...f, socialInstagram: e.target.value }))} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pb-8" />

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
            alt={profile?.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full rounded-xl object-contain cursor-default"
          />
        </div>
      )}
    </div>
  );
}