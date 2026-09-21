import React, { useEffect, useState, useMemo } from 'react';
import {
  Wrench, AlertTriangle, History, Plus, Search, CheckCircle,
  Tag, Package, Edit3, Save, X, Trash2, PowerOff,
  ChevronDown, AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import { formatDate, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── Constants ────────────────────────────────────────────────────────────────
const AVAIL_COLORS = {
  available:   'bg-green-500/20 text-green-400',
  in_use:      'bg-blue-500/20  text-blue-400',
  maintenance: 'bg-yellow-500/20 text-yellow-400',
  retired:     'bg-red-500/20   text-red-400',
};
const DAMAGE_COLORS = {
  open:         'bg-red-500/20    text-red-400',
  under_review: 'bg-yellow-500/20 text-yellow-400',
  resolved:     'bg-green-500/20  text-green-400',
};
const DAMAGE_TYPE_COLORS = {
  minor:     'text-yellow-400',
  major:     'text-orange-400',
  destroyed: 'text-red-400',
  lost:      'text-red-400',
};
const CONDITION_COLORS = {
  excellent:    'bg-green-500/20 text-green-400',
  good:         'bg-green-500/20 text-green-400',
  fair:         'bg-yellow-500/20 text-yellow-400',
  needs_repair: 'bg-red-500/20 text-red-400',
};

// ── Helper: build a global map of serialNumber → equipment info ──────────────
function buildGlobalSerialMap(allEquipment, excludeId = null) {
  const map = {};
  allEquipment.forEach(eq => {
    if (eq._id === excludeId) return;
    (eq.serialNumbers || []).forEach((sn, i) => {
      if (sn && sn.trim()) {
        map[sn.trim().toLowerCase()] = { equipmentName: eq.name, unitIndex: i + 1 };
      }
    });
  });
  return map;
}

// ── Checkbox icons ────────────────────────────────────────────────────────────
function CheckboxIcon({ checked, indeterminate }) {
  if (checked || indeterminate) {
    return (
      <span className={`inline-flex w-4 h-4 rounded border-2 items-center justify-center flex-shrink-0
        ${indeterminate ? 'border-primary/60 bg-primary/30' : 'border-primary bg-primary'}`}>
        {checked && !indeterminate && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
        {indeterminate && <span className="text-primary text-[10px] font-bold leading-none">−</span>}
      </span>
    );
  }
  return <span className="inline-flex w-4 h-4 rounded border-2 border-white/20 flex-shrink-0" />;
}

// ── Equipment Detail Modal ───────────────────────────────────────────────────
function EquipmentDetailModal({ equipment: eq, allEquipment, isOpen, onClose, onUpdate }) {
  const [editing,             setEditing]             = useState(false);
  const [editForm,            setEditForm]            = useState({});
  const [serialNumbers,       setSerialNumbers]       = useState([]);
  const [unitConditions,      setUnitConditions]      = useState([]);
  const [unitAvailabilities,  setUnitAvailabilities]  = useState([]);
  const [savingSerials,       setSavingSerials]       = useState(false);
  const [savingUnitDetails,   setSavingUnitDetails]   = useState(false);
  const [savingEdit,          setSavingEdit]          = useState(false);
  const [serialsDirty,        setSerialsDirty]        = useState(false);
  const [unitDetailsDirty,    setUnitDetailsDirty]    = useState(false);
  const [showRetireConfirm,   setShowRetireConfirm]   = useState(false);
  const [showDeleteConfirm,   setShowDeleteConfirm]   = useState(false);
  const [actioning,           setActioning]           = useState(false);

  useEffect(() => {
    if (!eq) return;
    setEditForm({
      name:         eq.name,
      category:     eq.category,
      condition:    eq.condition,
      availability: eq.availability,
      quantity:     eq.quantity,
      description:  eq.description || '',
    });
    const qty = eq.quantity || 1;
    const existingSerials = eq.serialNumbers || [];
    setSerialNumbers(Array.from({ length: qty }, (_, i) => existingSerials[i] || ''));

    const existingConds = eq.unitConditions || [];
    setUnitConditions(Array.from({ length: qty }, (_, i) => existingConds[i] || eq.condition || 'good'));

    const existingAvails = eq.unitAvailabilities || [];
    setUnitAvailabilities(Array.from({ length: qty }, (_, i) => existingAvails[i] || eq.availability || 'available'));

    setSerialsDirty(false);
    setUnitDetailsDirty(false);
    setEditing(false);
    setShowRetireConfirm(false);
    setShowDeleteConfirm(false);
  }, [eq]);

  const globalSerialMap = useMemo(
    () => buildGlobalSerialMap(allEquipment, eq?._id),
    [allEquipment, eq?._id]
  );

  if (!eq) return null;

  const qty = eq.quantity || 1;

  // Per-slot serial error messages
  const serialErrors = serialNumbers.map((sn, i) => {
    if (!sn.trim()) return null;
    const lower = sn.trim().toLowerCase();
    const withinDupe = serialNumbers.findIndex((s, j) => j !== i && s.trim().toLowerCase() === lower);
    if (withinDupe !== -1) return `Same as Unit #${withinDupe + 1} on this item`;
    const crossDupe = globalSerialMap[lower];
    if (crossDupe) return `Already assigned to "${crossDupe.equipmentName}" Unit #${crossDupe.unitIndex}`;
    return null;
  });
  const hasSerialErrors = serialErrors.some(Boolean);

  const handleSerialChange = (i, value) => {
    setSerialNumbers(prev => { const n = [...prev]; n[i] = value; return n; });
    setSerialsDirty(true);
  };

  const saveSerials = async () => {
    if (hasSerialErrors) { toast.error('Fix duplicate serial numbers first'); return; }
    setSavingSerials(true);
    try {
      await api.patch(`/equipment/${eq._id}/serials`, { serialNumbers });
      toast.success('Serial numbers saved');
      setSerialsDirty(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save serial numbers');
    } finally { setSavingSerials(false); }
  };

  // Save per-unit conditions AND availabilities together
  const saveUnitDetails = async () => {
    setSavingUnitDetails(true);
    try {
      await api.patch(`/equipment/${eq._id}/unit-details`, { unitConditions, unitAvailabilities });
      toast.success('Unit details saved');
      setUnitDetailsDirty(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save unit details');
    } finally { setSavingUnitDetails(false); }
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      await api.put(`/equipment/${eq._id}`, editForm);
      toast.success('Equipment updated');
      setEditing(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally { setSavingEdit(false); }
  };

  const retireEquipment = async () => {
    setActioning(true);
    try {
      await api.put(`/equipment/${eq._id}`, { availability: 'retired' });
      toast.success(`${eq.name} retired`);
      onUpdate(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to retire');
    } finally { setActioning(false); }
  };

  const deleteEquipment = async () => {
    setActioning(true);
    try {
      await api.delete(`/equipment/${eq._id}`);
      toast.success(`${eq.name} deleted`);
      onUpdate(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally { setActioning(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Equipment Details">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Wrench className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {editing
                ? <input className="input text-base font-semibold" value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                : <h3 className="text-white font-semibold text-base truncate">{eq.name}</h3>}
              <p className="text-white/40 text-xs mt-0.5 capitalize">{eq.category}</p>
            </div>
          </div>
          <button onClick={() => setEditing(v => !v)}
            className={`p-2 rounded-lg transition-colors ${editing
              ? 'bg-white/10 text-white'
              : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}`}>
            {editing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          </button>
        </div>

        {/* Status badges — only for single-unit equipment (multi-unit shows per-unit section) */}
        {!editing && (
          <div className="flex flex-wrap gap-2">
            {qty === 1 ? (
              <>
                <span className={`badge capitalize ${AVAIL_COLORS[eq.availability] || 'bg-gray-500/20 text-gray-400'}`}>
                  {(eq.availability || '').replace('_', ' ')}
                </span>
                <span className={`badge capitalize ${CONDITION_COLORS[eq.condition] || 'bg-gray-500/20 text-gray-400'}`}>
                  {eq.condition?.replace('_', ' ')}
                </span>
              </>
            ) : (
              // For multi-unit: show a summary badge
              <span className="badge bg-white/10 text-white/50 text-xs">
                {unitAvailabilities.filter(a => a === 'available').length} of {qty} available
              </span>
            )}
            <span className="badge bg-white/10 text-white/60">
              <Package className="w-3 h-3 inline mr-1" />
              {qty} unit{qty !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select className="input" value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                  {['lights','sounds','video','photography','other'].map(c => (
                    <option key={c} value={c} className="capitalize bg-[#1a1a2e] text-white">{c}</option>
                  ))}
                </select>
              </div>
              {/* Only show global condition/availability when qty === 1 */}
              {qty === 1 ? (
                <>
                  <div>
                    <label className="label">Condition</label>
                    <select className="input" value={editForm.condition}
                      onChange={e => setEditForm(f => ({ ...f, condition: e.target.value }))}>
                      {['excellent','good','fair','needs_repair'].map(c => (
                        <option key={c} value={c} className="bg-[#1a1a2e] text-white">
                          {c === 'needs_repair' ? 'Needs Repair' : c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Availability</label>
                    <select className="input" value={editForm.availability}
                      onChange={e => setEditForm(f => ({ ...f, availability: e.target.value }))}>
                      {['available','in_use','maintenance','retired'].map(a => (
                        <option key={a} value={a} className="capitalize bg-[#1a1a2e] text-white">{a.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                // For multi-unit, only show quantity (condition/availability set per-unit below)
                <div className="col-span-1">
                  <label className="label text-white/30 text-xs">Condition & availability</label>
                  <p className="text-white/30 text-xs mt-1.5 italic">Set per-unit below ↓</p>
                </div>
              )}
              <div>
                <label className="label">Quantity</label>
                <input type="number" min="1" className="input" value={editForm.quantity}
                  onChange={e => setEditForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" placeholder="Notes, model info..."
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit} className="btn-primary flex-1 justify-center text-sm">
                <Save className="w-3.5 h-3.5" />
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Description */}
        {!editing && eq.description && (
          <p className="text-white/50 text-sm">{eq.description}</p>
        )}

        {/* Serial Numbers */}
        <div>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-white/40" />
              <h4 className="text-white/70 text-sm font-medium">Serial Numbers</h4>
              <span className="text-white/30 text-xs">({qty} unit{qty !== 1 ? 's' : ''})</span>
            </div>
            {serialsDirty && (
              <button onClick={saveSerials} disabled={savingSerials || hasSerialErrors}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap
                  ${hasSerialErrors
                    ? 'bg-red-500/10 text-red-400/50 border border-red-500/20 cursor-not-allowed'
                    : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'}`}>
                <Save className="w-3 h-3" />
                {savingSerials ? 'Saving…' : hasSerialErrors ? 'Fix errors first' : 'Save Serials'}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {serialNumbers.map((serial, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-white/40 text-xs font-mono">#{i + 1}</span>
                  </div>
                  <input
                    className={`input flex-1 font-mono text-sm transition-colors
                      ${serialErrors[i] ? 'border-red-500/50 bg-red-500/5' : ''}`}
                    placeholder={`Unit ${i + 1} serial number…`}
                    value={serial}
                    onChange={e => handleSerialChange(i, e.target.value)}
                  />
                  {serialErrors[i] && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                </div>
                {serialErrors[i] && (
                  <p className="text-red-400 text-xs ml-10">{serialErrors[i]}</p>
                )}
              </div>
            ))}
          </div>

          {serialNumbers.every(s => !s) && (
            <p className="text-white/25 text-xs mt-2 italic">No serial numbers recorded yet. Enter them above.</p>
          )}
        </div>

        {/* ── Per-Unit Details (condition + availability) ── */}
        {/* Always shown for multi-unit; single-unit uses the edit form above */}
        {qty > 1 && (
          <div>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Wrench className="w-4 h-4 text-white/40" />
                <h4 className="text-white/70 text-sm font-medium">Per-Unit Details</h4>
                <span className="text-white/30 text-xs">(condition & availability per unit)</span>
              </div>
              {unitDetailsDirty && (
                <button onClick={saveUnitDetails} disabled={savingUnitDetails}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 whitespace-nowrap">
                  <Save className="w-3 h-3" />
                  {savingUnitDetails ? 'Saving…' : 'Save Unit Details'}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {Array.from({ length: qty }).map((_, i) => {
                const cond  = unitConditions[i]     || 'good';
                const avail = unitAvailabilities[i] || 'available';
                return (
                  <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/10">
                    {/* Unit header row */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-white/50 text-xs font-mono">#{i + 1}</span>
                      </div>
                      {serialNumbers[i] ? (
                        <span className="text-white/40 text-xs font-mono">{serialNumbers[i]}</span>
                      ) : (
                        <span className="text-white/20 text-xs italic">no serial</span>
                      )}
                      {/* Live badges */}
                      <div className="ml-auto flex gap-1.5">
                        <span className={`badge text-xs capitalize ${CONDITION_COLORS[cond] || 'bg-gray-500/20 text-gray-400'}`}>
                          {cond.replace('_', ' ')}
                        </span>
                        <span className={`badge text-xs capitalize ${AVAIL_COLORS[avail] || 'bg-gray-500/20 text-gray-400'}`}>
                          {avail.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Dropdowns */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wider mb-1 block">Condition</label>
                        <select
                          className="input text-sm"
                          value={cond}
                          onChange={e => {
                            setUnitConditions(prev => { const n = [...prev]; n[i] = e.target.value; return n; });
                            setUnitDetailsDirty(true);
                          }}>
                          {['excellent','good','fair','needs_repair'].map(c => (
                            <option key={c} value={c} className="bg-[#1a1a2e] text-white">
                              {c === 'needs_repair' ? 'Needs Repair' : c.charAt(0).toUpperCase() + c.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-white/30 text-[10px] uppercase tracking-wider mb-1 block">Availability</label>
                        <select
                          className="input text-sm"
                          value={avail}
                          onChange={e => {
                            setUnitAvailabilities(prev => { const n = [...prev]; n[i] = e.target.value; return n; });
                            setUnitDetailsDirty(true);
                          }}>
                          {['available','in_use','maintenance','retired'].map(a => (
                            <option key={a} value={a} className="capitalize bg-[#1a1a2e] text-white">{a.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tip about global availability sync */}
            <p className="text-white/20 text-xs mt-2 italic">
              Saving unit details auto-updates the global availability count.
            </p>
          </div>
        )}

        {/* Danger zone */}
        {!editing && (
          <div className="pt-3 border-t border-white/5">
            {!showRetireConfirm && !showDeleteConfirm ? (
              <div className="flex gap-2">
                {eq.availability !== 'retired' && (
                  <button onClick={() => setShowRetireConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-500/10 border border-transparent hover:border-yellow-500/20 transition-colors">
                    <PowerOff className="w-3.5 h-3.5" /> Retire
                  </button>
                )}
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            ) : showRetireConfirm ? (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-2">
                <p className="text-yellow-300 text-sm font-medium">Retire this equipment?</p>
                <p className="text-white/40 text-xs">It will be marked retired and removed from active inventory.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowRetireConfirm(false)} className="btn-secondary text-xs flex-1 justify-center">Cancel</button>
                  <button onClick={retireEquipment} disabled={actioning}
                    className="flex-1 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg text-xs font-semibold transition-colors">
                    {actioning ? 'Retiring…' : 'Yes, Retire'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                <p className="text-red-300 text-sm font-medium">Delete this equipment?</p>
                <p className="text-white/40 text-xs">Permanently removes it from the system. This cannot be undone.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary text-xs flex-1 justify-center">Cancel</button>
                  <button onClick={deleteEquipment} disabled={actioning}
                    className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-colors">
                    {actioning ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="flex gap-4 text-xs text-white/25">
          <span>Added {formatDate(eq.createdAt)}</span>
          {eq.updatedAt && eq.updatedAt !== eq.createdAt && (
            <span>Updated {formatDate(eq.updatedAt)}</span>
          )}
        </div>

      </div>
    </Modal>
  );
}

// ── Bulk Action Bar ──────────────────────────────────────────────────────────
function BulkActionBar({ count, onAction, onClear }) {
  const [showAvailMenu, setShowAvailMenu] = useState(false);
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 gap-y-2 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl flex-wrap">
      <span className="text-primary text-sm font-medium flex-shrink-0">{count} selected</span>
      <div className="h-4 w-px bg-white/10 flex-shrink-0 hidden sm:block" />

      <div className="relative flex-shrink-0">
        <button onClick={() => setShowAvailMenu(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
          Set Status <ChevronDown className="w-3 h-3" />
        </button>
        {showAvailMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowAvailMenu(false)} />
            <div className="absolute top-full left-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden min-w-[140px]">
              {['available','in_use','maintenance','retired'].map(a => (
                <button key={a} onClick={() => { onAction('availability', a); setShowAvailMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 capitalize transition-colors">
                  {a.replace('_', ' ')}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button onClick={() => onAction('retire')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-medium border border-yellow-500/20 transition-colors whitespace-nowrap flex-shrink-0">
        <PowerOff className="w-3 h-3" /> Retire
      </button>
      <button onClick={() => onAction('delete')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium border border-red-500/20 transition-colors whitespace-nowrap flex-shrink-0">
        <Trash2 className="w-3 h-3" /> Delete
      </button>

      <button onClick={onClear} className="ml-auto p-1.5 text-white/30 hover:text-white transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdminEquipment() {
  const [equipment,     setEquipment]     = useState([]);
  const [damages,       setDamages]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('inventory');
  const [search,        setSearch]        = useState('');
  const [filterAvail,   setFilterAvail]   = useState('all');
  const [showAdd,       setShowAdd]       = useState(false);
  const [showResolve,   setShowResolve]   = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [resolveForm,   setResolveForm]   = useState({ resolution: '', deductFromPayroll: false, deductionAmount: '' });
  const [addForm,       setAddForm]       = useState({ name: '', category: '', condition: 'good', quantity: 1, description: '' });

  const [detailTarget,  setDetailTarget]  = useState(null);
  const [showDetail,    setShowDetail]    = useState(false);

  const [selected,      setSelected]      = useState(new Set());
  const [bulkConfirm,   setBulkConfirm]   = useState(null);

  const [expandedRows,  setExpandedRows]  = useState(new Set());
  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const fetchAll = async () => {
    try {
      const [eRes, dRes] = await Promise.all([
        api.get('/equipment'),
        api.get('/damage-reports').catch(() => ({ data: { reports: [] } })),
      ]);
      setEquipment(eRes.data.equipment || []);
      setDamages(dRes.data.reports    || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const openDetail = (eq) => { setDetailTarget(eq); setShowDetail(true); };
  const closeDetail = () => {
    setShowDetail(false);
    setTimeout(() => setDetailTarget(null), 200);
  };
  const handleDetailUpdate = async () => {
    const eRes = await api.get('/equipment');
    const fresh = eRes.data.equipment || [];
    setEquipment(fresh);
    if (detailTarget) {
      const updated = fresh.find(e => e._id === detailTarget._id);
      if (updated) setDetailTarget(updated);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return equipment.filter(eq => {
      if (filterAvail !== 'all' && eq.availability !== filterAvail) return false;
      if (!q) return true;
      if (eq.name.toLowerCase().includes(q)) return true;
      return (eq.serialNumbers || []).some(sn => sn && sn.toLowerCase().includes(q));
    });
  }, [equipment, search, filterAvail]);

  const filteredIds  = filtered.map(e => e._id);
  const allSelected  = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const someSelected = filteredIds.some(id => selected.has(id)) && !allSelected;

  const toggleOne = (id, e) => {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filteredIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); filteredIds.forEach(id => n.add(id)); return n; });
    }
  };

  const handleBulkAction = (action, value) => {
    const count = selected.size;
    const labels = {
      availability: `Mark ${count} item(s) as "${(value || '').replace('_', ' ')}"?`,
      retire:       `Retire ${count} item(s)? They will be hidden from active inventory.`,
      delete:       `Permanently delete ${count} item(s)? This cannot be undone.`,
    };
    setBulkConfirm({ action, value, label: labels[action] });
  };

  const executeBulkAction = async () => {
    const { action, value } = bulkConfirm;
    const ids = [...selected];
    try {
      if (action === 'availability') {
        await Promise.all(ids.map(id => api.put(`/equipment/${id}`, { availability: value })));
        toast.success(`Updated ${ids.length} item(s)`);
      } else if (action === 'retire') {
        await Promise.all(ids.map(id => api.put(`/equipment/${id}`, { availability: 'retired' })));
        toast.success(`Retired ${ids.length} item(s)`);
      } else if (action === 'delete') {
        await Promise.all(ids.map(id => api.delete(`/equipment/${id}`)));
        toast.success(`Deleted ${ids.length} item(s)`);
      }
    } catch { toast.error('Some actions failed — refresh to check'); }
    finally { setBulkConfirm(null); setSelected(new Set()); fetchAll(); }
  };

  const addEquipment = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/equipment', addForm);
      toast.success('Equipment added');
      setShowAdd(false);
      setAddForm({ name: '', category: '', condition: 'good', quantity: 1, description: '' });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const resolveReport = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/damage-reports/${resolveTarget._id}/resolve`, resolveForm);
      toast.success('Damage report resolved');
      setShowResolve(false); setResolveTarget(null);
      setResolveForm({ resolution: '', deductFromPayroll: false, deductionAmount: '' });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const openDamages = damages.filter(d => d.status !== 'resolved').length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Equipment" subtitle={`${equipment.length} total items`}
        action={
          <button onClick={() => setShowAdd(true)} className="btn-primary w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" /> <span className="sm:hidden">Add</span><span className="hidden sm:inline">Add Equipment</span>
          </button>
        } />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto scrollbar-hide">
        {[
          { key: 'inventory', label: 'Inventory' },
          { key: 'damage',    label: `Damage Reports${openDamages > 0 ? ` (${openDamages})` : ''}` },
          { key: 'history',   label: 'Usage History' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0
              ${tab === t.key ? 'text-primary border-primary' : 'text-white/50 border-transparent hover:text-white'}`}>
            {t.label}
            {t.key === 'damage' && openDamages > 0 && (
              <span className="ml-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs inline-flex items-center justify-center">
                {openDamages}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── INVENTORY ── */}
      {tab === 'inventory' && (
        <div className="space-y-4">

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative w-full sm:flex-1 sm:min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input className="input pl-9 w-full" placeholder="Search by name or serial number…"
                value={search} onChange={e => { setSearch(e.target.value); setSelected(new Set()); }} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
              {['all','available','in_use','maintenance','retired'].map(a => (
                <button key={a} onClick={() => { setFilterAvail(a); setSelected(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap flex-shrink-0
                    ${filterAvail === a ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}>
                  {a.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <BulkActionBar count={selected.size} onAction={handleBulkAction} onClear={() => setSelected(new Set())} />

          {filtered.length === 0 ? (
            <EmptyState icon={Wrench} title="No equipment found" description="Add your first equipment item or clear your search" />
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="md:hidden space-y-3">
                {filtered.map(eq => {
                  const filledSerials = (eq.serialNumbers || []).filter(Boolean).length;
                  const totalUnits    = eq.quantity || 1;
                  const isSelected    = selected.has(eq._id);
                  const isExpanded    = expandedRows.has(eq._id);
                  const hasMultiple   = totalUnits > 1;
                  const q             = search.toLowerCase();
                  const serialHit     = q && !eq.name.toLowerCase().includes(q)
                    ? (eq.serialNumbers || []).filter(sn => sn && sn.toLowerCase().includes(q))
                    : [];

                  const unitConds   = eq.unitConditions?.length     === totalUnits ? eq.unitConditions     : Array(totalUnits).fill(eq.condition    || 'good');
                  const unitAvails  = eq.unitAvailabilities?.length === totalUnits ? eq.unitAvailabilities : Array(totalUnits).fill(eq.availability || 'available');
                  const worstCond = ['needs_repair','fair','good','excellent'].find(c => unitConds.includes(c)) || eq.condition;

                  return (
                    <div key={eq._id} className={`card space-y-3 border ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-white/10'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1" onClick={() => openDetail(eq)}>
                          <button onClick={e => toggleOne(eq._id, e)} className="mt-0.5 flex-shrink-0 hover:opacity-80 transition-opacity">
                            <CheckboxIcon checked={isSelected} />
                          </button>
                          <div className="min-w-0">
                            <p className={`font-semibold truncate ${isSelected ? 'text-primary' : 'text-white'}`}>{eq.name}</p>
                            <p className="text-white/40 text-xs capitalize">{eq.category}</p>
                            {eq.description && <p className="text-white/30 text-xs truncate">{eq.description}</p>}
                            {serialHit.length > 0 && (
                              <p className="text-primary/60 text-xs font-mono mt-0.5 truncate">SN: {serialHit.join(', ')}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-white/50 font-mono text-xs flex-shrink-0">
                          {totalUnits} unit{totalUnits !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className={`badge capitalize ${CONDITION_COLORS[worstCond] || 'bg-gray-500/20 text-gray-400'}`}>
                          {worstCond?.replace('_', ' ')}
                          {hasMultiple && unitConds.some(c => c !== worstCond) && (
                            <span className="ml-1 opacity-50 text-[10px]">*</span>
                          )}
                        </span>
                        {hasMultiple ? (
                          <span className={`badge ${
                            unitAvails.every(a => a === 'available') ? 'bg-green-500/20 text-green-400' :
                            unitAvails.every(a => a === 'retired')   ? 'bg-red-500/20 text-red-400' :
                            unitAvails.some(a => a === 'available')  ? 'bg-green-500/20 text-green-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {unitAvails.filter(a => a === 'available').length}/{totalUnits} avail
                          </span>
                        ) : (
                          <span className={`badge capitalize ${AVAIL_COLORS[eq.availability] || 'bg-gray-500/20 text-gray-400'}`}>
                            {(eq.availability || '').replace('_', ' ')}
                          </span>
                        )}
                        {filledSerials > 0 ? (
                          <span className={`font-mono ${filledSerials === totalUnits ? 'text-green-400' : 'text-yellow-400'}`}>
                            {filledSerials}/{totalUnits} serials
                          </span>
                        ) : (
                          <span className="text-white/20">no serials</span>
                        )}
                      </div>

                      {hasMultiple && (
                        <button onClick={e => toggleExpand(eq._id, e)}
                          className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                          {isExpanded ? 'Hide units' : 'Show units'}
                        </button>
                      )}
                      {hasMultiple && isExpanded && (
                        <div className="space-y-1.5 pl-2 border-l border-white/10">
                          {Array.from({ length: totalUnits }).map((_, i) => {
                            const serial    = (eq.serialNumbers || [])[i] || null;
                            const unitCond  = unitConds[i]  || 'good';
                            const unitAvail = unitAvails[i] || 'available';
                            return (
                              <div key={i} className="flex items-center gap-2 flex-wrap text-xs pl-2">
                                <span className="text-white/40 font-mono">#{i + 1}</span>
                                {serial
                                  ? <span className="text-white/50 font-mono">{serial}</span>
                                  : <span className="text-white/20 italic">no serial</span>}
                                <span className={`badge capitalize text-[10px] ${CONDITION_COLORS[unitCond] || 'bg-gray-500/20 text-gray-400'}`}>
                                  {unitCond?.replace('_', ' ')}
                                </span>
                                <span className={`badge capitalize text-[10px] ${AVAIL_COLORS[unitAvail] || 'bg-gray-500/20 text-gray-400'}`}>
                                  {unitAvail?.replace('_', ' ')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                        <button onClick={() => openDetail(eq)}
                          className="btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1 text-primary/70 hover:text-primary">
                          <Edit3 className="w-3.5 h-3.5" /> Details
                        </button>
                        <button onClick={() => setTab('history')}
                          className="btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1">
                          <History className="w-3.5 h-3.5" /> History
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop/tablet: table */}
              <div className="hidden md:block card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs border-b border-white/10">
                    <th className="py-3 pr-3 w-8">
                      <button onClick={toggleAll} className="hover:opacity-80 transition-opacity flex items-center">
                        <CheckboxIcon checked={allSelected} indeterminate={someSelected} />
                      </button>
                    </th>
                    {['Name','Category','Condition','Availability','Qty','Serials','Actions'].map(h => (
                      <th key={h} className="text-left py-3 pr-4 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(eq => {
                    const filledSerials = (eq.serialNumbers || []).filter(Boolean).length;
                    const totalUnits    = eq.quantity || 1;
                    const isSelected    = selected.has(eq._id);
                    const isExpanded    = expandedRows.has(eq._id);
                    const hasMultiple   = totalUnits > 1;
                    const q             = search.toLowerCase();
                    const serialHit     = q && !eq.name.toLowerCase().includes(q)
                      ? (eq.serialNumbers || []).filter(sn => sn && sn.toLowerCase().includes(q))
                      : [];

                    // Resolve per-unit arrays (fall back to global values if not set)
                    const unitConds   = eq.unitConditions?.length     === totalUnits ? eq.unitConditions     : Array(totalUnits).fill(eq.condition    || 'good');
                    const unitAvails  = eq.unitAvailabilities?.length === totalUnits ? eq.unitAvailabilities : Array(totalUnits).fill(eq.availability || 'available');

                    // Worst condition across all units for the summary badge
                    const worstCond = ['needs_repair','fair','good','excellent'].find(c => unitConds.includes(c)) || eq.condition;

                    return (
                      <React.Fragment key={eq._id}>
                        {/* ── Main equipment row ── */}
                        <tr onClick={() => openDetail(eq)}
                          className={`border-b border-white/5 transition-colors cursor-pointer group
                            ${isSelected ? 'bg-primary/5' : 'hover:bg-white/5'}
                            ${isExpanded ? 'border-white/10' : ''}`}>

                          <td className="py-3 pr-3" onClick={e => toggleOne(eq._id, e)}>
                            <span className="hover:opacity-80 transition-opacity flex items-center">
                              <CheckboxIcon checked={isSelected} />
                            </span>
                          </td>

                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {hasMultiple && (
                                <button
                                  onClick={e => toggleExpand(eq._id, e)}
                                  className={`p-0.5 rounded transition-all flex-shrink-0
                                    ${isExpanded ? 'text-primary rotate-0' : 'text-white/30 hover:text-white/60 -rotate-90'}`}>
                                  <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                                </button>
                              )}
                              <div>
                                <p className={`font-medium transition-colors ${isSelected ? 'text-primary' : 'text-white group-hover:text-primary'}`}>
                                  {eq.name}
                                </p>
                                {eq.description && <p className="text-white/30 text-xs truncate max-w-[180px]">{eq.description}</p>}
                                {serialHit.length > 0 && (
                                  <p className="text-primary/60 text-xs font-mono mt-0.5">SN: {serialHit.join(', ')}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 pr-4 text-white/60 capitalize">{eq.category}</td>

                          {/* Condition summary */}
                          <td className="py-3 pr-4">
                            <span className={`badge capitalize ${CONDITION_COLORS[worstCond] || 'bg-gray-500/20 text-gray-400'}`}>
                              {worstCond?.replace('_', ' ')}
                              {hasMultiple && unitConds.some(c => c !== worstCond) && (
                                <span className="ml-1 opacity-50 text-[10px]">*</span>
                              )}
                            </span>
                          </td>

                          {/* Availability summary */}
                          <td className="py-3 pr-4">
                            {hasMultiple ? (
                              <span className={`badge ${
                                unitAvails.every(a => a === 'available') ? 'bg-green-500/20 text-green-400' :
                                unitAvails.every(a => a === 'retired')   ? 'bg-red-500/20 text-red-400' :
                                unitAvails.some(a => a === 'available')  ? 'bg-green-500/20 text-green-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {unitAvails.filter(a => a === 'available').length}/{totalUnits} avail
                              </span>
                            ) : (
                              <span className={`badge capitalize ${AVAIL_COLORS[eq.availability] || 'bg-gray-500/20 text-gray-400'}`}>
                                {(eq.availability || '').replace('_', ' ')}
                              </span>
                            )}
                          </td>

                          <td className="py-3 pr-4 text-white font-mono">{totalUnits}</td>

                          <td className="py-3 pr-4">
                            {filledSerials > 0 ? (
                              <span className={`text-xs font-mono ${filledSerials === totalUnits ? 'text-green-400' : 'text-yellow-400'}`}>
                                {filledSerials}/{totalUnits}
                              </span>
                            ) : (
                              <span className="text-white/20 text-xs">—</span>
                            )}
                          </td>

                          <td className="py-3">
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => openDetail(eq)}
                                className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-primary/70 hover:text-primary">
                                <Edit3 className="w-3.5 h-3.5" /> Details
                              </button>
                              <button onClick={() => setTab('history')}
                                className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
                                <History className="w-3.5 h-3.5" /> History
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── Expanded unit sub-rows ── */}
                        {hasMultiple && isExpanded && Array.from({ length: totalUnits }, (_, i) => {
                          const serial   = (eq.serialNumbers || [])[i] || null;
                          const unitCond  = unitConds[i]  || 'good';
                          const unitAvail = unitAvails[i] || 'available';
                          const isLast    = i === totalUnits - 1;
                          return (
                            <tr key={`${eq._id}-unit-${i}`}
                              className={`bg-white/[0.02] transition-colors
                                ${isLast ? 'border-b border-white/10' : 'border-b border-white/[0.04]'}`}>
                              {/* empty checkbox cell */}
                              <td className="py-2 pr-3" />
                              {/* unit label + serial */}
                              <td className="py-2 pr-4 pl-8">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white/40 text-[10px] font-mono">#{i+1}</span>
                                  </span>
                                  {serial
                                    ? <span className="text-white/50 text-xs font-mono">{serial}</span>
                                    : <span className="text-white/20 text-xs italic">no serial</span>}
                                </div>
                              </td>
                              {/* category placeholder */}
                              <td className="py-2 pr-4" />
                              {/* per-unit condition */}
                              <td className="py-2 pr-4">
                                <span className={`badge capitalize text-xs ${CONDITION_COLORS[unitCond] || 'bg-gray-500/20 text-gray-400'}`}>
                                  {unitCond?.replace('_', ' ')}
                                </span>
                              </td>
                              {/* per-unit availability */}
                              <td className="py-2 pr-4">
                                <span className={`badge capitalize text-xs ${AVAIL_COLORS[unitAvail] || 'bg-gray-500/20 text-gray-400'}`}>
                                  {unitAvail?.replace('_', ' ')}
                                </span>
                              </td>
                              {/* rest empty */}
                              <td colSpan={3} className="py-2" />
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-white/20 text-xs mt-3 px-1">
                Search by name or serial · Select rows for bulk actions · Click any row for details · * = mixed conditions across units
              </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DAMAGE REPORTS ── */}
      {tab === 'damage' && (
        <div className="space-y-4">
          {damages.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="No damage reports"
              description="Damage reports are filed from the Event Detail page after an event is completed." />
          ) : (
            <div className="space-y-3">
              {damages.map(d => (
                <div key={d._id} className={`card border ${d.status === 'resolved' ? 'border-white/10' : 'border-red-500/20'}`}>
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                        ${d.status === 'resolved' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {d.status === 'resolved'
                          ? <CheckCircle className="w-5 h-5 text-green-400" />
                          : <AlertTriangle className="w-5 h-5 text-red-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">{d.equipment?.name}</p>
                          <span className={`text-xs font-semibold capitalize ${DAMAGE_TYPE_COLORS[d.damageType] || 'text-white/50'}`}>
                            {d.damageType}
                          </span>
                          <span className={`badge capitalize ${DAMAGE_COLORS[d.status] || ''}`}>{d.status?.replace('_', ' ')}</span>
                        </div>
                        <p className="text-white/50 text-xs mt-0.5">
                          Event: {d.event?.eventName} · Freelancer: {d.freelancer?.name}
                        </p>
                        <p className="text-white/60 text-xs mt-1">{d.description}</p>
                        {d.repairCost > 0 && (
                          <p className="text-orange-400 text-xs mt-1">
                            Repair cost: {formatCurrency(d.repairCost)}
                            {d.deductFromPayroll && ' — deducting from payroll'}
                          </p>
                        )}
                        {d.status === 'resolved' && d.resolution && (
                          <p className="text-green-400/70 text-xs mt-1 italic">Resolution: {d.resolution}</p>
                        )}
                        {d.photos?.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {d.photos.slice(0, 4).map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer"
                                className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 block flex-shrink-0">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                      <p className="text-white/30 text-xs">{formatDate(d.createdAt)}</p>
                      {d.status !== 'resolved' && (
                        <button onClick={() => { setResolveTarget(d); setShowResolve(true); }}
                          className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-semibold hover:bg-green-500/30 transition-colors">
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── USAGE HISTORY ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <p className="text-white/40 text-sm">Complete history of all equipment used across events.</p>
          <EquipmentUsageHistory equipment={equipment} damages={damages} />
        </div>
      )}

      {/* ── MODALS ── */}

      <EquipmentDetailModal
        equipment={detailTarget}
        allEquipment={equipment}
        isOpen={showDetail}
        onClose={closeDetail}
        onUpdate={handleDetailUpdate}
      />

      {/* Bulk confirm */}
      <Modal isOpen={!!bulkConfirm} onClose={() => setBulkConfirm(null)} title="Confirm Bulk Action">
        {bulkConfirm && (
          <div className="space-y-4">
            <p className="text-white/70 text-sm">{bulkConfirm.label}</p>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button onClick={() => setBulkConfirm(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={executeBulkAction}
                className={`flex-1 px-4 py-2 rounded-xl font-semibold text-sm transition-colors
                  ${bulkConfirm.action === 'delete'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : bulkConfirm.action === 'retire'
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                      : 'btn-primary'}`}>
                Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Equipment */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Equipment">
        <form onSubmit={addEquipment} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" placeholder="e.g. Sony NX100 Camera"
              value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select className="input" value={addForm.category}
                onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} required>
                <option value="" className="bg-[#1a1a2e] text-white">Select…</option>
                {['lights','sounds','video','photography','other'].map(c => (
                  <option key={c} value={c} className="capitalize bg-[#1a1a2e] text-white">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Condition</label>
              <select className="input" value={addForm.condition}
                onChange={e => setAddForm(f => ({ ...f, condition: e.target.value }))}>
                {['excellent','good','fair','needs_repair'].map(c => (
                  <option key={c} value={c} className="bg-[#1a1a2e] text-white">{c === 'needs_repair' ? 'Needs Repair' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" min="1" className="input"
              value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="Model number, notes…"
              value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Adding…' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Damage */}
      <Modal isOpen={showResolve} onClose={() => { setShowResolve(false); setResolveTarget(null); }} title="Resolve Damage Report">
        {resolveTarget && (
          <form onSubmit={resolveReport} className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm">
              <p className="text-white font-semibold">{resolveTarget.equipment?.name}</p>
              <p className="text-white/50 text-xs mt-0.5 capitalize">{resolveTarget.damageType} — {resolveTarget.description}</p>
              <p className="text-white/40 text-xs mt-1">Freelancer: {resolveTarget.freelancer?.name}</p>
            </div>
            <div>
              <label className="label">Resolution Notes *</label>
              <textarea className="input min-h-[80px]"
                placeholder="How was this resolved? (repaired, replaced, written off, etc.)"
                value={resolveForm.resolution}
                onChange={e => setResolveForm(f => ({ ...f, resolution: e.target.value }))} required />
            </div>
            {resolveTarget.repairCost > 0 && (
              <>
                <div onClick={() => setResolveForm(f => ({ ...f, deductFromPayroll: !f.deductFromPayroll }))}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                    ${resolveForm.deductFromPayroll ? 'border-orange-500/40 bg-orange-500/10' : 'border-white/10 bg-white/5'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${resolveForm.deductFromPayroll ? 'border-orange-400 bg-orange-400' : 'border-white/30'}`}>
                    {resolveForm.deductFromPayroll && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${resolveForm.deductFromPayroll ? 'text-orange-300' : 'text-white/70'}`}>
                      Deduct from freelancer payroll
                    </p>
                    <p className="text-white/40 text-xs">Reported cost: {formatCurrency(resolveTarget.repairCost)}</p>
                  </div>
                </div>
                {resolveForm.deductFromPayroll && (
                  <div>
                    <label className="label">Deduction Amount (₱)</label>
                    <input type="number" min="0" className="input"
                      placeholder={resolveTarget.repairCost}
                      value={resolveForm.deductionAmount}
                      onChange={e => setResolveForm(f => ({ ...f, deductionAmount: e.target.value }))} />
                  </div>
                )}
              </>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button type="button" onClick={() => { setShowResolve(false); setResolveTarget(null); }}
                className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {saving ? 'Resolving…' : 'Mark as Resolved'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ── Usage History ────────────────────────────────────────────────────────────
function EquipmentUsageHistory({ equipment, damages }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events').then(r => { setEvents(r.data.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const usageRecords = [];
  events.forEach(ev => {
    (ev.assignedFreelancers || []).forEach(af => {
      const frName = af.freelancer?.name || 'Unknown';
      (af.equipment || []).forEach(eq => {
        const eqName = eq.equipment?.name || eq.equipment;
        const eqId   = eq.equipment?._id  || eq.equipment;
        // Which specific unit slots (0-based) were used, e.g. "#1, #3".
        // Falls back to null for older records saved before unit tracking existed.
        const units  = Array.isArray(eq.unitIndices) && eq.unitIndices.length > 0
          ? eq.unitIndices.map(idx => `#${idx + 1}`).join(', ')
          : null;
        const damage = damages.find(d =>
          (d.equipment?._id || d.equipment) === eqId && (d.event?._id || d.event) === ev._id
        );
        usageRecords.push({ eventId: ev._id, eventName: ev.eventName, eventDate: ev.eventDate, eventStatus: ev.status, frName, eqId, eqName, units, damage });
      });
    });
  });

  if (usageRecords.length === 0) {
    return <EmptyState icon={History} title="No usage history"
      description="Equipment usage history will appear here after events are assigned." />;
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {usageRecords.map((rec, i) => (
          <div key={i} className={`card space-y-2 border ${rec.damage ? 'border-red-500/20' : 'border-white/10'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white font-medium truncate">
                  {rec.eqName}
                  {rec.units && <span className="text-white/40 font-normal"> ({rec.units})</span>}
                </p>
                <p className="text-white/60 text-sm truncate">{rec.frName}</p>
              </div>
              <span className={`badge text-xs capitalize shrink-0 ${
                rec.eventStatus === 'completed_paid' ? 'bg-green-500/20 text-green-400' :
                ['in_progress','assigned'].includes(rec.eventStatus) ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'}`}>
                {rec.eventStatus?.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50 truncate">{rec.eventName}</span>
              <span className="text-white/40 flex-shrink-0 ml-2">{formatDate(rec.eventDate)}</span>
            </div>

            <div className="pt-2 border-t border-white/10">
              {rec.damage ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold capitalize ${DAMAGE_TYPE_COLORS[rec.damage.damageType] || 'text-white/50'}`}>
                    {rec.damage.damageType}
                  </span>
                  <span className={`badge text-xs ${DAMAGE_COLORS[rec.damage.status] || ''}`}>
                    {rec.damage.status?.replace('_', ' ')}
                  </span>
                </div>
              ) : (
                <span className="text-green-400/60 text-xs flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> No damage
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-xs border-b border-white/10">
              {['Equipment','Freelancer','Event','Date','Event Status','Damage'].map(h => (
                <th key={h} className="text-left py-3 pr-4 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usageRecords.map((rec, i) => (
              <tr key={i} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${rec.damage ? 'bg-red-500/5' : ''}`}>
                <td className="py-3 pr-4 text-white font-medium">
                  {rec.eqName}
                  {rec.units && <span className="text-white/40 font-normal"> ({rec.units})</span>}
                </td>
                <td className="py-3 pr-4 text-white/70">{rec.frName}</td>
                <td className="py-3 pr-4 text-white/70 max-w-[140px] truncate">{rec.eventName}</td>
                <td className="py-3 pr-4 text-white/50 text-xs whitespace-nowrap">{formatDate(rec.eventDate)}</td>
                <td className="py-3 pr-4">
                  <span className={`badge text-xs capitalize ${
                    rec.eventStatus === 'completed_paid' ? 'bg-green-500/20 text-green-400' :
                    ['in_progress','assigned'].includes(rec.eventStatus) ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'}`}>
                    {rec.eventStatus?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {rec.damage ? (
                    <div>
                      <span className={`text-xs font-semibold capitalize ${DAMAGE_TYPE_COLORS[rec.damage.damageType] || 'text-white/50'}`}>
                        {rec.damage.damageType}
                      </span>
                      <span className={`ml-2 badge text-xs ${DAMAGE_COLORS[rec.damage.status] || ''}`}>
                        {rec.damage.status?.replace('_', ' ')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-green-400/60 text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> No damage
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}