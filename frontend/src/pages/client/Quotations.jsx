import React, { useEffect, useState } from 'react';
import { FileText, CheckCircle, XCircle, ChevronDown, ChevronUp, MessageSquare, Send } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { formatDate, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

// Resolves a backend file path (e.g. /uploads/...) to a full URL
const getBackendUrl = (filePath) => {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  // Strip trailing /api or /api/ to get the backend origin
  const origin = apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${origin}${filePath}`;
};

// ── Livetake company info ──────────────────────────────────────────────────────
const COMPANY = {
  phone:   '0906 8642 868 | 0939 1423 567',
  bir:     'BIR Reg. 1RC0001344118 | DTI Reg. No. 1170472',
  address: 'Block E11 Lot 10, San Lorenzo 1, City of Dasmariñas, Cavite',
  email:   'livetakeproductions@gmail.com',
};

function QuotationCard({ q }) {
  const [open, setOpen] = useState(false);

  // ── Comments thread ──
  const [showComments,    setShowComments]    = useState(false);
  const [comments,        setComments]        = useState([]);
  const [commentsLoaded,  setCommentsLoaded]  = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText,     setCommentText]     = useState('');
  const [posting,         setPosting]         = useState(false);

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/quotations/${q._id}/comments`);
      setComments(data.comments || []);
      setCommentsLoaded(true);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) loadComments();
  };

  const postComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/quotations/${q._id}/comments`, { text });
      setComments(prev => [...prev, data.comment]);
      setCommentText('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  const statusColors = {
    draft:    'bg-gray-500/20   text-gray-400',
    sent:     'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-green-500/20  text-green-400',
    rejected: 'bg-red-500/20    text-red-400',
  };

  return (
    <div className="card">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-primary text-sm font-bold">{q.quotationNumber}</span>
            <span className={`badge ${statusColors[q.status] || 'bg-gray-500/20 text-gray-400'}`}>
              {q.status}
            </span>
          </div>
          <h3 className="text-white font-bold text-lg truncate">{q.event?.eventName}</h3>
          <p className="text-white/50 text-sm mt-0.5 truncate">
            {formatDate(q.event?.eventDate)} · {q.event?.location}
          </p>

          {/* Totals strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 p-3 bg-white/5 rounded-xl">
            <div>
              <p className="text-white/40 text-xs">Total Amount</p>
              <p className="text-white font-bold text-base">{formatCurrency(q.totalAmount)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">50% Downpayment</p>
              <p className="text-yellow-400 font-bold">{formatCurrency(q.paymentTerms?.downpaymentAmount)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Balance</p>
              <p className="text-white/70 font-medium">{formatCurrency(q.paymentTerms?.balanceAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Draft — client cannot see content yet */}
      {q.status === 'draft' && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-yellow-400 font-semibold text-sm">Quotation Being Prepared</p>
              <p className="text-yellow-400/70 text-xs mt-0.5">
                Our team is finalizing your quotation. You'll be notified once it's ready for your review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Toggle full details + Download PDF ── */}
      {q.status !== 'draft' && (
        <>
          <div className="flex items-center border-t border-white/10 mt-4">
            <button onClick={() => setOpen(v => !v)}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-white/40 hover:text-white transition-colors text-sm min-w-0">
              {open
                ? <><ChevronUp className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Hide package details</span></>
                : <><ChevronDown className="w-4 h-4 flex-shrink-0" /> <span className="truncate">View full package details</span></>}
            </button>
            {/* View Quotation — opens admin-uploaded PDF inline OR system print view */}
            <button
              onClick={() => {
                if (q.quotationSendType === 'pdf' && q.quotationPdfUrl) {
                  // Admin uploaded a custom PDF — build full backend URL and open it
                  window.open(getBackendUrl(q.quotationPdfUrl), '_blank');
                } else {
                  // System-generated print view
                  sessionStorage.setItem(`qprint_${q._id}`, JSON.stringify(q));
                  window.open(`/quotation/print/${q._id}`, '_blank');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary/80 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border-l border-white/10 flex-shrink-0 whitespace-nowrap"
              title={q.quotationSendType === 'pdf' && q.quotationPdfUrl ? 'View PDF' : 'View / Print'}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">{q.quotationSendType === 'pdf' && q.quotationPdfUrl ? 'View PDF' : 'View / Print'}</span>
            </button>
          </div>

          {open && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-5">

              {/* Company header */}
              <div className="text-center pb-4 border-b border-white/10">
                <p className="text-primary font-black text-xl tracking-widest uppercase">LIVETAKE</p>
                <p className="text-white font-semibold text-sm">Productions Photo and Video Services</p>
                <p className="text-white/40 text-xs mt-1">{COMPANY.phone}</p>
                <p className="text-white/30 text-xs">{COMPANY.address}</p>
              </div>

              {/* Event details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Event</p>
                  <p className="text-white font-semibold">{q.event?.eventName}</p>
                  <p className="text-white/60">{formatDate(q.event?.eventDate)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Client / Venue</p>
                  <p className="text-white font-semibold">{q.client?.name}</p>
                  <p className="text-white/60">{q.event?.location}</p>
                </div>
              </div>

              {/* Package details */}
              <div>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
                  Package Details — {formatCurrency(q.totalAmount)} {q.tax > 0 ? '(+VAT)' : ''}
                </p>

                <div className="space-y-4">
                  {(q.services || []).map((svc, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-white font-bold text-sm">{svc.name}</p>
                        <p className="text-primary font-bold whitespace-nowrap">{formatCurrency(svc.total)}</p>
                      </div>
                      {svc.description && (
                        <div className="mt-2 space-y-1">
                          {svc.description.split('\n').map((line, li) => {
                            const trimmed = line.trim();
                            if (!trimmed) return null;
                            const isNote = trimmed.startsWith('*');
                            const isBullet = trimmed.startsWith('•') || trimmed.startsWith('✔');
                            return (
                              <p key={li}
                                className={`text-xs flex items-start gap-1.5 ${
                                  isNote  ? 'text-yellow-400/80 italic mt-2' :
                                  isBullet? 'text-white/60' :
                                  'text-white/60'
                                }`}>
                                {isBullet && <span className="text-primary/60 flex-shrink-0 mt-0.5">✔</span>}
                                {isBullet ? trimmed.replace(/^[•✔]\s*/, '') : trimmed}
                              </p>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Equipment */}
                  {(q.equipment || []).length > 0 && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-white font-bold text-sm mb-2">Technical Equipment</p>
                      <div className="space-y-1">
                        {q.equipment.map((eq, i) => (
                          <div key={i} className="flex justify-between gap-2 text-xs">
                            <span className="text-white/60">{eq.name} ×{eq.quantity}</span>
                            <span className="text-white/70 font-mono whitespace-nowrap">{formatCurrency(eq.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manpower */}
                  {(q.manpower || []).length > 0 && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-white font-bold text-sm mb-2">Manpower</p>
                      <div className="space-y-1">
                        {q.manpower.map((m, i) => (
                          <div key={i} className="flex justify-between gap-2 text-xs">
                            <span className="text-white/60">{m.role} ×{m.quantity} ({m.days}d)</span>
                            <span className="text-white/70 font-mono whitespace-nowrap">{formatCurrency(m.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Totals breakdown */}
                <div className="mt-4 p-4 bg-primary/10 rounded-xl border border-primary/20 space-y-2">
                  {q.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Subtotal</span>
                      <span className="text-white font-mono">{formatCurrency(q.subtotal)}</span>
                    </div>
                  )}
                  {q.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Discount</span>
                      <span className="text-green-400 font-mono">−{formatCurrency(q.discount)}</span>
                    </div>
                  )}
                  {q.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">VAT</span>
                      <span className="text-white font-mono">+{formatCurrency(q.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline gap-2 text-base font-black pt-2 border-t border-white/20">
                    <span className="text-white">TOTAL PACKAGE</span>
                    <span className="text-primary whitespace-nowrap">{formatCurrency(q.totalAmount)}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-white/70">50% Downpayment (Upon reservation)</span>
                      <span className="text-yellow-400 font-bold whitespace-nowrap">{formatCurrency(q.paymentTerms?.downpaymentAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="text-white/70">50% Balance (Day of event)</span>
                      <span className="text-white/70 font-medium whitespace-nowrap">{formatCurrency(q.paymentTerms?.balanceAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              {(q.conditions || []).length > 0 && (
                <div>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Terms & Conditions</p>
                  <div className="space-y-2">
                    {q.conditions.map((c, i) => (
                      <div key={i} className="flex gap-2 text-xs text-white/50 leading-relaxed">
                        <span className="text-primary/50 flex-shrink-0 font-bold">{i + 1}.</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {q.notes && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-blue-400 text-xs">{q.notes}</p>
                </div>
              )}

              {/* Valid until */}
              {q.validUntil && (
                <p className="text-white/30 text-xs text-center">
                  Quotation valid until {formatDate(q.validUntil)}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Comments ── */}
      <div className="border-t border-white/10 mt-4">
        <button onClick={toggleComments}
          className="flex items-center gap-2 py-2 text-white/40 hover:text-white transition-colors text-sm">
          <MessageSquare className="w-4 h-4" />
          {showComments ? 'Hide comments' : `Comments${comments.length ? ` (${comments.length})` : ''}`}
        </button>

        {showComments && (
          <div className="pt-2 pb-1 space-y-3">
            {loadingComments && (
              <p className="text-white/30 text-xs">Loading comments...</p>
            )}

            {!loadingComments && commentsLoaded && comments.length === 0 && (
              <p className="text-white/30 text-xs">No comments yet.</p>
            )}

            {comments.map(c => (
              <div key={c._id} className="flex gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{c.author?.name || 'Unknown'}</span>
                    <span className={`badge text-[10px] ${
                      c.authorRole === 'admin' ? 'bg-primary/20 text-primary' :
                      c.authorRole === 'staff' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {c.authorRole}
                    </span>
                    <span className="text-white/30 text-xs">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-white/70 text-sm mt-1 whitespace-pre-wrap">{c.text}</p>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    postComment();
                  }
                }}
                placeholder="Write a comment..."
                className="input flex-1 min-h-[40px] text-sm resize-none"
              />
              <button
                onClick={postComment}
                disabled={posting || !commentText.trim()}
                className="btn-primary px-3 disabled:opacity-50 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientQuotations() {
  const [quotations,      setQuotations]      = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [selected,        setSelected]        = useState(null);
  const [rejectReason,    setRejectReason]    = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approving,       setApproving]       = useState(null);

  const [confirm, setConfirm] = useState({ open: false });
  const askConfirm = (opts) => setConfirm({ open: true, loading: false, ...opts });
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false, loading: false }));
  const runConfirm = async () => {
    setConfirm(c => ({ ...c, loading: true }));
    try { await confirm.onConfirm(); } finally { closeConfirm(); }
  };

  const fetchQuotations = async () => {
    try {
      const { data } = await api.get('/quotations');
      setQuotations(data.quotations);
    } catch { toast.error('Failed to load quotations'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchQuotations(); }, []);

  const approve = async (id, q) => {
    askConfirm({
      title: 'Approve Quotation?',
      message: `Approve ${q.quotationNumber} for ${formatCurrency(q.totalAmount)}? A 50% downpayment of ${formatCurrency(q.paymentTerms?.downpaymentAmount)} is required to confirm your booking.`,
      type: 'success',
      confirmLabel: 'Yes, Approve',
      onConfirm: async () => {
        setApproving(id);
        setQuotations(prev => prev.map(qq => qq._id === id ? { ...qq, status: 'approved' } : qq));
        try {
          await api.post(`/quotations/${id}/approve`);
          toast.success('Quotation approved! Please submit your downpayment.');
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to approve');
          fetchQuotations();
        } finally { setApproving(null); }
      }
    });
  };

  const reject = async () => {
    setQuotations(prev => prev.map(q => q._id === selected ? { ...q, status: 'rejected' } : q));
    setShowRejectModal(false);
    setRejectReason('');
    try {
      await api.post(`/quotations/${selected}/reject`, { reason: rejectReason });
      toast.success('Quotation rejected');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
      fetchQuotations();
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Quotations" />

      {quotations.length === 0 ? (
        <EmptyState icon={FileText} title="No quotations yet"
          description="Quotations will appear here once prepared by our team" />
      ) : (
        <div className="space-y-4">
          {quotations.map(q => (
            <div key={q._id}>
              <QuotationCard q={q} />
              {/* Approve / Reject actions */}
              {q.status === 'sent' && (
                <div className="flex gap-2 mt-2 px-1">
                  <button onClick={() => approve(q._id, q)} disabled={approving === q._id}
                    className="btn-primary text-sm flex-1 justify-center disabled:opacity-70">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{approving === q._id ? 'Approving...' : 'Approve Quotation'}</span>
                  </button>
                  <button onClick={() => { setSelected(q._id); setShowRejectModal(true); }}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors flex items-center gap-1.5 flex-shrink-0">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Quotation">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">Please let us know why you're rejecting so we can make adjustments.</p>
          <textarea className="input min-h-[100px]" placeholder="Reason for rejection..."
            value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button onClick={() => setShowRejectModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={reject} className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold">Reject</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirm.open} onClose={closeConfirm} onConfirm={runConfirm}
        title={confirm.title} message={confirm.message} type={confirm.type}
        confirmLabel={confirm.confirmLabel} loading={confirm.loading} />
    </div>
  );
}