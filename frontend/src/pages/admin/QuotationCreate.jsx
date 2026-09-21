import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle, Calendar, Upload, X, AlertTriangle, FileText, Eye } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/helpers';
import { calcQuotationValidUntil, toInputDate, formatDeadline } from '../../utils/dateHelpers';
import { RATE_CARD, PACKAGE_MAP } from '../../utils/rateCard';
import { LoadingSpinner } from '../../components/shared';
import toast from 'react-hot-toast';

const DEFAULT_CONDITIONS = [
  'Upon receipt of this quotation, the client agrees to keep the rates confidential and shall not disclose any information to third parties except those directly involved in the agreement.',
  'This agreement contains the entire understanding between Livetake Productions and the Client. It supersedes all prior agreements. Changes must be in writing, signed by both parties.',
  'Upon your signature or reservation deposit, Livetake Productions will reserve the time and date agreed upon. The Reservation Deposit is non-refundable even if the date is changed or the event is canceled.',
  'Payment Terms: 50% of the total package upon date reservation; 50% of the total package on the day of the event.',
  'The parties agree to a pre-event consultation before the event to finalize shooting times, locations, and the Client\'s request list in writing.',
  'The Client shall provide the primary internet connection. Backup internet by Livetake Productions will only be used when no other options are available and does not guarantee a stable connection.',
  'Livetake Productions will only use copyrighted materials with a valid license and will not be responsible for Copyright problems due to unlawful use of materials by the client.',
  'The Client shall secure a parking spot and provide crew meals on the day of the event.',
  'Livetake Productions shall keep an archive of the live-stream video recording for one year. After this, files may be deleted without prior notice.',
  'Livetake Productions shall send/provide the high-quality full recording after the event. The Client shall provide external hard drive(s) for copying files.',
  'Clients availing services for long-term projects (minimum 6 months, 3–4 livestreams/month) can get up to 20% discount.',
  'Rates are subject to change without prior notice.',
];


