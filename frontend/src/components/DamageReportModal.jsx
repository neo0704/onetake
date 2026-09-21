import React, { useState } from 'react';
import { AlertTriangle, X, Camera } from 'lucide-react';
import api from '../services/api';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const DAMAGE_TYPES = [
  { value:'minor',     label:'Minor Damage',  desc:'Scratches / dents — still functional',    cls:'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' },
  { value:'major',     label:'Major Damage',  desc:'Significant — needs repair before reuse', cls:'text-orange-400 bg-orange-500/20 border-orange-500/30' },
  { value:'destroyed', label:'Destroyed',     desc:'Beyond repair — cannot be used again',    cls:'text-red-400    bg-red-500/20    border-red-500/30'    },
  { value:'lost',      label:'Lost / Missing',desc:'Equipment unaccounted for',                cls:'text-red-400    bg-red-500/20    border-red-500/30'    },
];

export default function DamageReportModal({ event, onClose, onSubmitted }) {
  // Build equipment + freelancer pairs from assignedFreelancers
  const pairs = [];
  (event.assignedFreelancers || []).forEach(af => {
    const frName = af.freelancer?.name || 'Unknown';
    const frId   = af.freelancer?._id  || af.freelancer;
    (af.equipment || []).forEach(eq => {
      const eqObj  = eq.equipment;
      const eqName = typeof eqObj === 'object' ? eqObj?.name : 'Equipment';
      const eqId   = typeof eqObj === 'object' ? eqObj?._id : eqObj;
      if (eqId) pairs.push({ frId, frName, eqId, eqName: eqName || 'Equipment' });
    });
  });

  const [pairIdx,    setPairIdx]    = useState(pairs.length === 1 ? 0 : '');
  const [dmgType,    setDmgType]    = useState('');
  const [desc,       setDesc]       = useState('');
  const [cost,       setCost]       = useState('');
  const [deduct,     setDeduct]     = useState(false);
  const [photos,     setPhotos]     = useState([]);
  const [previews,   setPreviews]   = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const addPhoto = (file) => {
    if (!file) return;
    setPhotos(p => [...p, file]);
    const r = new FileReader();
    r.onload = e => setPreviews(p => [...p, e.target.result]);
    r.readAsDataURL(file);
  };
  const removePhoto = (i) => {
    setPhotos(p => p.filter((_,idx) => idx !== i));
    setPreviews(p => p.filter((_,idx) => idx !== i));
  };

  const pair = pairIdx !== '' ? pairs[pairIdx] : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!pair)   { toast.error('Select the damaged equipment'); return; }
    if (!dmgType){ toast.error('Select damage type'); return; }
    if (!desc.trim()){ toast.error('Describe the damage'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('eventId',           event._id);
      fd.append('equipmentId',       pair.eqId);
      fd.append('freelancerId',      pair.frId);
      fd.append('damageType',        dmgType);
      fd.append('description',       desc);
      fd.append('repairCost',        cost || '0');
      fd.append('deductFromPayroll', deduct ? 'true' : 'false');
      photos.forEach(f => fd.append('photos', f));

      await api.post('/damage-reports', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

      toast.success('Damage report filed. Equipment status updated. Freelancer notified.');
      onSubmitted?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg my-8 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-white font-bold">Report Equipment Damage</h2>
              <p className="text-white/40 text-xs">{event.eventName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">

          {/* Equipment selector */}
          <div>
            <label className="label">Which equipment was damaged? *</label>
            {pairs.length === 0 ? (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-yellow-400 text-sm">No equipment was assigned to this event.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pairs.map((p, idx) => (
                  <div key={idx} onClick={() => setPairIdx(idx)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                      ${pairIdx === idx ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                      ${pairIdx === idx ? 'border-red-400 bg-red-400' : 'border-white/30'}`}>
                      {pairIdx === idx && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${pairIdx === idx ? 'text-white' : 'text-white/70'}`}>{p.eqName}</p>
                      <p className="text-white/40 text-xs">Used by: {p.frName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Damage type */}
          <div>
            <label className="label">Damage Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {DAMAGE_TYPES.map(dt => (
                <div key={dt.value} onClick={() => setDmgType(dt.value)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all
                    ${dmgType === dt.value ? dt.cls : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <p className={`text-sm font-semibold ${dmgType === dt.value ? '' : 'text-white/70'}`}>{dt.label}</p>
                  <p className={`text-xs mt-0.5 ${dmgType === dt.value ? 'opacity-80' : 'text-white/40'}`}>{dt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Damage Description *</label>
            <textarea className="input min-h-[80px]"
              placeholder="Describe exactly what happened and the extent of the damage..."
              value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          {/* Photos */}
          <div>
            <label className="label">Photos <span className="text-white/30">(up to 5)</span></label>
            <div className="grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={src} alt="" className="w-full h-full object-cover rounded-xl" />
                  <button type="button" onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <label className="aspect-square border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors">
                  <Camera className="w-5 h-5 text-white/30" />
                  <span className="text-white/30 text-xs mt-1">Add</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => addPhoto(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>

          {/* Repair cost */}
          <div>
            <label className="label">Estimated Repair Cost (₱)</label>
            <input type="number" min="0" step="0.01" className="input" placeholder="0.00"
              value={cost} onChange={e => setCost(e.target.value)} />
          </div>

          {/* Deduct from payroll */}
          {cost && parseFloat(cost) > 0 && (
            <div onClick={() => setDeduct(d => !d)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                ${deduct ? 'border-orange-500/40 bg-orange-500/10' : 'border-white/10 bg-white/5'}`}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                ${deduct ? 'border-orange-400 bg-orange-400' : 'border-white/30'}`}>
                {deduct && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <div>
                <p className={`text-sm font-medium ${deduct ? 'text-orange-300' : 'text-white/70'}`}>
                  Deduct repair cost from freelancer payroll
                </p>
                <p className="text-white/40 text-xs">
                  {deduct
                    ? `₱${parseFloat(cost).toLocaleString()} will be deducted from ${pair?.frName || 'freelancer'}'s next payroll`
                    : 'Admin will absorb the repair cost'}
                </p>
              </div>
            </div>
          )}

          {/* Impact notice */}
          {dmgType && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs space-y-1">
              <p className="text-red-400 font-semibold">After submitting:</p>
              <p className="text-red-400/80">
                {['destroyed','lost'].includes(dmgType)
                  ? 'Equipment will be marked as Retired — removed from the active inventory.'
                  : 'Equipment will be marked as Under Maintenance until resolved.'}
              </p>
              <p className="text-red-400/80">The freelancer will be notified of this damage report.</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit"
              disabled={submitting || !pair || !dmgType || !desc.trim()}
              className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold
                         flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <AlertTriangle className="w-4 h-4" />
              {submitting ? 'Filing Report...' : 'File Damage Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
