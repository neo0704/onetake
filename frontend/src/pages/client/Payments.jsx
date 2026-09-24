import React, { useEffect, useState, useRef } from 'react';
import { CreditCard, Plus, X, Smartphone, Building2, Wallet, QrCode } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import { formatDate, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── Helpers ─────────────────────────────────────────────────────────────────
const getBackendUrl = (filePath) => {
  if (!filePath) return '';
  // Already an absolute URL (e.g. Cloudinary's secure_url) — use as-is.
  // Only old-style relative paths like "/uploads/qr/gcash.png" need the
  // backend origin prepended.
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const origin = apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${origin}${filePath}`;
};

// ── usePaymentQR — fetches the active QR config for a given method ───────────
function usePaymentQR(method) {
  const [qr,      setQr]      = useState(null);
  const [loading, setLoading] = useState(false);
  const prevMethod = useRef(null);

  useEffect(() => {
    if (!method || method === 'cash') { setQr(null); return; }
    if (prevMethod.current === method) return;   // skip redundant fetches
    prevMethod.current = method;
    setLoading(true);
    api.get(`/payment-qr?method=${method}`)
      .then(({ data }) => setQr(data.qrs?.[0] ?? null))
      .catch(() => setQr(null))
      .finally(() => setLoading(false));
  }, [method]);

  return { qr, loading };
}

// Payment methods that show a QR section
const QR_METHODS = ['gcash', 'maya', 'bank_transfer'];

const METHODS = [
  {
    value: 'gcash',
    label: 'GCash',
    icon: Smartphone,
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    active: 'bg-blue-500/20 border-blue-500 text-blue-300',
    refLabel: 'GCash Reference Number',
    refPlaceholder: 'e.g. 1234567890',
  },
  {
    value: 'maya',
    label: 'Maya',
    icon: Wallet,
    color: 'bg-green-500/10 border-green-500/30 text-green-400',
    active: 'bg-green-500/20 border-green-500 text-green-300',
    refLabel: 'Maya Reference Number',
    refPlaceholder: 'e.g. 9876543210',
  },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    icon: Building2,
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    active: 'bg-purple-500/20 border-purple-500 text-purple-300',
    refLabel: 'Bank Transaction / Reference Number',
    refPlaceholder: 'e.g. TRN-20240101-123456',
  },
  {
    value: 'cash',
    label: 'Cash',
    icon: CreditCard,
    color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    active: 'bg-yellow-500/20 border-yellow-500 text-yellow-300',
    refLabel: null,
    refPlaceholder: null,
  },
];

export default function ClientPayments() {
  const [payments,      setPayments]      = useState([]);
  const [events,        setEvents]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [proofFile,     setProofFile]     = useState(null);
  const [paySummary,    setPaySummary]    = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [form, setForm] = useState({
    eventId: '', type: 'downpayment', amount: '',
    method: 'gcash', referenceNumber: '', notes: '',
  });

  // Derive whether the selected event is in the "pending balance" phase
  // (i.e. the event is done but balance hasn't been paid yet).
  const isCompletedPendingBalance =
    selectedEvent?.status === 'completed_pending_balance';

  // Payment type options shown depend on where we are in the workflow:
  //   • completed_pending_balance  → only "Balance" is valid
  //   • downpayment not yet made   → "50% Downpayment" or "Full Payment"
  //     (Full Payment here means the client pays 100% upfront and the event
  //      should be treated as fully paid at the downpayment stage — NOT skip
  //      ahead to completed. We therefore send type='full' only when a prior
  //      downpayment already exists so the backend knows it's the final balance.)
  //   • downpayment already made   → "Balance" or "Full Payment" (remainder)
  const hasDownpayment = (paySummary?.totalPaid || 0) > 0;

  // Phase 1 (no payment yet): only 50% downpayment allowed.
  // Phase 2 (downpayment done OR event completed_pending_balance): only balance allowed.
  // Full Payment removed entirely to prevent skipping workflow stages.
  const availableTypes = (hasDownpayment || isCompletedPendingBalance)
    ? [{ value: 'balance',     label: 'Balance'         }]
    : [{ value: 'downpayment', label: '50% Downpayment' }];

  const fetchData = async () => {
    try {
      const [pRes, eRes] = await Promise.all([
        api.get('/payments'),
        api.get('/events'),
      ]);
      setPayments(pRes.data.payments || []);
      setEvents((eRes.data.events || []).filter(e =>
        ['quotation_sent','confirmed','downpayment_paid','assigned','in_progress','completed_pending_balance'].includes(e.status)
      ));
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const onEventChange = async (eventId) => {
    const ev = events.find(e => e._id === eventId) || null;
    setSelectedEvent(ev);
    setForm(f => ({ ...f, eventId, amount: '' }));
    setPaySummary(null);
    if (!eventId) return;
    try {
      const { data } = await api.get(`/payments/summary/${eventId}`);
      const s = data.summary;
      setPaySummary(s);
      if (s?.quotation) {
        // Determine the correct default type based on event status and paid amount.
        const isPendingBalance = ev?.status === 'completed_pending_balance';
        const alreadyPaid      = (s.totalPaid || 0) > 0;
        const defaultType = isPendingBalance || alreadyPaid ? 'balance' : 'downpayment';
        setForm(f => ({
          ...f,
          type:   defaultType,
          amount: calcAmount(defaultType, s).toString(),
        }));
      }
    } catch {}
  };

  const calcAmount = (type, summary) => {
    if (!summary?.quotation) return '';
    const total = summary.totalAmount || 0;
    const paid  = summary.totalPaid   || 0;
    if (type === 'downpayment') return (total * 0.5).toString();
    if (type === 'balance')     return Math.max(0, total - paid).toString();
    if (type === 'full')        return total.toString();
    return '';
  };

  const onTypeChange = (type) => {
    setForm(f => ({ ...f, type, amount: calcAmount(type, paySummary) }));
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const submit = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (proofFile) fd.append('proof', proofFile);
      await api.post('/payments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Payment submitted. Awaiting verification.');
      setShowModal(false);
      setProofFile(null);
      setPaySummary(null);
      setSelectedEvent(null);
      setForm({ eventId:'', type:'downpayment', amount:'', method:'gcash', referenceNumber:'', notes:'' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const selectedMethod = METHODS.find(m => m.value === form.method) || METHODS[0];
  const showQR = QR_METHODS.includes(form.method);

  // Dynamic QR from backend
  const { qr: activeQR, loading: qrLoading } = usePaymentQR(showQR ? form.method : null);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Payments" subtitle="Track your payment history"
        action={
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Submit Payment
          </button>
        } />

      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments yet"
          description="Submit your downpayment to confirm your booking."
          action={<button onClick={() => setShowModal(true)} className="btn-primary">Submit Payment</button>} />
      ) : (
        <div className="space-y-3">
          {payments.map(p => {
            const m = METHODS.find(x => x.value === p.method);
            const Icon = m?.icon || CreditCard;
            return (
              <div key={p._id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m?.color || 'bg-white/10 text-white/50'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-primary text-xs font-bold">{p.paymentNumber}</span>
                        <span className={`badge ${p.type === 'downpayment' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{p.type}</span>
                        <span className={`badge ${p.status === 'verified' ? 'bg-green-500/20 text-green-400' : p.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{p.status}</span>
                      </div>
                      <h3 className="text-white font-semibold mt-1">{p.event?.eventName}</h3>
                      <p className="text-white/50 text-sm capitalize">{p.method?.replace('_',' ')}
                        {p.referenceNumber && <span className="text-white/30"> · Ref: {p.referenceNumber}</span>}
                      </p>
                      {p.status === 'rejected' && p.rejectionReason && (
                        <p className="text-red-400 text-xs mt-1">{p.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white font-bold text-lg">{formatCurrency(p.amount)}</p>
                    <p className="text-white/40 text-xs">{formatDate(p.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Payment Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setSelectedEvent(null); setPaySummary(null); setForm({ eventId:'', type:'downpayment', amount:'', method:'gcash', referenceNumber:'', notes:'' }); }} title="Submit Payment">
        <form onSubmit={handleSubmitClick} className="space-y-4">

          {showQR && (() => {
            const methodMeta = {
              gcash:         { gradient: 'from-blue-600 to-blue-400',   badge: 'bg-blue-400/20 text-blue-200',   ring: 'ring-blue-400/30' },
              maya:          { gradient: 'from-green-600 to-emerald-400', badge: 'bg-green-400/20 text-green-200', ring: 'ring-green-400/30' },
              bank_transfer: { gradient: 'from-purple-600 to-violet-400', badge: 'bg-purple-400/20 text-purple-200', ring: 'ring-purple-400/30' },
            };
            const meta = methodMeta[form.method] || methodMeta.gcash;
            const methodLabel = METHODS.find(m => m.value === form.method)?.label;

            return (
              <div className="-mt-2">
                {qrLoading ? (
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col items-center gap-4">
                    <div className="w-full h-8 rounded-lg bg-white/10 animate-pulse" />
                    <div className="w-48 h-48 rounded-2xl bg-white/10 animate-pulse" />
                    <div className="space-y-2 w-full flex flex-col items-center">
                      <div className="h-3 w-36 rounded bg-white/10 animate-pulse" />
                      <div className="h-3 w-28 rounded bg-white/10 animate-pulse" />
                    </div>
                  </div>
                ) : activeQR ? (
                  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                    {/* Gradient header */}
                    <div className={`bg-gradient-to-r ${meta.gradient} px-5 py-3.5 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-white/80" />
                        <span className="text-white font-bold text-sm tracking-wide uppercase">
                          Scan to Pay
                        </span>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge} backdrop-blur-sm`}>
                        {methodLabel}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="bg-[#0f1729] px-5 py-5 flex flex-col items-center gap-4">
                      {/* QR image with glowing ring */}
                      <div className={`p-1 rounded-2xl ring-2 ${meta.ring} shadow-lg`}>
                        <div className="bg-white p-3 rounded-xl">
                          <img
                            src={getBackendUrl(activeQR.qrImageUrl)}
                            alt={`${methodLabel} QR code`}
                            className="w-52 h-52 object-contain rounded-lg"
                          />
                        </div>
                      </div>

                      {/* Account info */}
                      <div className="w-full text-center space-y-1">
                        <p className="text-white font-bold text-base">{activeQR.label}</p>
                        {activeQR.accountName && (
                          <p className="text-white/50 text-xs">{activeQR.accountName}</p>
                        )}
                        {activeQR.accountNumber && (
                          <div className="inline-flex items-center gap-2 mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-white font-mono text-sm tracking-widest">{activeQR.accountNumber}</span>
                          </div>
                        )}
                      </div>

                      {/* Instructions */}
                      {activeQR.instructions && (
                        <div className="w-full flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-left">
                          <span className="text-white/30 mt-0.5 text-xs">ℹ</span>
                          <p className="text-white/50 text-xs leading-relaxed">{activeQR.instructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 flex flex-col items-center gap-2 text-center">
                    <QrCode className="w-8 h-8 text-white/20" />
                    <p className="text-white/40 text-sm font-medium">No QR code available for {methodLabel}</p>
                    <p className="text-white/25 text-xs">Enter the reference number and upload proof below.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Project */}
          <div>
            <label className="label">Project *</label>
            <select className="input" value={form.eventId}
              onChange={e => onEventChange(e.target.value)} required>
              <option value="">Select a project...</option>
              {events.map(ev => <option key={ev._id} value={ev._id}>{ev.eventName}</option>)}
            </select>
          </div>

          {/* Payment summary */}
          {paySummary?.quotation && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-white/50">Total Package</span>
                <span className="text-white font-bold">{formatCurrency(paySummary.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">50% Downpayment</span>
                <span className="text-yellow-400 font-bold">{formatCurrency(paySummary.totalAmount * 0.5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Already Paid</span>
                <span className="text-green-400">{formatCurrency(paySummary.totalPaid || 0)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-white/10">
                <span className="text-white/50">Balance Remaining</span>
                <span className="text-orange-400 font-bold">{formatCurrency(Math.max(0, paySummary.totalAmount - (paySummary.totalPaid || 0)))}</span>
              </div>
            </div>
          )}

          {/* Payment type */}
          <div>
            <label className="label">Payment Type *</label>
            <div className={`grid gap-2 ${availableTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {availableTypes.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => onTypeChange(opt.value)}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all text-center
                    ${form.type === opt.value
                      ? 'border-primary bg-primary/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/50 hover:text-white'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {isCompletedPendingBalance && (
              <p className="text-white/40 text-xs mt-1.5">
                Your event is complete — only the remaining balance can be paid at this stage.
              </p>
            )}
            {!isCompletedPendingBalance && hasDownpayment && (
              <p className="text-white/40 text-xs mt-1.5">
                Downpayment already received — settling the remaining balance.
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="label">Amount (₱) *
              {paySummary && <span className="text-primary/70 text-xs ml-2 font-normal">auto-filled</span>}
            </label>
            <input type="number" min="1" step="0.01" className="input" placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>

          {/* Payment method */}
          <div>
            <label className="label">Payment Method *</label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(m => {
                const Icon = m.icon;
                return (
                  <button key={m.value} type="button"
                    onClick={() => setForm(f => ({ ...f, method: m.value, referenceNumber: '' }))}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-2
                      ${form.method === m.value ? m.active : m.color}`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />{m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference number */}
          {selectedMethod.refLabel && (
            <div>
              <label className="label">{selectedMethod.refLabel} *</label>
              <input className="input" placeholder={selectedMethod.refPlaceholder}
                value={form.referenceNumber}
                onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
                required={form.method !== 'cash'} />
            </div>
          )}

          {/* Proof upload */}
          {form.method !== 'cash' && (
            <div>
              <label className="label">Proof of Payment (screenshot)</label>
              <label className={`flex items-center gap-3 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                ${proofFile ? 'border-primary/50 bg-primary/5' : 'border-white/20 hover:border-white/40'}`}>
                {proofFile ? (
                  <>
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{proofFile.name}</p>
                      <p className="text-white/40 text-xs">{(proofFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button type="button" onClick={e => { e.preventDefault(); setProofFile(null); }}
                      className="text-white/30 hover:text-red-400 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-white/30 flex-shrink-0" />
                    <div>
                      <p className="text-white/60 text-sm">Click to upload screenshot</p>
                      <p className="text-white/30 text-xs">PNG, JPG — max 10MB</p>
                    </div>
                  </>
                )}
                <input type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => setProofFile(e.target.files[0])} />
              </label>
            </div>
          )}

          {/* Cash message */}
          {form.method === 'cash' && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-yellow-400 text-sm font-medium">Cash Payment</p>
              <p className="text-yellow-400/70 text-xs mt-1">
                Please bring the exact cash amount. Our team will provide an official receipt upon collection.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notes <span className="text-white/30">(Optional)</span></label>
            <textarea className="input min-h-[60px]" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional information..." />
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-400 text-xs">
              Payment will be verified within 24 hours. Your booking is confirmed once the downpayment is verified.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowModal(false); setSelectedEvent(null); setPaySummary(null); setForm({ eventId:'', type:'downpayment', amount:'', method:'gcash', referenceNumber:'', notes:'' }); }} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Confirmation dialog ───────────────────────────────────────── */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Payment Submission"
      >
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Please review your payment details before submitting. This will be sent to our team for verification.
          </p>

          {/* Summary */}
          <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
            {[
              {
                label: 'Project',
                value: events.find(e => e._id === form.eventId)?.eventName || '—',
              },
              {
                label: 'Payment Type',
                value: availableTypes.find(t => t.value === form.type)?.label || form.type,
              },
              {
                label: 'Amount',
                value: form.amount ? formatCurrency(parseFloat(form.amount)) : '—',
                highlight: true,
              },
              {
                label: 'Method',
                value: METHODS.find(m => m.value === form.method)?.label || form.method,
              },
              ...(form.referenceNumber ? [{
                label: selectedMethod.refLabel || 'Reference No.',
                value: form.referenceNumber,
              }] : []),
              ...(proofFile ? [{
                label: 'Proof of Payment',
                value: proofFile.name,
              }] : []),
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center px-4 py-3 text-sm">
                <span className="text-white/50">{row.label}</span>
                <span className={row.highlight ? 'text-primary font-bold text-base' : 'text-white font-medium'}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-400 text-xs">
              Once submitted, our team will verify your payment within 24 hours. You will be notified once it is confirmed.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="btn-secondary flex-1 justify-center"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="btn-primary flex-1 justify-center"
            >
              {submitting ? 'Submitting...' : 'Confirm & Submit'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Custom Upload Icon
function Upload(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}