// ── Send Quotation Modal (inline) ─────────────────────────────────────────────
function SendQuotationModal({ quotation: q, onClose, onSent }) {
  const [mode, setMode]       = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const fileRef               = useRef();

  const reset = () => {
    setMode(''); setPdfFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

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
      toast.success('Quotation sent to client!');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold text-base">Send Printable Quotation to Client</h2>
            <p className="text-white/40 text-xs mt-0.5">{q?.quotationNumber} — quotation saved successfully</p>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-white/50 text-xs">The quotation has been saved. Choose how to send the printable quotation to the client:</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMode("premade")}
              className={`p-4 rounded-xl border text-left transition-all
                ${mode === "premade" ? "border-primary/60 bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
              <FileText className={`w-6 h-6 mb-2 ${mode === "premade" ? "text-primary" : "text-white/40"}`} />
              <p className={`font-semibold text-sm ${mode === "premade" ? "text-white" : "text-white/70"}`}>System Quotation</p>
              <p className={`text-xs mt-1 leading-relaxed ${mode === "premade" ? "text-white/60" : "text-white/35"}`}>
                Use the auto-generated printable quotation from the system.
              </p>
            </button>
            <button type="button" onClick={() => { setMode("pdf"); fileRef.current?.click(); }}
              className={`p-4 rounded-xl border text-left transition-all
                ${mode === "pdf" ? "border-primary/60 bg-primary/10" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
              <Upload className={`w-6 h-6 mb-2 ${mode === "pdf" ? "text-primary" : "text-white/40"}`} />
              <p className={`font-semibold text-sm ${mode === "pdf" ? "text-white" : "text-white/70"}`}>Upload PDF</p>
              <p className={`text-xs mt-1 leading-relaxed ${mode === "pdf" ? "text-white/60" : "text-white/35"}`}>
                Send your own custom PDF file (max 10 MB).
              </p>
            </button>
          </div>

          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />

          {mode === "pdf" && (
            pdfFile ? (
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[200px]">{pdfFile.name}</p>
                    <p className="text-white/40 text-xs">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => window.open(preview, "_blank")}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="text-white/30 hover:text-white">
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

        <div className="flex gap-3 p-5 border-t border-white/10">
          <button onClick={() => { reset(); onClose(); }} disabled={sending} className="btn-ghost flex-1">
            Save as Draft Instead
          </button>
          <button onClick={handleSend} disabled={sending || !mode || (mode === "pdf" && !pdfFile)}
            className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed">
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : "Send to Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminQuotationCreate() {
  const { eventId } = useParams();
  const navigate    = useNavigate();

  const [event,      setEvent]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [openGroups, setOpenGroups] = useState({ 0:true, 1:true, 2:true, 3:true, 4:true });

  const [selected,   setSelected]   = useState([]);
  const [extras,     setExtras]     = useState([]);
  const [discount,   setDiscount]   = useState('');
  const [tax,        setTax]        = useState('');
  const [notes,      setNotes]      = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const [assessmentNote, setAssessmentNote] = useState('');

  useEffect(() => {
    api.get(`/events/${eventId}`)
      .then(r => {
        const ev = r.data.event;
        setEvent(ev);
        const autoValidUntil = calcQuotationValidUntil(ev.eventDate);
        setValidUntil(autoValidUntil);

        // ── Auto-populate from needs assessment ─────────────────────────────
        const na = ev.needsAssessment;
        if (na?.selectedPackages?.length) {
          const preSelected = (na.selectedPackages || [])
            .map(id => PACKAGE_MAP[id])
            .filter(Boolean);
          setSelected(preSelected);
        }
        if (na?.customItems?.length) {
          setExtras((na.customItems || []).map(ci => ({
            name:        ci.name        || '',
            description: ci.description || '',
            unitPrice:   ci.price       || '',
          })));
        }
        if (na?.notes) {
          setAssessmentNote(na.notes);
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  const togglePackage = (pkg) => setSelected(prev =>
    prev.find(p => p.id === pkg.id)
      ? prev.filter(p => p.id !== pkg.id)
      : [...prev, { ...pkg }]
  );
  const isSelected = (id) => !!selected.find(p => p.id === id);

  const buildServices = () => selected.map(pkg => ({
    name:        pkg.name,
    description: pkg.inclusions.map(i => `• ${i}`).join('\n') + (pkg.note ? `\n${pkg.note}` : ''),
    quantity:    1,
    unitPrice:   pkg.price,
    total:       pkg.price,
  }));

  const buildExtras = () => extras.map(ex => ({
    name:        ex.name,
    description: ex.description,
    quantity:    1,
    unitPrice:   parseFloat(ex.unitPrice) || 0,
    total:       parseFloat(ex.unitPrice) || 0,
  }));

  const allServices = [...buildServices(), ...buildExtras()];
  const subtotal    = allServices.reduce((s, i) => s + (i.total || 0), 0);
  const totalAmount = subtotal + (parseFloat(tax) || 0) - (parseFloat(discount) || 0);

  const addExtra    = () => setExtras(p => [...p, { name: '', description: '', unitPrice: '' }]);
  const updateExtra = useCallback((i, key, val) => setExtras(p => p.map((ex, idx) => idx === i ? { ...ex, [key]: val } : ex)), []);
  const removeExtra = useCallback((i) => setExtras(p => p.filter((_, idx) => idx !== i)), []);

  const maxValidUntil = event?.eventDate ? toInputDate(new Date(event.eventDate)) : '';
  const minValidUntil = toInputDate(new Date());

  const [sendTarget, setSendTarget] = useState(null);

  const handleSubmit = async (action) => {
    if (selected.length === 0 && extras.length === 0) { toast.error('Select at least one package'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/quotations', {
        eventId, services: allServices, equipment: [], manpower: [],
        subtotal, tax: parseFloat(tax)||0, discount: parseFloat(discount)||0, totalAmount,
        conditions, notes, validUntil,
      });
      if (action === 'send') {
        setSendTarget(data.quotation);
      } else {
        toast.success('Quotation saved as draft');
        navigate('/admin/quotations');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="space-y-6 animate-fade-in max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="page-title">Create Quotation</h1>
            <p className="text-white/50 text-sm">{event?.eventName} · {event?.client?.name}</p>
          </div>
        </div>

        {/* Event info + date context */}
        <div className="card bg-primary/5 border border-primary/20">
          <h3 className="text-white font-semibold mb-3">Project Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              ['Event',  event?.eventName],
              ['Client', event?.client?.name],
              ['Date',   event?.eventDate ? new Date(event.eventDate).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' }) : '—'],
              ['Venue',  event?.location],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-white/40 text-xs">{k}</p>
                <p className="text-white font-medium mt-0.5">{v || '—'}</p>
              </div>
            ))}
          </div>

          {validUntil && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              <p className="text-yellow-400/80">
                Quotation must be approved by <span className="font-bold text-yellow-400">{formatDeadline(validUntil)}</span>
                {event?.eventDate && ` — 3 days before event on ${formatDeadline(event.eventDate)}`}
              </p>
            </div>
          )}
        </div>

        {/* Auto-populated from needs assessment */}
        {event?.needsAssessment?.selectedPackages?.length > 0 && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-400 font-semibold text-sm">
                  Auto-populated from needs assessment
                </p>
                <p className="text-green-400/70 text-xs mt-0.5">
                  {event.needsAssessment.selectedPackages.length} package{event.needsAssessment.selectedPackages.length !== 1 ? 's' : ''} from the client meeting have been pre-selected below.
                  Review and adjust if needed before sending.
                </p>
                {event.needsAssessment.attendees && (
                  <p className="text-white/50 text-xs mt-1.5">
                    Confirmed attendees: <span className="text-white">{event.needsAssessment.attendees}</span>
                  </p>
                )}
                {assessmentNote && (
                  <p className="text-white/50 text-xs mt-0.5 italic">
                    Meeting notes: "{assessmentNote}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Package selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Select Service Packages</h2>
            {selected.length > 0 && <span className="badge bg-primary/20 text-primary">{selected.length} selected</span>}
          </div>
          {RATE_CARD.map((group, gi) => (
            <div key={gi} className="card">
              <button type="button" onClick={() => setOpenGroups(g => ({ ...g, [gi]: !g[gi] }))}
                className="w-full flex items-center justify-between mb-1">
                <h3 className="text-white font-semibold">{group.group}</h3>
                {openGroups[gi] ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
              </button>
              {openGroups[gi] && (
                <div className="space-y-3 mt-3">
                  {group.packages.map(pkg => {
                    const sel = isSelected(pkg.id);
                    return (
                      <div key={pkg.id} onClick={() => togglePackage(pkg)}
                        className={`relative p-4 rounded-xl border cursor-pointer transition-all
                          ${sel ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:border-white/25'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors
                            ${sel ? 'border-primary bg-primary' : 'border-white/30'}`}>
                            {sel && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`font-semibold text-sm leading-snug ${sel ? 'text-white' : 'text-white/70'}`}>{pkg.tag}</p>
                              <span className={`text-base font-bold whitespace-nowrap ${sel ? 'text-primary' : 'text-white/50'}`}>{formatCurrency(pkg.price)}</span>
                            </div>
                            <ul className="mt-2 space-y-0.5">
                              {pkg.inclusions.map((inc, ii) => (
                                <li key={ii} className="text-white/50 text-xs flex items-start gap-1.5">
                                  <span className="text-primary/60 mt-0.5 flex-shrink-0">✔</span><span>{inc}</span>
                                </li>
                              ))}
                            </ul>
                            {pkg.note && <p className="text-yellow-400/70 text-xs mt-2 italic">{pkg.note}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Custom items */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="section-title">Custom / Additional Items</h3>
              <p className="text-white/40 text-xs mt-0.5">Add items not in the rate card</p>
            </div>
            <button type="button" onClick={addExtra} className="btn-ghost text-sm"><Plus className="w-4 h-4" /> Add Item</button>
          </div>
          {extras.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-4">No custom items</p>
          ) : (
            <div className="space-y-3">
              {extras.map((ex, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                  <div className="flex gap-3">
                    <input className="input flex-1 text-sm" placeholder="Item name"
                      value={ex.name} onChange={e => updateExtra(i, 'name', e.target.value)} />
                    <input type="number" className="input w-28 text-sm" placeholder="Price ₱"
                      value={ex.unitPrice} onChange={e => updateExtra(i, 'unitPrice', e.target.value)} />
                    <button type="button" onClick={() => removeExtra(i)} className="text-white/20 hover:text-red-400 transition-colors p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input className="input text-sm" placeholder="Description / inclusions"
                    value={ex.description} onChange={e => updateExtra(i, 'description', e.target.value)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {(selected.length > 0 || extras.length > 0) && (
          <div className="card">
            <h3 className="section-title mb-4">Quotation Summary</h3>
            <div className="space-y-2 mb-4">
              {selected.map(pkg => (
                <div key={pkg.id} className="flex justify-between items-start gap-4 py-2 border-b border-white/5">
                  <div>
                    <p className="text-white text-sm font-medium">{pkg.name}</p>
                    <p className="text-white/40 text-xs">{pkg.tag}</p>
                  </div>
                  <p className="text-white font-mono font-medium whitespace-nowrap">{formatCurrency(pkg.price)}</p>
                </div>
              ))}
              {extras.filter(e => e.name).map((ex, i) => (
                <div key={i} className="flex justify-between items-start gap-4 py-2 border-b border-white/5">
                  <p className="text-white text-sm font-medium">{ex.name}</p>
                  <p className="text-white font-mono font-medium whitespace-nowrap">{formatCurrency(parseFloat(ex.unitPrice)||0)}</p>
                </div>
              ))}
            </div>
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Subtotal</span>
                <span className="text-white font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-white/50 flex-1">Tax (₱)</span>
                <input type="number" min="0" className="input w-28 text-sm py-1.5"
                  value={tax} onChange={e => setTax(e.target.value)} placeholder="0" />
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-white/50 flex-1">Discount (₱)</span>
                <input type="number" min="0" className="input w-28 text-sm py-1.5"
                  value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
              </div>
              <div className="flex justify-between text-xl font-black pt-3 border-t border-white/10">
                <span className="text-white">TOTAL</span>
                <span className="text-primary">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">50% Downpayment (Reservation)</span>
                  <span className="text-white font-medium">{formatCurrency(totalAmount * 0.5)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">50% Balance (Day of event)</span>
                  <span className="text-white font-medium">{formatCurrency(totalAmount * 0.5)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Terms & valid until */}
        <div className="card">
          <h3 className="section-title mb-3">Terms & Conditions</h3>
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-primary/60 text-xs mt-3 flex-shrink-0 font-bold">{i+1}.</span>
                <textarea className="input flex-1 text-sm min-h-[56px] resize-none" value={c}
                  onChange={e => setConditions(prev => prev.map((cc, ci) => ci === i ? e.target.value : cc))} />
                <button type="button" onClick={() => setConditions(p => p.filter((_,ci) => ci !== i))}
                  className="text-white/20 hover:text-red-400 transition-colors p-2 flex-shrink-0 mt-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setConditions(p => [...p, ''])} className="btn-ghost text-sm">
              <Plus className="w-4 h-4" /> Add Condition
            </button>
          </div>

          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-400 font-semibold text-sm">Quotation Valid Until</p>
                <p className="text-yellow-400/70 text-xs mt-0.5 mb-2">
                  Auto-set to 3 days before event date. Client must approve before this deadline.
                  {event?.eventDate && ` (Event: ${formatDeadline(event.eventDate)})`}
                </p>
                <input type="date" className="input text-sm"
                  value={validUntil}
                  min={minValidUntil}
                  max={maxValidUntil}
                  onChange={e => setValidUntil(e.target.value)} />
                {maxValidUntil && (
                  <p className="text-white/30 text-xs mt-1">
                    Cannot be set after the event date ({formatDeadline(maxValidUntil)})
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div>
              <label className="label">Internal Notes</label>
              <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for admin reference..." />
            </div>
          </div>
        </div>

        {/* Payment reference */}
        <div className="card bg-white/5 border border-white/10">
          <h3 className="text-white/60 text-sm font-semibold mb-2">Payment Reference (shown to client)</h3>
          <p className="text-white/50 text-sm">Cheque payable to: <span className="text-white">LIVETAKE PRODUCTIONS PHOTO AND VIDEO SERVICES</span></p>
          
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => handleSubmit('draft')} disabled={saving} className="btn-secondary">Save Draft</button>
          <button type="button" onClick={() => handleSubmit('send')} disabled={saving} className="btn-primary">
            <Send className="w-4 h-4" />{saving ? 'Sending...' : 'Save & Send to Client'}
          </button>
        </div>
      </div>

      {/* Send Quotation Modal — appears after save when admin clicks Send to Client */}
      {sendTarget && (
        <SendQuotationModal
          quotation={sendTarget}
          onClose={() => { setSendTarget(null); navigate('/admin/quotations'); }}
          onSent={() => { setSendTarget(null); navigate('/admin/quotations'); }}
        />
      )}
    </>
  );
}