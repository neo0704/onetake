import React, { useEffect, useState } from 'react';
import { Users, Plus, X, CheckCircle, Phone, MapPin, Calendar, Mail, Pencil } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import toast from 'react-hot-toast';
import { CardGridPageSkeleton } from '../../components/shared/Skeletons';

const AVAIL_CONFIG = {
  available:   { label: 'Available',   cls: 'bg-green-500/20  text-green-400  border-green-500/40'  },
  busy:        { label: 'Busy',         cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  unavailable: { label: 'Unavailable', cls: 'bg-red-500/20    text-red-400    border-red-500/40'    },
  on_leave:    { label: 'On Leave',    cls: 'bg-gray-500/20   text-gray-400   border-gray-500/40'   },
};

// New avatars are absolute Cloudinary URLs (https://res.cloudinary.com/...) and are
// used as-is. Only old-style relative paths like '/uploads/avatars/xxx.jpg' — saved
// before avatar uploads moved to Cloudinary — need the backend origin prepended.
const avatarSrc = (f) => {
  if (!f?.avatar) return null;
  if (/^https?:\/\//i.test(f.avatar)) return f.avatar;
  return `${import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'}${f.avatar}`;
};

function FreelancerCard({ f, onSelect }) {
  const avCfg = AVAIL_CONFIG[f.availability || 'available'];
  const [imgError, setImgError] = useState(false);
  const src = avatarSrc(f);
  return (
    <div className="card cursor-pointer hover:border-white/20 transition-all border border-white/10 active:scale-[0.99]"
      onClick={() => onSelect(f)}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-base sm:text-lg font-black text-primary flex-shrink-0 overflow-hidden">
          {src && !imgError ? (
            <img src={src} alt={f.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            (f.name || 'F')[0].toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold truncate max-w-full">{f.name}</h3>
            <span className={`badge border text-xs ${avCfg.cls}`}>● {avCfg.label}</span>
            {f.rate != null && f.rate !== '' && (
              <span className="badge bg-primary/20 text-primary border border-primary/30 text-xs">
                ₱{Number(f.rate).toLocaleString()}{f.rateType === 'fixed' ? '/project' : '/hr'}
              </span>
            )}
          </div>
          <p className="text-white/50 text-xs mt-0.5 truncate">{f.email}</p>
          {f.phone && (
            <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5 truncate">
              <Phone className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{f.phone}</span>
            </p>
          )}
          {(f.skills || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {f.skills.slice(0, 3).map(s => (
                <span key={s} className="badge bg-primary/10 text-primary/80 text-xs">{s}</span>
              ))}
              {f.skills.length > 3 && (
                <span className="badge bg-white/10 text-white/40 text-xs">+{f.skills.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FreelancerDetailModal({ f, onClose, onEdit }) {
  const [showFullImage, setShowFullImage] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [f?._id]);

  if (!f) return null;
  const avCfg = AVAIL_CONFIG[f.availability || 'available'];
  const src = imgError ? null : avatarSrc(f);

  return (
    <Modal isOpen={!!f} onClose={onClose} title="Freelancer Profile">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl">
          <button
            type="button"
            onClick={() => src && setShowFullImage(true)}
            disabled={!src}
            title={src ? 'View full size' : undefined}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-xl sm:text-2xl font-black text-primary flex-shrink-0 overflow-hidden ${src ? 'cursor-zoom-in hover:opacity-80 transition-opacity' : ''}`}
          >
            {src ? (
              <img src={src} alt={f.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
            ) : (
              (f.name || 'F')[0].toUpperCase()
            )}
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-bold text-base sm:text-lg truncate">{f.name}</h3>
            <p className="text-white/50 text-sm truncate">{f.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`badge border text-xs inline-block ${avCfg.cls}`}>● {avCfg.label}</span>
              {f.rate != null && f.rate !== '' && (
                <span className="badge bg-primary/20 text-primary border border-primary/30 text-xs inline-block">
                  ₱{Number(f.rate).toLocaleString()}{f.rateType === 'fixed' ? ' / project' : ' / hr'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3 text-sm break-words">
          {[
            { label: 'Phone',   value: f.phone   || '—' },
            { label: 'Age',     value: f.age ? `${f.age} yrs` : '—' },
            { label: 'Rate',    value: (f.rate != null && f.rate !== '')
                ? `₱${Number(f.rate).toLocaleString()} ${f.rateType === 'fixed' ? 'per project' : 'per hour'}`
                : '—' },
            { label: 'Address', value: f.address || '—', span: true },
          ].map(({ label, value, span }) => (
            <div key={label} className={span ? 'col-span-2' : ''}>
              <p className="text-white/40 text-xs">{label}</p>
              <p className="text-white mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Skills */}
        {(f.skills || []).length > 0 && (
          <div>
            <p className="text-white/40 text-xs mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {f.skills.map(s => (
                <span key={s} className="badge bg-primary/20 text-primary">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Bio */}
        {f.bio && (
          <div>
            <p className="text-white/40 text-xs mb-1">Bio</p>
            <p className="text-white/70 text-sm leading-relaxed">{f.bio}</p>
          </div>
        )}

        {/* Emergency contact */}
        {(f.emergencyContact || f.emergencyPhone) && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-yellow-400 text-xs font-semibold mb-1">Emergency Contact</p>
            <p className="text-white/70 text-sm">{f.emergencyContact}</p>
            <p className="text-white/50 text-xs">{f.emergencyPhone}</p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Close</button>
          {onEdit && (
            <button onClick={() => onEdit(f)} className="btn-primary flex-1 justify-center">
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
        </div>
      </div>

      {showFullImage && src && (
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
            src={src}
            alt={f.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full rounded-xl object-contain cursor-default"
          />
        </div>
      )}
    </Modal>
  );
}

export default function AdminFreelancers() {
  const [freelancers,  setFreelancers]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAdd,      setShowAdd]      = useState(false);
  const [selectedFree, setSelectedFree] = useState(null);
  const [availFilter,  setAvailFilter]  = useState('all');
  const [form, setForm] = useState({ name: '', email: '', password: '', skills: [], phone: '' });
  const [editing,  setEditing]  = useState(null);   // freelancer being edited
  const [editForm, setEditForm] = useState(null);
  const [saving,   setSaving]   = useState(false);

  const fetch = async () => {
    const { data } = await api.get('/users?role=freelancer');
    // Only show freelancers whose account has been approved. Accounts start
    // as 'pending' until an admin approves them, and can be 'rejected' —
    // neither should appear in the team roster.
    setFreelancers(data.users.filter(f => f.accountStatus === 'active'));
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const addFreelancer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { ...form, role: 'freelancer' });
      toast.success('Freelancer account created!');
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', skills: [], phone: '' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const openEdit = (f) => {
    setSelectedFree(null);   // avoid stacking two modals
    setEditing(f);
    setEditForm({
      name:             f.name || '',
      email:            f.email || '',
      phone:            f.phone || '',
      age:              f.age ?? '',
      address:          f.address || '',
      rate:             f.rate ?? '',
      rateType:         f.rateType || 'hourly',
      skillsText:       (f.skills || []).join(', '),
      bio:              f.bio || '',
      availability:     f.availability || 'available',
      emergencyContact: f.emergencyContact || '',
      emergencyPhone:   f.emergencyPhone || '',
    });
  };

  const closeEdit = () => { setEditing(null); setEditForm(null); };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    try {
      const { skillsText, ...rest } = editForm;
      const payload = {
        ...rest,
        skills: skillsText.split(',').map(s => s.trim()).filter(Boolean),
      };
      const { data } = await api.put(`/freelancers/${editing._id}`, payload);
      const merged = { ...editing, ...data.freelancer };
      setFreelancers(list => list.map(x => (x._id === merged._id ? merged : x)));
      toast.success('Freelancer updated!');
      closeEdit();
      setSelectedFree(merged);   // reopen the profile with the fresh data
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update freelancer');
    } finally {
      setSaving(false);
    }
  };

  const setEdit = (key) => (e) => setEditForm(f => ({ ...f, [key]: e.target.value }));

  const filtered = availFilter === 'all'
    ? freelancers
    : freelancers.filter(f => (f.availability || 'available') === availFilter);

  if (loading) return <CardGridPageSkeleton />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Freelancers" subtitle={`${freelancers.length} team members`}
        action={
          <button onClick={() => setShowAdd(true)} className="btn-primary w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" /> <span className="sm:hidden">Add</span><span className="hidden sm:inline">Add Freelancer</span>
          </button>
        } />

      {/* Availability filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
        {[
          { val: 'all',         label: `All (${freelancers.length})` },
          { val: 'available',   label: `Available (${freelancers.filter(f => (f.availability || 'available') === 'available').length})` },
          { val: 'busy',        label: `Busy (${freelancers.filter(f => f.availability === 'busy').length})` },
          { val: 'unavailable', label: `Unavailable (${freelancers.filter(f => f.availability === 'unavailable').length})` },
          { val: 'on_leave',    label: `On Leave (${freelancers.filter(f => f.availability === 'on_leave').length})` },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => setAvailFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0
              ${availFilter === val ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No freelancers found"
          description={availFilter === 'all' ? 'Add freelancers to build your team' : `No freelancers with status "${availFilter}"`} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map(f => (
            <FreelancerCard key={f._id} f={f} onSelect={setSelectedFree} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <FreelancerDetailModal f={selectedFree} onClose={() => setSelectedFree(null)} onEdit={openEdit} />

      {/* Add freelancer modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Freelancer">
        <form onSubmit={addFreelancer} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+63 9XX XXX XXXX" />
          </div>
          <div>
            <label className="label">Temporary Password *</label>
            <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <p className="text-white/30 text-xs">The freelancer can update their profile after logging in.</p>
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">Create Account</button>
          </div>
        </form>
      </Modal>

      {/* Edit freelancer modal */}
      <Modal isOpen={!!editing} onClose={closeEdit} title="Edit Freelancer">
        {editForm && (
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={editForm.name} onChange={setEdit('name')} required />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={editForm.email} onChange={setEdit('email')} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={editForm.phone} onChange={setEdit('phone')} placeholder="+63 9XX XXX XXXX" />
              </div>
              <div>
                <label className="label">Age</label>
                <input type="number" min="0" className="input" value={editForm.age} onChange={setEdit('age')} />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={editForm.address} onChange={setEdit('address')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Rate (₱)</label>
                <input type="number" min="0" className="input" value={editForm.rate} onChange={setEdit('rate')} />
              </div>
              <div>
                <label className="label">Rate Type</label>
                <select className="input" value={editForm.rateType} onChange={setEdit('rateType')}>
                  <option value="hourly">Per hour</option>
                  <option value="fixed">Per project</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Availability</label>
              <select className="input" value={editForm.availability} onChange={setEdit('availability')}>
                {Object.entries(AVAIL_CONFIG).map(([val, { label }]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Skills</label>
              <input className="input" value={editForm.skillsText} onChange={setEdit('skillsText')}
                placeholder="Photography, Videography, Editing" />
              <p className="text-white/30 text-xs mt-1">Separate skills with commas.</p>
            </div>
            <div>
              <label className="label">Bio</label>
              <textarea className="input min-h-[80px]" value={editForm.bio} onChange={setEdit('bio')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Emergency Contact</label>
                <input className="input" value={editForm.emergencyContact} onChange={setEdit('emergencyContact')} />
              </div>
              <div>
                <label className="label">Emergency Phone</label>
                <input className="input" value={editForm.emergencyPhone} onChange={setEdit('emergencyPhone')} />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button type="button" onClick={closeEdit} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}