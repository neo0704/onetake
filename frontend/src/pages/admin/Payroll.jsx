import React, { useEffect, useState, useCallback } from 'react';
import { DollarSign, Plus, X, CheckCircle, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { payrollPeriodDefaults, payrollPeriodConstraints, toInputDate } from '../../utils/dateHelpers';
import toast from 'react-hot-toast';

const STATUS = {
  draft:   { label: 'Draft',   cls: 'bg-gray-500/20  text-gray-400'  },
  pending: { label: 'Pending', cls: 'bg-yellow-500/20 text-yellow-400' },
  paid:    { label: 'Paid',    cls: 'bg-green-500/20  text-green-400'  },
};
const METHODS = [
  { value: 'gcash',         label: 'GCash'        },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash'          },
  { value: 'other',         label: 'Other'         },
];

const emptyForm = () => ({
  freelancerId: '', eventId: '', role: '',
  periodDate: '',
  daysWorked: 1, ratePerDay: '',
  deductions: [], bonuses: [],
  paymentMethod: 'gcash', notes: '',
});

// ── PayForm outside parent to prevent focus-loss on every keystroke ───────────
const PayForm = ({ form, setForm, freelancers, events, onSubmit, submitLabel, onCancel, saving }) => {
  const gross    = (parseFloat(form.daysWorked)||0) * (parseFloat(form.ratePerDay)||0);
  const totalDed = form.deductions.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
  const totalBon = form.bonuses.reduce((s,b)    => s + (parseFloat(b.amount)||0), 0);
  const net      = gross + totalBon - totalDed;

  const addDed   = () => setForm(f => ({ ...f, deductions: [...f.deductions, { label:'', amount:'' }] }));
  const addBon   = () => setForm(f => ({ ...f, bonuses:    [...f.bonuses,    { label:'', amount:'' }] }));
  const updDed   = (i,k,v) => setForm(f => ({ ...f, deductions: f.deductions.map((d,idx) => idx===i ? {...d,[k]:v} : d) }));
  const updBon   = (i,k,v) => setForm(f => ({ ...f, bonuses:    f.bonuses.map((b,idx)    => idx===i ? {...b,[k]:v} : b) }));

  // When event changes → auto-fill period date and constraints
  const selectedEvent = events.find(ev => ev._id === form.eventId);
  const constraints   = payrollPeriodConstraints(selectedEvent?.eventDate);

  const onEventChange = (eventId) => {
    const ev       = events.find(e => e._id === eventId);
    const defaults = payrollPeriodDefaults(ev?.eventDate);
    setForm(f => ({ ...f, eventId, periodDate: defaults.periodFrom || defaults.periodTo || f.periodDate }));
  };

  // When freelancer changes → the rate + unit come straight from their profile
  const selectedFreelancer = freelancers.find(fr => fr._id === form.freelancerId);

  // Profile rates are 'hourly' or 'fixed' (per project) — never literally "per day".
  // We label the fields to match whichever unit the freelancer's profile actually uses,
  // so the number we auto-fill is always the correct unit, not a mislabeled day rate.
  const rateUnit = selectedFreelancer?.rateType === 'hourly' ? 'Hour'
    : selectedFreelancer?.rateType === 'fixed' ? 'Project'
    : 'Day';

  const onFreelancerChange = (freelancerId) => {
    const fr = freelancers.find(f => f._id === freelancerId);
    const profileRate = fr?.rate;
    setForm(f => ({ ...f, freelancerId, ratePerDay: (profileRate !== null && profileRate !== undefined) ? profileRate : f.ratePerDay }));
  };


  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Freelancer *</label>
          <select className="input" value={form.freelancerId}
            onChange={e => onFreelancerChange(e.target.value)} required>
            <option value="">Select freelancer...</option>
            {freelancers.map(fr => <option key={fr._id} value={fr._id}>{fr.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Linked Project</label>
          <select className="input" value={form.eventId}
            onChange={e => onEventChange(e.target.value)}>
            <option value="">None</option>
            {events.map(ev => <option key={ev._id} value={ev._id}>{ev.eventName}</option>)}
          </select>
        </div>
      </div>

      {/* Show event date context */}
      {selectedEvent?.eventDate && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs flex items-center gap-2">
          <span className="text-primary/70">📅 Event date:</span>
          <span className="text-white font-medium">
            {new Date(selectedEvent.eventDate).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })}
          </span>
          <span className="text-white/40 ml-2">— Period auto-filled to event date. Adjust if needed.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Role / Position</label>
          <input className="input" placeholder="e.g. Camera Operator"
            value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={form.paymentMethod}
            onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
            {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Period Date *</label>
          <input type="date" className="input" value={form.periodDate}
            min={constraints.min}
            max={constraints.max}
            onChange={e => setForm(f => ({ ...f, periodDate: e.target.value }))} required />
          {(constraints.min || constraints.max) && (
            <p className="text-white/30 text-xs mt-1">
              {constraints.min && `Earliest: ${formatDate(constraints.min)}`}
              {constraints.min && constraints.max && ' · '}
              {constraints.max && `Latest: ${formatDate(constraints.max)}`}
            </p>
          )}
        </div>
        <div>
          <label className="label">{rateUnit}s Worked *</label>
          <input type="number" min="0.5" step="0.5" className="input"
            value={form.daysWorked} onChange={e => setForm(f => ({ ...f, daysWorked: e.target.value }))} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Rate per {rateUnit} (₱) *</label>
          <input type="number" min="0" className="input" placeholder="0"
            value={form.ratePerDay} onChange={e => setForm(f => ({ ...f, ratePerDay: e.target.value }))} required />
          {selectedFreelancer && selectedFreelancer.rate != null && (
            <p className="text-white/30 text-xs mt-1">
              Auto-filled from {selectedFreelancer.name}'s profile rate (₱{selectedFreelancer.rate} per {rateUnit.toLowerCase()}) — adjust if needed.
            </p>
          )}
        </div>
      </div>

      {/* Deductions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Deductions</label>
          <button type="button" onClick={addDed} className="btn-ghost text-xs py-1"><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
        {form.deductions.map((d,i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2 mb-2">
            <input className="input flex-1 text-sm" placeholder="Label (e.g. SSS)"
              value={d.label} onChange={e => updDed(i,'label',e.target.value)} />
            <div className="flex gap-2">
              <input type="number" min="0" className="input flex-1 sm:w-28 sm:flex-none text-sm" placeholder="₱0"
                value={d.amount} onChange={e => updDed(i,'amount',e.target.value)} />
              <button type="button" onClick={() => setForm(f => ({ ...f, deductions: f.deductions.filter((_,idx) => idx!==i) }))}
                className="text-white/20 hover:text-red-400 px-1 flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Bonuses */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Bonuses / Allowances</label>
          <button type="button" onClick={addBon} className="btn-ghost text-xs py-1"><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
        {form.bonuses.map((b,i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2 mb-2">
            <input className="input flex-1 text-sm" placeholder="Label (e.g. Transportation)"
              value={b.label} onChange={e => updBon(i,'label',e.target.value)} />
            <div className="flex gap-2">
              <input type="number" min="0" className="input flex-1 sm:w-28 sm:flex-none text-sm" placeholder="₱0"
                value={b.amount} onChange={e => updBon(i,'amount',e.target.value)} />
              <button type="button" onClick={() => setForm(f => ({ ...f, bonuses: f.bonuses.filter((_,idx) => idx!==i) }))}
                className="text-white/20 hover:text-red-400 px-1 flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Pay preview */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-1.5">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Pay Preview</p>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Gross ({form.daysWorked} × ₱{form.ratePerDay||0} /{rateUnit.toLowerCase()})</span>
          <span className="text-white">{formatCurrency(gross)}</span>
        </div>
        {totalBon > 0 && <div className="flex justify-between text-sm"><span className="text-green-400/70">+ Bonuses</span><span className="text-green-400">+{formatCurrency(totalBon)}</span></div>}
        {totalDed > 0 && <div className="flex justify-between text-sm"><span className="text-red-400/70">− Deductions</span><span className="text-red-400">−{formatCurrency(totalDed)}</span></div>}
        <div className="flex justify-between text-base font-bold pt-2 border-t border-white/10">
          <span className="text-white">Net Pay</span>
          <span className="text-primary">{formatCurrency(net)}</span>
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[60px]" placeholder="Internal notes..."
          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default function AdminPayroll() {
  const [payrolls,     setPayrolls]     = useState([]);
  const [freelancers,  setFreelancers]  = useState([]);
  const [events,       setEvents]       = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate,   setShowCreate]   = useState(false);
  const [showEdit,     setShowEdit]     = useState(false);
  const [showPay,      setShowPay]      = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [payTarget,    setPayTarget]    = useState(null);
  const [payRef,       setPayRef]       = useState('');
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState(emptyForm());

  const fetchAll = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const [pRes, sRes] = await Promise.all([
        api.get('/payroll', { params }),
        api.get('/payroll/stats/summary'),
      ]);
      setPayrolls(pRes.data.payrolls);
      setStats(sRes.data.stats);
    } catch { toast.error('Failed to load payroll'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    api.get('/users?role=freelancer').then(r => setFreelancers(r.data.users || []));
    api.get('/events').then(r => setEvents(r.data.events || []));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { periodDate, ...rest } = form;
      await api.post('/payroll', { ...rest, periodFrom: periodDate, periodTo: periodDate });
      toast.success('Payroll created!');
      setShowCreate(false); setForm(emptyForm()); fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { periodDate, ...rest } = form;
      await api.put(`/payroll/${editTarget._id}`, { ...rest, periodFrom: periodDate, periodTo: periodDate });
      toast.success('Payroll updated!');
      setShowEdit(false); fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleRelease = async (id, status) => {
    try { await api.put(`/payroll/${id}`, { status }); toast.success(`Marked as ${status}`); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handlePay = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/payroll/${payTarget._id}/pay`, { referenceNumber: payRef, paymentMethod: payTarget.paymentMethod });
      toast.success('Payment released!');
      setShowPay(false); setPayRef(''); fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payroll entry?')) return;
    try { await api.delete(`/payroll/${id}`); toast.success('Deleted'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Cannot delete paid payroll'); }
  };

  const openEdit = (p) => {
    setEditTarget(p);
    setForm({
      freelancerId: p.freelancer?._id || '',
      eventId:      p.event?._id || '',
      role:         p.role || '',
      periodDate:   p.period?.from?.slice(0,10) || p.period?.to?.slice(0,10) || '',
      daysWorked:   p.daysWorked || 1,
      ratePerDay:   p.ratePerDay || '',
      deductions:   p.deductions || [],
      bonuses:      p.bonuses || [],
      paymentMethod:p.paymentMethod || 'gcash',
      notes:        p.notes || '',
    });
    setShowEdit(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Payroll" subtitle="Manage freelancer compensation"
        action={<button onClick={() => { setForm(emptyForm()); setShowCreate(true); }} className="btn-primary"><Plus className="w-4 h-4" /> New Payroll</button>} />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Total Released', value:formatCurrency(stats.totalReleased), color:'text-green-400',  bg:'bg-green-500/10 border-green-500/20'   },
            { label:'Pending',        value:formatCurrency(stats.totalPending),  color:'text-yellow-400', bg:'bg-yellow-500/10 border-yellow-500/20' },
            { label:'Paid Entries',   value:stats.paid,                          color:'text-emerald-400',bg:'bg-emerald-500/10 border-emerald-500/20'},
            { label:'Draft/Pending',  value:stats.pending+stats.draft,           color:'text-orange-400', bg:'bg-orange-500/10 border-orange-500/20' },
          ].map(s => (
            <div key={s.label} className={`card border ${s.bg}`}>
              <p className="text-white/50 text-xs">{s.label}</p>
              <p className={`text-lg sm:text-2xl font-black mt-1 truncate ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {['all','draft','pending','paid'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors
              ${statusFilter===s ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            {s}
          </button>
        ))}
      </div>

      {payrolls.length === 0 ? (
        <EmptyState icon={DollarSign} title="No payroll entries" description="Create payroll entries for your freelancers" />
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {payrolls.map(p => (
              <div key={p._id} className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {p.freelancer?.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{p.freelancer?.name}</p>
                      {p.role && <p className="text-white/40 text-xs truncate">{p.role}</p>}
                    </div>
                  </div>
                  <span className={`badge shrink-0 ${STATUS[p.status]?.cls}`}>{STATUS[p.status]?.label}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-white/50 text-xs">
                    <p className="truncate max-w-[160px]">{p.event?.eventName || '—'}</p>
                    <p>{formatDate(p.period?.from || p.period?.to)} · {p.daysWorked}{p.freelancer?.rateType === 'hourly' ? 'h' : p.freelancer?.rateType === 'fixed' ? 'x' : 'd'} @ {formatCurrency(p.ratePerDay)}</p>
                  </div>
                  <span className="text-primary font-mono font-bold shrink-0">{formatCurrency(p.netPay)}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/10">
                  {p.status === 'draft' && (<>
                    <button onClick={() => openEdit(p)} className="btn-ghost text-xs py-1.5 px-2.5">Edit</button>
                    <button onClick={() => handleRelease(p._id,'pending')} className="px-2.5 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs hover:bg-yellow-500/30">Release</button>
                    <button onClick={() => handleDelete(p._id)} className="text-white/20 hover:text-red-400 p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>)}
                  {p.status === 'pending' && (
                    <button onClick={() => { setPayTarget(p); setShowPay(true); }}
                      className="px-2.5 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs hover:bg-green-500/30 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                    </button>
                  )}
                  {p.status === 'paid' && <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Paid</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet: table */}
          <div className="hidden md:block card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                {['#','Freelancer','Project','Period','Days','Rate/Day','Net Pay','Status','Actions'].map(h => (
                  <th key={h} className="text-left py-3 pr-4 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payrolls.map(p => (
                <tr key={p._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 font-mono text-primary text-xs font-bold">{p.payrollNumber}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                        {p.freelancer?.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{p.freelancer?.name}</p>
                        {p.role && <p className="text-white/40 text-xs">{p.role}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-white/60 max-w-[120px] truncate">{p.event?.eventName || '—'}</td>
                  <td className="py-3 pr-4 text-white/60 text-xs whitespace-nowrap">
                    {formatDate(p.period?.from || p.period?.to)}
                  </td>
                  <td className="py-3 pr-4 text-white/70">
                    {p.daysWorked}{p.freelancer?.rateType === 'hourly' ? 'h' : p.freelancer?.rateType === 'fixed' ? 'x' : 'd'}
                  </td>
                  <td className="py-3 pr-4 text-white/70 font-mono">{formatCurrency(p.ratePerDay)}</td>
                  <td className="py-3 pr-4 text-primary font-mono font-bold">{formatCurrency(p.netPay)}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${STATUS[p.status]?.cls}`}>{STATUS[p.status]?.label}</span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5">
                      {p.status === 'draft' && (<>
                        <button onClick={() => openEdit(p)} className="btn-ghost text-xs py-1 px-2">Edit</button>
                        <button onClick={() => handleRelease(p._id,'pending')} className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs hover:bg-yellow-500/30">Release</button>
                        <button onClick={() => handleDelete(p._id)} className="text-white/20 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>)}
                      {p.status === 'pending' && (
                        <button onClick={() => { setPayTarget(p); setShowPay(true); }}
                          className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs hover:bg-green-500/30 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                        </button>
                      )}
                      {p.status === 'paid' && <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Paid</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Payroll Entry" size="lg">
        <PayForm form={form} setForm={setForm} freelancers={freelancers} events={events}
          onSubmit={handleCreate} submitLabel="Create Payroll" onCancel={() => setShowCreate(false)} saving={saving} />
      </Modal>
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Payroll Entry" size="lg">
        <PayForm form={form} setForm={setForm} freelancers={freelancers} events={events}
          onSubmit={handleEdit} submitLabel="Save Changes" onCancel={() => setShowEdit(false)} saving={saving} />
      </Modal>
      <Modal isOpen={showPay} onClose={() => setShowPay(false)} title="Mark as Paid">
        {payTarget && (
          <form onSubmit={handlePay} className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-white font-semibold">{payTarget.freelancer?.name}</p>
              <p className="text-white/50 text-sm">{payTarget.payrollNumber}</p>
              <p className="text-green-400 text-2xl font-black mt-1">{formatCurrency(payTarget.netPay)}</p>
            </div>
            <div>
              <label className="label">Reference Number <span className="text-white/30">(Optional)</span></label>
              <input className="input" placeholder="GCash / bank reference..." value={payRef} onChange={e => setPayRef(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowPay(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />{saving ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}