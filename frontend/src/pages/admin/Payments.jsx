import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle, XCircle, Eye, QrCode,
  Upload, Trash2, ToggleLeft, ToggleRight,
  Pencil, Plus, X, CreditCard, List
} from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { formatDate, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── QR method config (shared) ────────────────────────────────────────────────
const QR_METHODS = [
  { value: 'gcash',         label: 'GCash',         color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  { value: 'maya',          label: 'Maya',           color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  { value: 'bank_transfer', label: 'Bank Transfer',  color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { value: 'cash',          label: 'Cash',           color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { value: 'check',         label: 'Check',          color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { value: 'other',         label: 'Other',          color: 'text-white/50',   bg: 'bg-white/5',       border: 'border-white/10'      },
];

const defaultQRForm = {
  method: '', label: '', accountName: '',
  accountNumber: '', instructions: '', isActive: true,
  qrFile: null, qrPreview: null,
};

// ════════════════════════════════════════════════════════════════════════════
export default function AdminPayments() {

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('payments'); // 'payments' | 'qr'

  // ── Confirm dialog ─────────────────────────────────────────────────────────
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', type: 'info', confirmLabel: 'Confirm', onConfirm: null, loading: false });
  const askConfirm  = (opts) => setConfirm({ open: true, loading: false, ...opts });
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false, loading: false }));
  const runConfirm  = async () => {
    setConfirm(c => ({ ...c, loading: true }));
    try { await confirm.onConfirm(); } finally { closeConfirm(); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 1 — PAYMENTS
  // ══════════════════════════════════════════════════════════════════════════
  const [payments,        setPayments]        = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [selected,        setSelected]        = useState(null);
  const [rejectReason,    setRejectReason]    = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [proofModal,      setProofModal]      = useState(null);

  const fetchPayments = async () => {
    const { data } = await api.get('/payments');
    setPayments(data.payments);
    setPaymentsLoading(false);
  };
  useEffect(() => { fetchPayments(); }, []);

  const verify = async (id, status, reason) => {
    await api.put(`/payments/${id}/verify`, { status, rejectionReason: reason });
    toast.success(status === 'verified' ? '✅ Payment verified!' : '❌ Payment rejected');
    fetchPayments();
    setSelected(null);
    setShowRejectModal(false);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2 — QR SETTINGS
  // ══════════════════════════════════════════════════════════════════════════
  const [qrs,       setQrs]       = useState([]);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrModal,   setQrModal]   = useState(false);
  const [qrForm,    setQrForm]    = useState(defaultQRForm);
  const [qrSaving,  setQrSaving]  = useState(false);
  const [qrPreviewFull, setQrPreviewFull] = useState(null);
  const fileRef = useRef();

  const fetchQRs = async () => {
    try {
      const { data } = await api.get('/payment-qr');
      setQrs(data.qrs);
    } finally { setQrLoading(false); }
  };
  useEffect(() => { fetchQRs(); }, []);

  const qrMap = Object.fromEntries(qrs.map(q => [q.method, q]));

  const openQRModal = (method) => {
    const existing = qrMap[method] || {};
    setQrForm({
      method,
      label:         existing.label         || QR_METHODS.find(m => m.value === method)?.label || '',
      accountName:   existing.accountName   || '',
      accountNumber: existing.accountNumber || '',
      instructions:  existing.instructions  || '',
      isActive:      existing.isActive      ?? true,
      qrFile: null,
      qrPreview: existing.qrImageUrl ? getBackendUrl(existing.qrImageUrl) : null,
    });
    setQrModal(true);
  };

  const handleQRFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQrForm(f => ({ ...f, qrFile: file, qrPreview: URL.createObjectURL(file) }));
  };

  const handleQRSave = async () => {
    if (!qrForm.label.trim()) return toast.error('Label is required');
    setQrSaving(true);
    try {
      const fd = new FormData();
      fd.append('method',        qrForm.method);
      fd.append('label',         qrForm.label);
      fd.append('accountName',   qrForm.accountName);
      fd.append('accountNumber', qrForm.accountNumber);
      fd.append('instructions',  qrForm.instructions);
      fd.append('isActive',      qrForm.isActive);
      if (qrForm.qrFile) fd.append('qrImage', qrForm.qrFile);
      await api.post('/payment-qr', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('QR config saved!');
      setQrModal(false);
      fetchQRs();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setQrSaving(false); }
  };

  const handleQRToggle = async (method) => {
    try {
      await api.patch(`/payment-qr/${method}/toggle`);
      fetchQRs();
    } catch { toast.error('Toggle failed'); }
  };

  const handleQRDelete = (method) => {
    askConfirm({
      title: 'Remove QR Config?',
      message: `This will delete the QR code and settings for ${QR_METHODS.find(m => m.value === method)?.label}. Clients won't see a QR for this method.`,
      type: 'danger',
      confirmLabel: 'Yes, Delete',
      onConfirm: async () => {
        await api.delete(`/payment-qr/${method}`);
        toast.success('QR config removed');
        fetchQRs();
      }
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <PageHeader
        title="Payments"
        subtitle={tab === 'payments' ? 'Review and verify client payments' : 'Manage QR codes clients see per payment method'}
      />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit border border-white/10">
        <button
          onClick={() => setTab('payments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${tab === 'payments' ? 'bg-primary text-white shadow' : 'text-white/50 hover:text-white'}`}
        >
          <List className="w-4 h-4" /> Payments
          {payments.filter(p => p.status === 'pending').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full leading-none">
              {payments.filter(p => p.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('qr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${tab === 'qr' ? 'bg-primary text-white shadow' : 'text-white/50 hover:text-white'}`}
        >
          <QrCode className="w-4 h-4" /> QR Settings
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB: PAYMENTS
      ════════════════════════════════════════════════════════════════════ */}
      {tab === 'payments' && (
        <>
          {paymentsLoading ? <LoadingSpinner /> : (
            <>
              {payments.filter(p => p.status === 'pending').length > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <p className="text-yellow-400 font-medium">
                    ⚠ {payments.filter(p => p.status === 'pending').length} payment(s) pending verification
                  </p>
                </div>
              )}

              {/* Mobile: card list */}
              <div className="md:hidden space-y-3">
                {payments.length === 0 && <div className="card"><EmptyState title="No payments yet" description="Client payments will appear here" /></div>}
                {payments.map(p => (
                  <div key={p._id} className="card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-primary text-xs">{p.paymentNumber}</p>
                        <p className="text-white font-semibold truncate">{p.event?.eventName}</p>
                        <p className="text-white/60 text-sm truncate">{p.client?.name}</p>
                      </div>
                      <span className={`badge shrink-0 ${p.status === 'verified' ? 'bg-green-500/20 text-green-400' : p.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {p.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className={`badge ${p.type === 'downpayment' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{p.type}</span>
                      <span className="text-white/50 capitalize">{p.method?.replace('_', ' ')}</span>
                      {p.referenceNumber && <span className="text-white/40 font-mono">{p.referenceNumber}</span>}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/40 text-xs">{formatDate(p.createdAt)}</span>
                      <span className="text-white font-mono font-medium">{formatCurrency(p.amount)}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                      {p.proofUrl && (
                        <button onClick={() => setProofModal(getBackendUrl(p.proofUrl))}
                          className="btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Proof
                        </button>
                      )}
                      {p.status === 'pending' && (
                        <>
                          <button onClick={() => askConfirm({
                            title: 'Verify Payment?',
                            message: `Confirm that ${p.client?.name}'s ${p.type} payment of ${formatCurrency(p.amount)} via ${p.method?.replace('_',' ')} is valid?`,
                            type: 'success',
                            confirmLabel: 'Yes, Verify',
                            onConfirm: () => verify(p._id, 'verified')
                          })} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500/20 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors text-xs">
                            <CheckCircle className="w-3.5 h-3.5" /> Verify
                          </button>
                          <button onClick={() => { setSelected(p._id); setShowRejectModal(true); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors text-xs">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
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
                      {['Pay #','Project','Client','Type','Amount','Method','Reference','Status','Date','Actions'].map(h => (
                        <th key={h} className="text-left py-3 pr-4 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p._id} className="table-row">
                        <td className="py-3 pr-4 font-mono text-primary text-xs">{p.paymentNumber}</td>
                        <td className="py-3 pr-4 text-white">{p.event?.eventName}</td>
                        <td className="py-3 pr-4 text-white/70">{p.client?.name}</td>
                        <td className="py-3 pr-4">
                          <span className={`badge ${p.type === 'downpayment' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{p.type}</span>
                        </td>
                        <td className="py-3 pr-4 text-white font-medium font-mono">{formatCurrency(p.amount)}</td>
                        <td className="py-3 pr-4 text-white/70 capitalize">{p.method?.replace('_', ' ')}</td>
                        <td className="py-3 pr-4 text-white/50 font-mono text-xs">{p.referenceNumber || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className={`badge ${p.status === 'verified' ? 'bg-green-500/20 text-green-400' : p.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-white/40 text-xs">{formatDate(p.createdAt)}</td>
                        <td className="py-3">
                          <div className="flex gap-1.5">
                            {p.proofUrl && (
                              <button onClick={() => setProofModal(getBackendUrl(p.proofUrl))}
                                className="btn-ghost text-xs py-1 px-2">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {p.status === 'pending' && (
                              <>
                                <button onClick={() => askConfirm({
                                  title: 'Verify Payment?',
                                  message: `Confirm that ${p.client?.name}'s ${p.type} payment of ${formatCurrency(p.amount)} via ${p.method?.replace('_',' ')} is valid?`,
                                  type: 'success',
                                  confirmLabel: 'Yes, Verify',
                                  onConfirm: () => verify(p._id, 'verified')
                                })} className="p-1.5 bg-green-500/20 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors">
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => { setSelected(p._id); setShowRejectModal(true); }}
                                  className="p-1.5 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payments.length === 0 && <EmptyState title="No payments yet" description="Client payments will appear here" />}
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: QR SETTINGS
      ════════════════════════════════════════════════════════════════════ */}
      {tab === 'qr' && (
        <>
          {qrLoading ? <LoadingSpinner /> : (
            <>
              {qrs.filter(q => q.isActive).length === 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <p className="text-yellow-400 font-medium text-sm">
                    ⚠ No active QR codes. Clients won't see payment QR codes until you configure at least one.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {QR_METHODS.map((m) => {
                  const qr = qrMap[m.value];
                  return (
                    <div key={m.value} className={`card flex flex-col gap-4 border ${m.border} ${m.bg}`}>
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <QrCode className={`w-4 h-4 ${m.color}`} />
                          <span className={`font-semibold text-sm ${m.color}`}>{m.label}</span>
                        </div>
                        {qr && (
                          <span className={`badge text-xs ${qr.isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                            {qr.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </div>

                      {/* QR image */}
                      {qr?.qrImageUrl ? (
                        <div className="relative group w-full aspect-square max-w-[160px] mx-auto">
                          <img
                            src={getBackendUrl(qr.qrImageUrl)}
                            alt={`${m.label} QR`}
                            className="w-full h-full object-contain rounded-lg border border-white/10 bg-white"
                          />
                          <button
                            onClick={() => setQrPreviewFull(getBackendUrl(qr.qrImageUrl))}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity"
                          >
                            <Eye className="w-6 h-6 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full aspect-square max-w-[160px] mx-auto flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 text-white/20">
                          <QrCode className="w-10 h-10" />
                          <span className="text-xs">No QR uploaded</span>
                        </div>
                      )}

                      {/* Account info */}
                      {qr?.label && (
                        <div className="space-y-0.5 text-xs">
                          <p className="text-white font-medium">{qr.label}</p>
                          {qr.accountName   && <p className="text-white/50">{qr.accountName}</p>}
                          {qr.accountNumber && <p className="text-white/40 font-mono">{qr.accountNumber}</p>}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
                        <button onClick={() => openQRModal(m.value)}
                          className="btn-secondary flex-1 justify-center text-xs py-1.5 gap-1.5">
                          {qr ? <><Pencil className="w-3.5 h-3.5" /> Edit</> : <><Plus className="w-3.5 h-3.5" /> Setup</>}
                        </button>
                        {qr && (
                          <>
                            <button onClick={() => handleQRToggle(m.value)}
                              title={qr.isActive ? 'Deactivate' : 'Activate'}
                              className={`p-1.5 rounded-lg transition-colors ${qr.isActive ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>
                              {qr.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button onClick={() => handleQRDelete(m.value)}
                              className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Reject Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Payment">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">Provide a reason for rejecting this payment.</p>
          <textarea className="input min-h-[100px]" placeholder="e.g. Invalid reference number, blurry screenshot..."
            value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <div className="flex gap-3">
            <button onClick={() => setShowRejectModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => verify(selected, 'rejected', rejectReason)}
              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold">
              Reject Payment
            </button>
          </div>
        </div>
      </Modal>

      {/* ── QR Edit Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={qrModal} onClose={() => setQrModal(false)}
        title={`${QR_METHODS.find(m => m.value === qrForm.method)?.label} — QR Setup`}>
        <div className="space-y-4">
          {/* Upload area */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative group w-40 h-40 flex items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/5 cursor-pointer overflow-hidden"
              onClick={() => fileRef.current.click()}
            >
              {qrForm.qrPreview ? (
                <>
                  <img src={qrForm.qrPreview} alt="QR preview" className="w-full h-full object-contain bg-white rounded-lg" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/30">
                  <Upload className="w-8 h-8" />
                  <span className="text-xs text-center">Click to upload QR image</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleQRFile} />
            <p className="text-white/30 text-xs">PNG or JPG, max 5MB</p>
          </div>

          <div>
            <label className="label">Display Label <span className="text-red-400">*</span></label>
            <input className="input" placeholder="e.g. GCash – Juan Dela Cruz"
              value={qrForm.label}
              onChange={e => setQrForm(f => ({ ...f, label: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Account Name</label>
              <input className="input" placeholder="Juan Dela Cruz"
                value={qrForm.accountName}
                onChange={e => setQrForm(f => ({ ...f, accountName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Account / Number</label>
              <input className="input" placeholder="09XX XXX XXXX"
                value={qrForm.accountNumber}
                onChange={e => setQrForm(f => ({ ...f, accountNumber: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Client Instructions</label>
            <textarea className="input min-h-[80px]"
              placeholder="e.g. Scan QR, enter exact amount, take a screenshot as proof."
              value={qrForm.instructions}
              onChange={e => setQrForm(f => ({ ...f, instructions: e.target.value }))} />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div onClick={() => setQrForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${qrForm.isActive ? 'bg-primary' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${qrForm.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className="text-white/70 text-sm">
              {qrForm.isActive ? 'Active — clients will see this QR' : 'Inactive — hidden from clients'}
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setQrModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleQRSave} disabled={qrSaving}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {qrSaving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                : <><CheckCircle className="w-4 h-4" /> Save QR</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Proof image modal ────────────────────────────────────────────── */}
      {proofModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setProofModal(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setProofModal(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm flex items-center gap-1">
              ✕ Close
            </button>
            <img src={proofModal} alt="Payment proof"
              className="w-full max-h-[80vh] object-contain rounded-xl border border-white/10 shadow-2xl"
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
            <p style={{ display:'none' }} className="text-white/50 text-center py-8">
              Could not load image.{' '}
              <a href={proofModal} target="_blank" rel="noreferrer" className="text-primary underline">Open directly</a>
            </p>
          </div>
        </div>
      )}

      {/* ── QR full-size preview ─────────────────────────────────────────── */}
      {qrPreviewFull && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setQrPreviewFull(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setQrPreviewFull(null)}
              className="absolute -top-9 right-0 text-white/60 hover:text-white text-sm flex items-center gap-1">
              <X className="w-4 h-4" /> Close
            </button>
            <img src={qrPreviewFull} alt="QR preview"
              className="w-full rounded-xl border border-white/10 shadow-2xl bg-white" />
          </div>
        </div>
      )}

      {/* ── Shared confirm dialog ────────────────────────────────────────── */}
      <ConfirmDialog isOpen={confirm.open} onClose={closeConfirm} onConfirm={runConfirm}
        title={confirm.title} message={confirm.message} type={confirm.type}
        confirmLabel={confirm.confirmLabel} loading={confirm.loading} />
    </div>
  );
}