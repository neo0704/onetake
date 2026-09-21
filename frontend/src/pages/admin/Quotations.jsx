import React, { useEffect, useState, useRef } from 'react';
import { FileText, Eye, Send, Printer, Upload, X, AlertTriangle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader } from '../../components/shared';
import { formatDate, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';


// Resolves a backend file path to a full URL
const getBackendUrl = (filePath) => {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const origin = apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return `${origin}${filePath}`;
};

const STATUS_COLORS = {
  draft:    'bg-gray-500/20   text-gray-400',
  sent:     'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20  text-green-400',
  rejected: 'bg-red-500/20    text-red-400',
};

// Fix 3: human-readable labels for admin quotation status
const STATUS_LABELS_Q = {
  draft:    'Draft',
  sent:     'Waiting for Client Approval',
  approved: 'Approved by Client',
  rejected: 'Rejected by Client',
};

// ── Shared comments logic (used by modal detail view and inline table row) ──
function useComments(quotationId, active) {
  const [comments, setComments] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [loaded,   setLoaded]   = useState(false);
  const [text,     setText]     = useState('');
  const [posting,  setPosting]  = useState(false);

  useEffect(() => {
    if (!active || loaded) return;
    let cancelled = false;
    setLoading(true);
    api.get(`/quotations/${quotationId}/comments`)
      .then(({ data }) => { if (!cancelled) { setComments(data.comments || []); setLoaded(true); } })
      .catch(() => { if (!cancelled) toast.error('Failed to load comments'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, loaded, quotationId]);

  const postComment = async () => {
    const value = text.trim();
    if (!value) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/quotations/${quotationId}/comments`, { text: value });
      setComments(prev => [...prev, data.comment]);
      setText('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  return { comments, loading, loaded, text, setText, posting, postComment };
}

function CommentsThread({ quotationId, active, compact }) {
  const { comments, loading, loaded, text, setText, posting, postComment } = useComments(quotationId, active);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {loading && <p className="text-white/30 text-xs">Loading comments...</p>}
      {!loading && loaded && comments.length === 0 && (
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
          value={text}
          onChange={e => setText(e.target.value)}
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
          disabled={posting || !text.trim()}
          className="btn-primary px-3 disabled:opacity-50 flex items-center justify-center">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function QuotationDetail({ q, onClose, onSend, sending, onPrint }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl my-8 shadow-2xl">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-white font-bold text-lg">{q.quotationNumber}</h2>
            <p className="text-white/50 text-sm truncate">{q.event?.eventName} · {q.client?.name}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className={`badge ${STATUS_COLORS[q.status] || ''}`}>
              {STATUS_LABELS_Q[q.status] || q.status}
            </span>
            <button onClick={() => onPrint(q)} className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5">
              {q.quotationSendType === 'pdf' && q.quotationPdfUrl
                ? <><Eye className="w-4 h-4" /> </>
                : <><Printer className="w-4 h-4" /> Print</>
              }
            </button>
            {q.status === 'draft' && (
              <button onClick={() => onSend(q)} disabled={sending === q._id}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                <Send className="w-4 h-4" />
                {sending === q._id ? 'Sending...' : 'Send to Client'}
              </button>
            )}
            <button onClick={onClose} className="btn-ghost text-sm px-3 py-1.5">Close</button>
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Waiting notice */}
          {q.status === 'sent' && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-yellow-400 font-semibold text-sm">Waiting for Client Approval</p>
              <p className="text-yellow-400/70 text-xs mt-1">
                The client has received this quotation and has not yet responded. You will be notified once they approve or reject it.
              </p>
            </div>
          )}

          {q.status === 'approved' && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-green-400 font-semibold text-sm">Client Approved this Quotation</p>
              <p className="text-green-400/70 text-xs mt-1">
                The client has approved. Ensure the 50% downpayment is received to confirm the booking.
              </p>
            </div>
          )}

          {q.status === 'rejected' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 font-semibold text-sm">Client Rejected this Quotation</p>
              <p className="text-red-400/70 text-xs mt-1">
                The client rejected this quotation. Consider adjusting the package and sending a new one.
              </p>
            </div>
          )}

          {/* PDF sent notice — show instead of premade preview */}
          {q.quotationSendType === 'pdf' && q.quotationPdfUrl && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-blue-400 font-semibold text-sm">Custom PDF was sent to client</p>
                  <p className="text-blue-400/60 text-xs mt-0.5">The client received your uploaded PDF, not the system quotation below.</p>
                </div>
              </div>
              <button
                onClick={() => window.open(getBackendUrl(q.quotationPdfUrl), '_blank')}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto">
                <Eye className="w-3.5 h-3.5" /> Open PDF
              </button>
            </div>
          )}

          {/* Company header */}
          <div className="text-center pb-4 border-b border-white/10">
            <p className="text-primary font-black text-xl tracking-widest uppercase">LIVETAKE</p>
            <p className="text-white font-semibold text-sm">Productions Photo and Video Services</p>
            <p className="text-white/40 text-xs mt-1">0906 8642 868 | 0939 1423 567</p>
            <p className="text-white/30 text-xs">Block E11 Lot 10, San Lorenzo 1, City of Dasmari&ntilde;as, Cavite</p>
          </div>

          {/* Event info */}
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

          {/* Services */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
              Package Details — {formatCurrency(q.totalAmount)}{q.tax > 0 ? ' (+VAT)' : ''}
            </p>
            <div className="space-y-3">
              {(q.services || []).map((svc, i) => (
                <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <p className="text-white font-bold text-sm">{svc.name}</p>
                    <p className="text-primary font-bold whitespace-nowrap">{formatCurrency(svc.total)}</p>
                  </div>
                  {svc.description && (
                    <div className="space-y-1">
                      {svc.description.split('\n').map((line, li) => {
                        const t = line.trim();
                        if (!t) return null;
                        const isNote   = t.startsWith('*');
                        const isBullet = t.startsWith('•') || t.startsWith('✔');
                        return (
                          <p key={li} className={`text-xs flex items-start gap-1.5 ${isNote ? 'text-yellow-400/80 italic mt-2' : 'text-white/60'}`}>
                            {isBullet && <span className="text-primary/60 flex-shrink-0 mt-0.5">+</span>}
                            {isBullet ? t.replace(/^[•✔]\s*/, '') : t}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Financial breakdown */}
            <div className="mt-4 p-4 bg-primary/10 rounded-xl border border-primary/20 space-y-2">
              {q.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Discount</span>
                  <span className="text-green-400">-{formatCurrency(q.discount)}</span>
                </div>
              )}
              {q.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">VAT</span>
                  <span className="text-white">+{formatCurrency(q.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black pt-2 border-t border-white/20">
                <span className="text-white">TOTAL PACKAGE</span>
                <span className="text-primary">{formatCurrency(q.totalAmount)}</span>
              </div>
              <div className="pt-2 border-t border-white/10 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">50% Downpayment (Upon reservation)</span>
                  <span className="text-yellow-400 font-bold">{formatCurrency(q.paymentTerms?.downpaymentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">50% Balance (Day of event)</span>
                  <span className="text-white/70">{formatCurrency(q.paymentTerms?.balanceAmount)}</span>
                </div>
              </div>
            </div>

            {/* Payment reference */}
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 text-xs">
              <p className="text-white/50 font-semibold mb-1">Payment Details</p>
              {q.validUntil && (
                <p className="text-red-400/80 mt-2 font-medium">Valid until: {formatDate(q.validUntil)}</p>
              )}
            </div>
          </div>

          {/* T&C */}
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

          {/* ── Comments ── */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Comments
            </p>
            <CommentsThread quotationId={q._id} active={true} />
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Send Quotation Modal ──────────────────────────────────────────────────────
function SendQuotationModal({ quotation: q, isOpen, onClose, onSent }) {
  const [mode, setMode]       = useState('');       // 'premade' | 'pdf'
  const [pdfFile, setPdfFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const fileRef               = useRef();

  if (!isOpen || !q) return null;

  const reset = () => {
    setMode(''); setPdfFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null); setSending(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are accepted'); return; }
    if (file.size > 10 * 1024 * 1024)   { toast.error('File must be under 10 MB'); return; }
    setPdfFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const handleSend = async () => {
    if (!mode) { toast.error('Please choose a quotation type'); return; }
    if (mode === 'pdf' && !pdfFile) { toast.error('Please upload a PDF file first'); return; }
    setSending(true);
    try {
      if (mode === 'premade') {
        await api.post(`/quotations/${q._id}/send`, { type: 'premade' });
      } else {
        const form = new FormData();
        form.append('pdf', pdfFile);
        form.append('type', 'pdf');
        await api.post(`/quotations/${q._id}/send`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success(`Quotation sent to ${q.client?.name}!`);
      onSent?.();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send quotation');
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-white font-bold text-base">Send Quotation to Client</h2>
            <p className="text-white/40 text-xs mt-0.5 truncate">{q.quotationNumber} — {q.event?.eventName}</p>
          </div>
          <button onClick={handleClose} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Already sent warning */}
          {q.status === 'sent' && (
            <div className="flex gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-400/80 text-xs leading-relaxed">
                This quotation was already sent. Resending will replace the current version for the client.
              </p>
            </div>
          )}

          {/* Type selection */}
          <p className="text-white/50 text-xs">Choose what to send:</p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button type="button" onClick={() => setMode('premade')}
              className={`p-3 sm:p-4 rounded-xl border text-left transition-all
                ${mode === 'premade' ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-white/5 hover:border-white/25'}`}>
              <FileText className={`w-5 h-5 sm:w-6 sm:h-6 mb-2 ${mode === 'premade' ? 'text-primary' : 'text-white/40'}`} />
              <p className={`font-semibold text-sm ${mode === 'premade' ? 'text-white' : 'text-white/70'}`}>System Quotation</p>
              <p className={`text-xs mt-1 leading-relaxed ${mode === 'premade' ? 'text-white/60' : 'text-white/35'}`}>
                Use the auto-generated printable quotation from the system.
              </p>
            </button>

            <button type="button" onClick={() => { setMode('pdf'); fileRef.current?.click(); }}
              className={`p-3 sm:p-4 rounded-xl border text-left transition-all
                ${mode === 'pdf' ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-white/5 hover:border-white/25'}`}>
              <Upload className={`w-5 h-5 sm:w-6 sm:h-6 mb-2 ${mode === 'pdf' ? 'text-primary' : 'text-white/40'}`} />
              <p className={`font-semibold text-sm ${mode === 'pdf' ? 'text-white' : 'text-white/70'}`}>Upload PDF</p>
              <p className={`text-xs mt-1 leading-relaxed ${mode === 'pdf' ? 'text-white/60' : 'text-white/35'}`}>
                Send your own custom PDF file (max 10 MB).
              </p>
            </button>
          </div>

          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />

          {/* PDF file state */}
          {mode === 'pdf' && (
            pdfFile ? (
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[220px]">{pdfFile.name}</p>
                    <p className="text-white/40 text-xs">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => window.open(preview, '_blank')}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button onClick={() => fileRef.current?.click()}
                    className="text-white/30 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-white/20 rounded-xl text-white/40
                  hover:border-primary/40 hover:text-white/60 transition-colors text-sm flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Click to choose PDF file
              </button>
            )
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 border-t border-white/10">
          <button onClick={handleClose} disabled={sending} className="btn-ghost flex-1">Cancel</button>
          <button onClick={handleSend} disabled={sending || !mode || (mode === 'pdf' && !pdfFile)}
            className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed">
            <Send className="w-4 h-4" />
            {sending ? 'Sending…' : 'Send to Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminQuotations() {
  const [quotations,   setQuotations]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing,      setViewing]      = useState(null);
  const [sending,      setSending]      = useState(null);
  const [sendTarget,   setSendTarget]   = useState(null); // quotation to send via modal
  const [expandedId,   setExpandedId]   = useState(null); // row with comments expanded inline

  const fetchQuotations = () => {
    api.get('/quotations').then(r => {
      setQuotations(r.data.quotations);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { fetchQuotations(); }, []);

  const openPrint = (q) => {
    if (q.quotationSendType === 'pdf' && q.quotationPdfUrl) {
      window.open(getBackendUrl(q.quotationPdfUrl), '_blank');
    } else {
      sessionStorage.setItem(`qprint_${q._id}`, JSON.stringify(q));
      window.open(`/quotation/print/${q._id}`, '_blank');
    }
  };

  const openSendModal = (q) => setSendTarget(q);

  const filtered = statusFilter === 'all'
    ? quotations
    : quotations.filter(q => q.status === statusFilter);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Quotations" subtitle={`${quotations.length} total`} />

      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'sent', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${statusFilter === s ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            {s === 'sent' ? 'Waiting Approval' : s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({quotations.filter(q => q.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No quotations" description="Quotations will appear here" />
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {filtered.map(q => (
              <div key={q._id} className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-primary text-xs font-bold">{q.quotationNumber}</p>
                    <p className="text-white font-semibold truncate">{q.event?.eventName}</p>
                    <p className="text-white/60 text-sm truncate">{q.client?.name}</p>
                  </div>
                  <span className={`badge shrink-0 ${STATUS_COLORS[q.status] || ''}`}>
                    {STATUS_LABELS_Q[q.status] || q.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40 text-xs">{formatDate(q.createdAt)}</span>
                  <span className="text-white font-mono font-medium">{formatCurrency(q.totalAmount)}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/10">
                  <button onClick={() => setViewing(q)}
                    className="btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button onClick={() => openPrint(q)}
                    className="btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1 text-white/50 hover:text-white">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <button onClick={() => setExpandedId(prev => prev === q._id ? null : q._id)}
                    className="btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1 text-white/50 hover:text-white">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {expandedId === q._id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {q.status === 'draft' && (
                    <button onClick={() => openSendModal(q)} disabled={sending === q._id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/20 text-primary rounded-lg text-xs hover:bg-primary/30 transition-colors disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" />
                      {sending === q._id ? 'Sending...' : 'Send'}
                    </button>
                  )}
                </div>

                {expandedId === q._id && (
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> Comments
                    </p>
                    <CommentsThread quotationId={q._id} active={expandedId === q._id} compact />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop/tablet: table */}
          <div className="hidden md:block card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                {['#', 'Project', 'Client', 'Date', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 pr-4 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <React.Fragment key={q._id}>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 font-mono text-primary text-xs font-bold">{q.quotationNumber}</td>
                  <td className="py-3 pr-4 text-white">{q.event?.eventName}</td>
                  <td className="py-3 pr-4 text-white/70">{q.client?.name}</td>
                  <td className="py-3 pr-4 text-white/50 text-xs">{formatDate(q.createdAt)}</td>
                  <td className="py-3 pr-4 text-white font-mono font-medium">{formatCurrency(q.totalAmount)}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${STATUS_COLORS[q.status] || ''}`}>
                      {STATUS_LABELS_Q[q.status] || q.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setViewing(q)}
                        className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button onClick={() => openPrint(q)}
                        className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-white/50 hover:text-white">
                        <Printer className="w-3.5 h-3.5" /> Print
                      </button>
                      <button onClick={() => setExpandedId(prev => prev === q._id ? null : q._id)}
                        className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-white/50 hover:text-white">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {expandedId === q._id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {q.status === 'draft' && (
                        <button onClick={() => openSendModal(q)} disabled={sending === q._id}
                          className="flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-lg text-xs hover:bg-primary/30 transition-colors disabled:opacity-50">
                          <Send className="w-3.5 h-3.5" />
                          {sending === q._id ? 'Sending...' : 'Send'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === q._id && (
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <td colSpan={7} className="py-4 px-4">
                      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" /> Comments
                      </p>
                      <CommentsThread quotationId={q._id} active={expandedId === q._id} compact />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {sendTarget && (
        <SendQuotationModal
          quotation={sendTarget}
          isOpen={!!sendTarget}
          onClose={() => setSendTarget(null)}
          onSent={() => {
            fetchQuotations();
            if (viewing?._id === sendTarget?._id) setViewing(prev => ({ ...prev, status: 'sent' }));
            setSendTarget(null);
          }}
        />
      )}

      {viewing && (
        <QuotationDetail
          q={viewing}
          onClose={() => setViewing(null)}
          onSend={openSendModal}
          sending={sending}
          onPrint={openPrint}
        />
      )}
    </div>
  );
}