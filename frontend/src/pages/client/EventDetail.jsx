import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Download, CreditCard, Users, Send, XCircle, AlertTriangle, RotateCcw, Star, CheckCircle2, Wrench, X, Paperclip } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/shared';
import ServiceBadges from '../../components/shared/ServiceBadges';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/helpers';
import { getSocket } from '../../services/socket';
import ProjectTimeline from '../../components/ProjectTimeline';
import toast from 'react-hot-toast';

// ── Derive the backend origin from the axios base URL so that relative
//    upload paths (e.g. /uploads/messages/file.jpg) resolve correctly
//    instead of hitting the React dev-server.
const API_ORIGIN = (api.defaults.baseURL || '').replace(/\/api.*$/, '');

const TABS = ['overview', 'team', 'deliverables'];

const CANCELLABLE_STATUSES = [
  'inquiry_accepted', 'meeting_scheduled',
  'needs_assessed', 'quotation_sent', 'confirmed',
  'downpayment_paid', 'assigned', 'in_progress',
];

const PAID_STATUSES = ['downpayment_paid', 'assigned', 'in_progress', 'completed_pending_balance'];

const CANCEL_REASONS = [
  'Change of plans',
  'Found another service provider',
  'Budget constraints',
  'Event date changed',
  'Event was postponed',
  'Personal / family emergency',
  'Others',
];

// ── Cancel Confirmation Modal ─────────────────────────────────────────────────
function CancelModal({ event, paymentSummary, onConfirm, onClose, loading }) {
  const [selected, setSelected] = useState('');
  const [otherText, setOtherText] = useState('');
  const hasPaid = PAID_STATUSES.includes(event.status) ||
    (paymentSummary?.totalPaid > 0 && paymentSummary?.totalPaid >= (paymentSummary?.totalAmount * 0.5));

  const isOthers   = selected === 'Others';
  const finalReason = isOthers ? otherText.trim() : selected;
  const canSubmit  = !loading && selected !== '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">Request Cancellation</h2>
            <p className="text-white/40 text-xs mt-0.5 truncate max-w-[260px]">{event.eventName}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* Non-refundable warning */}
          {hasPaid && (
            <div className="flex gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-red-400 font-semibold text-sm">Payment is Non-Refundable</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  You have already paid{' '}
                  <span className="text-white font-medium">{formatCurrency(paymentSummary?.totalPaid ?? 0)}</span>.
                  By proceeding,{' '}
                  <span className="text-red-300 font-medium">all payments made are non-refundable</span> and will
                  not be returned regardless of the outcome.
                </p>
              </div>
            </div>
          )}

          {/* Soft notice for unpaid */}
          {!hasPaid && (
            <div className="flex gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-white/60 text-xs leading-relaxed">
                Your cancellation request will be reviewed by our team. We will notify you once a decision is made.
              </p>
            </div>
          )}

          {/* Reason — radio buttons */}
          <div>
            <label className="text-white/50 text-xs block mb-2">
              Reason for cancellation <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {CANCEL_REASONS.map(r => {
                const isSelected = selected === r;
                return (
                  <label
                    key={r}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                      ${isSelected
                        ? 'bg-red-500/15 border-red-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                      }`}
                  >
                    {/* Custom radio circle */}
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${isSelected ? 'border-red-400' : 'border-white/30'}`}
                    >
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-red-400 block" />
                      )}
                    </span>
                    <input
                      type="radio"
                      name="cancel_reason"
                      value={r}
                      checked={isSelected}
                      onChange={() => { setSelected(r); setOtherText(''); }}
                      className="sr-only"
                    />
                    <span className={`text-sm font-medium ${isSelected ? 'text-red-300' : 'text-white/60'}`}>
                      {r}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Free-text box — only appears when Others is selected */}
            {isOthers && (
              <textarea
                autoFocus
                className="input w-full resize-none mt-3"
                rows={3}
                placeholder="Please describe your reason..."
                value={otherText}
                onChange={e => setOtherText(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-ghost flex-1"
          >
            Keep Event
          </button>
          <button
            onClick={() => onConfirm(finalReason)}
            disabled={!canSubmit || (isOthers && !otherText.trim())}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-medium text-sm
              hover:bg-red-500/30 hover:border-red-500/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting…' : 'Request Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Withdraw Cancellation Confirmation Modal ──────────────────────────────────
function WithdrawCancelModal({ event, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">Withdraw Cancellation?</h2>
            <p className="text-white/40 text-xs mt-0.5 truncate max-w-[220px]">{event.eventName}</p>
          </div>
        </div>

        <div className="p-5">
          <p className="text-white/60 text-sm leading-relaxed">
            Are you sure you want to withdraw your cancellation request? Your event will be restored to its previous status and our team will continue processing it.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-ghost flex-1"
          >
            No, Keep It
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-400 font-medium text-sm
              hover:bg-teal-500/30 hover:border-teal-500/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Withdrawing…' : 'Yes, Withdraw'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Feedback Card ──────────────────────────────────────────────────────────────
const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent' };

function FeedbackCard({ event, onSubmit, loading }) {
  const existing = event.feedback?.rating ? event.feedback : null;
  const [rating, setRating] = useState(existing?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existing?.comment || '');

  // Already submitted — show a read-only summary
  if (existing) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="section-title">Your Feedback</h3>
          <span className="flex items-center gap-1 ml-auto text-xs text-green-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Submitted
          </span>
        </div>
        <div className="flex items-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map(n => (
            <Star
              key={n}
              className={`w-5 h-5 ${n <= existing.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`}
            />
          ))}
          <span className="text-white/50 text-xs ml-2">{RATING_LABELS[existing.rating] || ''}</span>
        </div>
        {existing.comment && (
          <p className="text-white/70 text-sm leading-relaxed">{existing.comment}</p>
        )}
        {existing.submittedAt && (
          <p className="text-white/30 text-xs mt-2">
            Submitted on {formatDateTime(existing.submittedAt)}
          </p>
        )}
      </div>
    );
  }

  const activeRating = hoverRating || rating;
  const canSubmit = rating > 0 && !loading;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="section-title">Share Your Feedback</h3>
      </div>
      <p className="text-white/40 text-xs mb-4">
        Let us know how your event went — it helps our team improve.
      </p>

      {/* Star picker */}
      <div className="flex items-center gap-1.5 mb-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                n <= activeRating ? 'text-yellow-400 fill-yellow-400' : 'text-white/15 hover:text-white/25'
              }`}
            />
          </button>
        ))}
        {activeRating > 0 && (
          <span className="text-white/60 text-sm font-medium ml-2">{RATING_LABELS[activeRating]}</span>
        )}
      </div>

      <textarea
        className="input w-full resize-none mt-3"
        rows={3}
        placeholder="Tell us about your experience (optional)..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        maxLength={1000}
      />

      <div className="flex items-center justify-between mt-3">
        <span className="text-white/25 text-xs">{comment.length}/1000</span>
        <button
          onClick={() => onSubmit({ rating, comment: comment.trim() })}
          disabled={!canSubmit}
          className="btn-primary text-sm px-5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting…' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );
}

// ── Sidebar: Assigned Staff (read-only, client-facing) ────────────────────────
function AssignedStaffCard({ event }) {
  const team = event.assignedFreelancers || [];
  const showAttend = ['in_progress', 'completed_pending_balance', 'completed_paid'].includes(event.status);
  const checkedInCount = (event.attendance || []).filter(a => a.checkedIn).length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Your Team
        </h3>
        {showAttend && team.length > 0 && (
          <span className="text-white/40 text-xs flex-shrink-0">{checkedInCount}/{team.length} on-site</span>
        )}
      </div>

      {team.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">Team not yet assigned</p>
      ) : (
        <div className="space-y-2">
          {team.map((af, i) => {
            const fId = af.freelancer?._id?.toString() || af.freelancer?.toString();
            const att = (event.attendance || []).find(
              a => (a.freelancer?._id?.toString() || a.freelancer?.toString()) === fId
            );
            const checked = att?.checkedIn || false;
            return (
              <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm transition-colors
                ${showAttend
                  ? checked ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/5'
                  : 'bg-white/5 border-white/5'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${showAttend && checked ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'}`}>
                  {(af.freelancer?.name || '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{af.freelancer?.name}</p>
                  <p className="text-white/40 text-xs truncate">{af.role || 'Crew'}</p>
                </div>
                {showAttend && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0
                    ${checked ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                    {checked ? 'On-site' : 'Not yet'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sidebar: Equipment Overview (read-only, aggregated across the team) ───────
function EquipmentOverviewCard({ event }) {
  const team = event.assignedFreelancers || [];
  const itemMap = {};

  team.forEach(af => {
    (af.equipment || []).forEach(eq => {
      const item = eq.equipment;
      const key = item?._id?.toString() || item?.toString();
      if (!key) return;
      if (!itemMap[key]) {
        itemMap[key] = { name: item?.name || 'Equipment', qty: 0 };
      }
      itemMap[key].qty += eq.quantity || 1;
    });
  });

  const items = Object.values(itemMap);
  if (team.length === 0) return null;

  return (
    <div className="card">
      <h3 className="section-title flex items-center gap-2 mb-3">
        <Wrench className="w-4 h-4 text-primary" /> Equipment
      </h3>
      {items.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">No equipment assigned yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5 border border-white/5 text-sm">
              <p className="text-white font-medium truncate">{it.name}</p>
              <span className="text-primary font-semibold text-xs flex-shrink-0">×{it.qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar: Comments — one shared thread, visible to everyone on the event
// (client, admin, every assigned freelancer). Simple, no thread-switching. ────
function CommentsCard({ event, onSend, myRole, locked }) {
  const [comment, setComment] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const content = comment;
    setComment('');
    await onSend(content);
  };

  return (
    <div className="card flex flex-col">
      <h3 className="section-title flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-primary" /> Comments
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 pr-1" style={{ maxHeight: '260px' }}>
        {(event.messages || []).length === 0 && (
          <p className="text-white/30 text-xs text-center py-6">No comments yet</p>
        )}
        {(event.messages || []).map((msg, i) => {
          const isMe = msg.senderRole === myRole;
          return (
            <div key={i} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                {(msg.senderName || '?')[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/70 text-xs font-medium truncate">{msg.senderName}</span>
                  <span className="text-[9px] px-1 py-px rounded bg-white/10 text-white/40 flex-shrink-0 capitalize">{msg.senderRole}</span>
                  {isMe && (
                    <span className="text-[9px] px-1 py-px rounded bg-primary/20 text-primary flex-shrink-0">You</span>
                  )}
                </div>
                <p className="text-white/50 text-xs mt-0.5 leading-relaxed break-words">{msg.content}</p>
              </div>
            </div>
          );
        })}
      </div>
      {locked ? (
        <div className="pt-2 border-t border-white/10">
          <p className="text-white/30 text-xs text-center py-2">
            Comments are closed — this project is complete and fully paid.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex gap-1.5 pt-2 border-t border-white/10">
          <input
            className="input flex-1 text-sm py-1.5"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment..."
          />
          <button type="submit" className="btn-primary px-3">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

// ── Floating Direct Messages popup — private per-pair threads (with Admin,
// and with each assigned freelancer individually). Click the floating icon to
// open; tabs only appear when there's more than one thread. ────────────────
function DirectMessagesPopup({ event, onSend, myRole, locked }) {
  const threads = event.conversations || [];
  const [open, setOpen]           = useState(false);
  const [activeIdx, setActiveIdx] = useState(null);
  const [msgInput, setMsgInput]   = useState('');
  const [msgFiles, setMsgFiles]   = useState([]);
  const [sending, setSending]     = useState(false);
  const wrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const active   = threads.length === 1 ? threads[0] : (activeIdx !== null ? threads[activeIdx] : null);
  const showList = threads.length > 1 && activeIdx === null;

  // Jump to the latest message whenever a conversation is opened, switched
  // to, or grows with a new message — instead of sitting at the top.
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [open, activeIdx, active?.messages?.length]);

  // Persisted "seen" tracking — survives reloads and correctly treats any
  // thread never opened before as fully unread (instead of assuming
  // whatever's already there at page-load is "seen").
  const storageKey = (t) =>
    `dm_seen_${event._id || 'ev'}_${t.threadType || 'default'}_${t.freelancerId || t.label || 'x'}`;

  const readStoredSeen = (t) => {
    try {
      const raw = window.localStorage.getItem(storageKey(t));
      return raw !== null ? parseInt(raw, 10) : 0; // never opened before → 0 seen, not "all seen"
    } catch {
      return 0;
    }
  };

  const writeStoredSeen = (t, count) => {
    try { window.localStorage.setItem(storageKey(t), String(count)); } catch { /* ignore */ }
  };

  const [seenCounts, setSeenCounts] = useState(() => {
    const map = {};
    (event.conversations || []).forEach((t, i) => { map[i] = readStoredSeen(t); });
    return map;
  });

  // Pick up any brand-new threads that appear later (e.g. a first-time
  // contact) and seed their persisted baseline too.
  useEffect(() => {
    setSeenCounts(prev => {
      let changed = false;
      const map = { ...prev };
      threads.forEach((t, i) => {
        if (!(i in map)) {
          map[i] = readStoredSeen(t);
          changed = true;
        }
      });
      return changed ? map : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads.length]);

  // Mark ONLY the thread the user actually opened as seen — not every thread
  // just because the popup is open. This lets per-contact badges in the
  // contact list survive until that specific contact is clicked into.
  useEffect(() => {
    if (!open || active == null) return;
    const idx = threads.length === 1 ? 0 : activeIdx;
    if (idx == null) return;
    const count = (active.messages || []).length;
    setSeenCounts(prev => (prev[idx] === count ? prev : { ...prev, [idx]: count }));
    writeStoredSeen(active, count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIdx, active?.messages?.length, threads.length]);

  // Per-thread unread counts (used for the contact-list badges) plus the total.
  const threadUnread = threads.map((t, i) => {
    const msgs = t.messages || [];
    const seen = seenCounts[i] ?? 0; // default to 0 seen, not msgs.length, so real pending messages count
    return msgs.slice(seen).filter(m => m.senderRole !== myRole).length;
  });
  const unreadCount = threadUnread.reduce((sum, n) => sum + n, 0);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (threads.length === 0) return null;

  const pickFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    setMsgFiles(prev => [...prev, ...picked].slice(0, 5)); // matches backend's 5-file limit
    e.target.value = ''; // allow re-picking the same file
  };

  const removeFile = (idx) => setMsgFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!msgInput.trim() && msgFiles.length === 0) || !active) return;
    const content = msgInput;
    const files = msgFiles;
    setMsgInput('');
    setMsgFiles([]);
    setSending(true);
    try {
      await onSend({ threadType: active.threadType, freelancerId: active.freelancerId, content, files });
    } finally {
      setSending(false);
    }
  };

  return (
    <div ref={wrapperRef} className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="card fixed inset-x-4 bottom-24 sm:absolute sm:inset-x-auto sm:bottom-16 sm:right-0 w-auto sm:w-[340px] flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: 'min(480px, 65vh)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title flex items-center gap-2 min-w-0">
              {!showList && threads.length > 1 && (
                <button type="button" onClick={() => setActiveIdx(null)} className="p-1 -ml-1 rounded-lg hover:bg-white/10 text-white/50 flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <Send className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="truncate">{showList ? 'Direct Messages' : (active?.label || 'Direct Messages')}</span>
            </h3>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10 text-white/50 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {showList ? (
            // ── Contact list — pick a conversation to open ──────────────────
            <div className="flex-1 overflow-y-auto space-y-1 pr-1" style={{ maxHeight: '380px' }}>
              {threads.map((t, i) => {
                const msgs = t.messages || [];
                const last = msgs[msgs.length - 1];
                const lastPreview = last
                  ? (last.content?.trim() ? last.content : (last.attachments?.length ? `📎 ${last.attachments.length} attachment${last.attachments.length > 1 ? 's' : ''}` : 'No messages yet'))
                  : 'No messages yet';
                const unread = threadUnread[i] || 0;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                        {(t.label || '?')[0]?.toUpperCase()}
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#0a0a0f]">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${unread > 0 ? 'text-white font-semibold' : 'text-white font-medium'}`}>{t.label}</p>
                      <p className={`text-xs truncate ${unread > 0 ? 'text-white/70' : 'text-white/40'}`}>{lastPreview}</p>
                    </div>
                    {unread > 0 && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            // ── Open conversation — Messenger-style bubbles ─────────────────
            <>
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1" style={{ maxHeight: '320px' }}>
                {(active?.messages || []).length === 0 && (
                  <p className="text-white/30 text-xs text-center py-6">No messages yet</p>
                )}
                {(active?.messages || []).map((msg, i) => {
                  const isMe = msg.senderRole === myRole;
                  const time = msg.createdAt || msg.timestamp || msg.sentAt;
                  return (
                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {msg.content && (
                          <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                            ${isMe
                              ? 'bg-primary text-white rounded-br-md'
                              : 'bg-white/10 text-white/90 rounded-bl-md'}`}>
                            {msg.content}
                          </div>
                        )}
                        {msg.attachments?.length > 0 && (
                          <div className={`flex flex-col gap-1 ${msg.content ? 'mt-1' : ''}`}>
                            {msg.attachments.map((att, ai) => {
                              const isImage = att.type?.startsWith('image/');
                              const fullUrl = `${API_ORIGIN}${att.url}`;
                              return isImage ? (
                                <a key={ai} href={fullUrl} target="_blank" rel="noreferrer">
                                  <img src={fullUrl} alt={att.name}
                                    className="max-w-[160px] max-h-[160px] rounded-xl border border-white/10 object-cover" />
                                </a>
                              ) : (
                                <a key={ai} href={fullUrl} target="_blank" rel="noreferrer"
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs
                                    ${isMe ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/70'} hover:opacity-80 transition-opacity`}>
                                  <Paperclip className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate max-w-[140px]">{att.name}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                        {time && (
                          <span className="text-[10px] text-white/30 mt-1 px-1">{formatDateTime(time)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {locked ? (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-white/30 text-xs text-center py-2">
                    Messaging is closed — this project is complete and fully paid.
                  </p>
                </div>
              ) : (
                <>
                  {msgFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {msgFiles.map((f, i) => (
                        <span key={i} className="flex items-center gap-1 bg-white/10 text-white/70 text-[11px] pl-2 pr-1 py-1 rounded-lg">
                          <Paperclip className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[100px]">{f.name}</span>
                          <button type="button" onClick={() => removeFile(i)} className="hover:text-white p-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleSend} className="flex gap-1.5 pt-2 border-t border-white/10">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={pickFiles}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={msgFiles.length >= 5}
                      title="Attach files"
                      className="px-2 text-white/50 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      className="input flex-1 text-sm py-1.5"
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      placeholder={`Message ${active?.label || '...'}`}
                    />
                    <button type="submit" disabled={sending} className="btn-primary px-3 disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      )}

      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          title="Messages"
          aria-label="Messages"
          className="w-14 h-14 rounded-full bg-primary text-white shadow-2xl flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#0a0a0f]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClientEventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const socket = getSocket();

  const fetchEvent = async () => {
    try {
      const { data } = await api.get(`/events/${id}`);
      setEvent(data.event);
    } finally { setLoading(false); }
  };

  const fetchPayments = async () => {
    try {
      const { data } = await api.get(`/payments/summary/${id}`);
      setPaymentSummary(data.summary);
    } catch {}
  };

  useEffect(() => {
    fetchEvent();
    fetchPayments();
    if (socket) {
      socket.emit('join_event', id);
      socket.on('new_message', () => fetchEvent());
      socket.on('event_status_updated', ({ eventId }) => {
        if (eventId?.toString() === id) fetchEvent();
      });
      return () => {
        socket.off('new_message');
        socket.off('event_status_updated');
        socket.emit('leave_event', id);
      };
    }
  }, [id]);

  const sendComment = async (content) => {
    try {
      await api.post(`/events/${id}/comments`, { content });
      fetchEvent();
    } catch { toast.error('Failed to post comment'); }
  };

  const sendMessage = async ({ threadType, freelancerId, content, files }) => {
    try {
      if (files && files.length > 0) {
        const form = new FormData();
        form.append('threadType', threadType);
        if (freelancerId) form.append('freelancerId', freelancerId);
        form.append('content', content || '');
        files.forEach(f => form.append('attachments', f));
        await api.post(`/events/${id}/messages`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post(`/events/${id}/messages`, { threadType, freelancerId, content });
      }
      fetchEvent();
    } catch { toast.error('Failed to send message'); }
  };

  const handleRequestCancellation = async (reason) => {
    setCancelLoading(true);
    try {
      await api.post(`/events/${id}/request-cancellation`, { reason });
      toast.success('Cancellation request submitted. We will review and notify you.');
      setShowCancelModal(false);
      fetchEvent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit cancellation request');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleWithdrawCancellation = async () => {
    setWithdrawLoading(true);
    try {
      await api.post(`/events/${id}/withdraw-cancellation`);
      toast.success('Cancellation request withdrawn successfully.');
      setShowWithdrawModal(false);
      fetchEvent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to withdraw cancellation request');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleSubmitFeedback = async ({ rating, comment }) => {
    setFeedbackLoading(true);
    try {
      await api.post(`/events/${id}/feedback`, { rating, comment });
      toast.success('Thanks for your feedback!');
      fetchEvent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!event) return <div className="text-white/50">Event not found</div>;

  const canRequestCancellation = CANCELLABLE_STATUSES.includes(event.status);
  const isCancellationPending = event.status === 'cancellation_requested';

  // Parse custom "Others" category description out of specialRequests
  const parsedCategory = (() => {
    if (event.eventCategory !== 'Others' || !event.specialRequests) {
      return { categoryOther: '', specialRequests: event.specialRequests || '' };
    }
    const match = event.specialRequests.match(/^Event type: (.+?)(?:\n\n([\s\S]*))?$/);
    if (match) {
      return {
        categoryOther:   match[1].trim(),
        specialRequests: (match[2] || '').trim(),
      };
    }
    return { categoryOther: '', specialRequests: event.specialRequests };
  })();

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl mx-auto">
      {/* Cancel Modal */}
      {showCancelModal && (
        <CancelModal
          event={event}
          paymentSummary={paymentSummary}
          onConfirm={handleRequestCancellation}
          onClose={() => setShowCancelModal(false)}
          loading={cancelLoading}
        />
      )}

      {/* Withdraw Cancellation Modal */}
      {showWithdrawModal && (
        <WithdrawCancelModal
          event={event}
          onConfirm={handleWithdrawCancellation}
          onClose={() => setShowWithdrawModal(false)}
          loading={withdrawLoading}
        />
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <button onClick={() => navigate('/client/events')} className="btn-ghost p-2 self-start flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title truncate max-w-full">{event.eventName}</h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-white/50 text-sm mt-0.5 truncate">{formatDate(event.eventDate)} · {event.location}</p>
        </div>

        {/* Cancel button — only shown when cancellation is possible */}
        {canRequestCancellation && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20
              text-red-400 text-sm font-medium hover:bg-red-500/20 hover:border-red-500/40 transition-colors flex-shrink-0 w-full sm:w-auto"
          >
            <XCircle className="w-4 h-4" />
            Cancel Event
          </button>
        )}

        {/* Withdraw button — shown when cancellation is pending review */}
        {isCancellationPending && (
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/20
              text-teal-400 text-sm font-medium hover:bg-teal-500/20 hover:border-teal-500/40 transition-colors flex-shrink-0 w-full sm:w-auto"
          >
            <RotateCcw className="w-4 h-4" />
            Withdraw Request
          </button>
        )}
      </div>

      {/* ── Status Banners ── */}

      {event.status === 'inquiry_received' && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-blue-400 font-semibold"> Pending Review</p>
          <p className="text-white/50 text-sm mt-0.5">
            Your inquiry has been received. Our team will review it and get back to you within 24 hours.
          </p>
        </div>
      )}

      {event.status === 'inquiry_accepted' && (
        <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl">
          <p className="text-teal-400 font-semibold"> Inquiry Accepted</p>
          <p className="text-white/50 text-sm mt-0.5">
            Our team has accepted your inquiry and is scheduling your needs assessment meeting. You will be notified once a schedule is confirmed.
          </p>
          {event.meetingPreference?.type === 'ftf' && (
            <p className="text-teal-400/70 text-xs mt-2">
              Your preferred schedule: {event.meetingPreference.preferredDate
                ? new Date(event.meetingPreference.preferredDate).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : '—'} at {event.meetingPreference.preferredTime || '—'}
            </p>
          )}
        </div>
      )}

      {event.status === 'meeting_scheduled' && event.scheduledMeeting?.confirmedDate && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl space-y-2">
          <p className="text-white font-semibold">
            {event.scheduledMeeting.meetingType === 'ftf' ? 'Face-to-Face' : 'Online'} Meeting Confirmed
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-white/40 text-xs">Date</p>
              <p className="text-white font-medium">
                {new Date(event.scheduledMeeting.confirmedDate).toLocaleDateString('en-PH', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Time</p>
              <p className="text-white font-medium">{event.scheduledMeeting.confirmedTime}</p>
            </div>
          </div>
          <div>
            <p className="text-white/40 text-xs">
              {event.scheduledMeeting.meetingType === 'ftf' ? 'Location' : 'Meeting Link'}
            </p>
            {event.scheduledMeeting.meetingType === 'online' ? (
              <button
                onClick={() => navigate('/client/meetings')}
                className="text-primary text-sm underline"
              >
                Go to Meeting
              </button>
            ) : (
              <p className="text-white text-sm">
                {event.scheduledMeeting.location}
              </p>
            )}
          </div>
          {event.scheduledMeeting.notes && (
            <p className="text-white/50 text-xs italic border-t border-white/10 pt-2">
              Note: {event.scheduledMeeting.notes}
            </p>
          )}
        </div>
      )}

      {event.status === 'needs_assessed' && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-purple-400 font-semibold"> Assessment Completed</p>
          <p className="text-white/50 text-sm mt-0.5">
            Your needs have been assessed. Our team is now preparing your custom quotation.
          </p>
        </div>
      )}

      {event.status === 'quotation_sent' && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-yellow-400 font-semibold"> Quotation Ready for Review</p>
            <p className="text-white/50 text-sm mt-0.5">Your custom quotation is ready. Review and approve it to proceed.</p>
          </div>
          <button onClick={() => navigate('/client/quotations')} className="btn-primary text-sm whitespace-nowrap w-full sm:w-auto justify-center">
            View Quotation
          </button>
        </div>
      )}

      {event.status === 'confirmed' && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
          <p className="text-orange-400 font-semibold"> Downpayment Required</p>
          <p className="text-white/50 text-sm mt-1">
            Your quotation has been approved! To proceed, please pay the <strong className="text-white">50% downpayment</strong> within a day.
            Our team cannot be assigned until payment is received and verified.
          </p>
          {paymentSummary?.totalAmount > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-sm">
                <span className="text-white/50">Required: </span>
                <span className="text-white font-semibold">{formatCurrency(paymentSummary.totalAmount * 0.5)}</span>
              </div>
              <button onClick={() => navigate(`/client/payments`)} className="btn-primary text-sm w-full sm:w-auto justify-center">
                Pay Downpayment
              </button>
            </div>
          )}
        </div>
      )}

      {event.status === 'downpayment_paid' && (
        <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl">
          <p className="text-teal-400 font-semibold"> Downpayment Confirmed</p>
          <p className="text-white/50 text-sm mt-0.5">Your 50% downpayment has been received. We are now assigning your team.</p>
        </div>
      )}

      {event.status === 'assigned' && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
          <p className="text-primary font-semibold"> Team Assigned</p>
          <p className="text-white/50 text-sm mt-0.5">Your project team has been assigned. Check the Team tab for details.</p>
        </div>
      )}

      {event.status === 'in_progress' && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-blue-400 font-semibold"> Event In Progress</p>
          <p className="text-white/50 text-sm mt-0.5">Your event is currently underway. Sit back and enjoy!</p>
        </div>
      )}

      {event.status === 'completed_pending_balance' && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
          <p className="text-orange-400 font-semibold"> Event Completed — Balance Due</p>
          <p className="text-white/50 text-sm mt-1">
            Your event is complete! Please settle the remaining balance to receive your deliverables.
          </p>
          {paymentSummary?.balance > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-sm">
                <span className="text-white/50">Balance: </span>
                <span className="text-white font-semibold">{formatCurrency(paymentSummary.balance)}</span>
              </div>
              <button onClick={() => navigate(`/client/payments`)} className="btn-primary text-sm w-full sm:w-auto justify-center">
                Pay Balance
              </button>
            </div>
          )}
        </div>
      )}

      {event.status === 'completed_paid' && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-400 font-semibold"> Project Complete — Fully Paid</p>
          <p className="text-white/50 text-sm mt-0.5">Thank you! Check the Deliverables tab for your videos and photos.</p>
        </div>
      )}

      {/* Feedback — surfaced right after the paid status, not buried below everything else */}
      {event.status === 'completed_paid' && (
        <FeedbackCard event={event} onSubmit={handleSubmitFeedback} loading={feedbackLoading} />
      )}

      {/* Cancellation requested — pending admin review */}
      {event.status === 'cancellation_requested' && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-orange-400" />
            <p className="text-orange-400 font-semibold">Cancellation Pending Review</p>
          </div>
          <p className="text-white/50 text-sm">
            Your cancellation request has been submitted and is awaiting admin approval. We will notify you once a decision is made.
          </p>
          {event.cancellationRequest?.reason && (
            <p className="text-white/30 text-xs italic border-t border-white/10 pt-2">
              Your reason: {event.cancellationRequest.reason}
            </p>
          )}
        </div>
      )}

      {/* Cancelled */}
      {event.status === 'cancelled' && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-1">
          <p className="text-red-400 font-semibold">✕ Event Cancelled</p>
          <p className="text-white/50 text-sm">
            This event has been cancelled.
            {event.cancellationRequest?.adminNote && (
              <> Admin note: {event.cancellationRequest.adminNote}</>
            )}
          </p>
          {(event.cancellationRequest?.requestedBy?.toString() === event.client?._id?.toString()) && (
            <p className="text-white/30 text-xs">Please note: all payments made are non-refundable.</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
              ${tab === t ? 'text-primary border-primary' : 'text-white/50 border-transparent hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Main content (left) + always-visible sidebar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 space-y-4">

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title mb-3">Event Details</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Event Name',  event.eventName],
                ['Date',        formatDate(event.eventDate)],
                ['Location',    event.location],
                ['Category',    event.eventCategory === 'Others' && parsedCategory.categoryOther
                                  ? `Others — ${parsedCategory.categoryOther}`
                                  : (event.eventCategory || '—')],
                ['Attendees',   event.needsAssessment?.attendees || event.attendees || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-white/40 text-xs">{k}</dt>
                  <dd className="text-white font-medium text-sm mt-0.5 break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {parsedCategory.specialRequests && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Special Requests</p>
                <p className="text-white/70 text-sm">{parsedCategory.specialRequests}</p>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="section-title mb-3">Services</h3>
            <ServiceBadges services={event.services} size="lg" />
          </div>

          {paymentSummary && paymentSummary.quotation && (
            <div className="card">
              <h3 className="section-title mb-3">Payment Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Total Amount</span>
                  <span className="text-white font-medium">{formatCurrency(paymentSummary.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">50% Downpayment</span>
                  <span className={`font-medium ${paymentSummary.totalPaid >= paymentSummary.totalAmount * 0.5 ? 'text-green-400' : 'text-orange-400'}`}>
                    {formatCurrency(paymentSummary.totalAmount * 0.5)}
                    {paymentSummary.totalPaid >= paymentSummary.totalAmount * 0.5
                      ? '  Paid'
                      : ` — ${formatCurrency(paymentSummary.totalAmount * 0.5 - paymentSummary.totalPaid)} remaining`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Total Paid</span>
                  <span className="text-green-400 font-medium">{formatCurrency(paymentSummary.totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                  <span className="text-white/50">Balance Due</span>
                  <span className={`font-bold ${paymentSummary.balance > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {formatCurrency(paymentSummary.balance)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <ProjectTimeline event={event} />
        </div>
      )}

      {/* Team Tab */}
      {tab === 'team' && (
        <div className="space-y-4">
          {event.assignedFreelancers?.length === 0 ? (
            <div className="card text-center py-8">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-2" />
              <p className="text-white/40">Team not yet assigned</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {event.assignedFreelancers?.map((af, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary">
                      {af.freelancer?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{af.freelancer?.name}</p>
                      <p className="text-primary text-xs">{af.role}</p>
                      <p className="text-white/40 text-xs">{af.freelancer?.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat Tab removed — comments now live in the sidebar CommentsCard */}

      {/* Deliverables Tab */}
      {tab === 'deliverables' && (
        <div className="card">
          <h3 className="section-title mb-4">Your Deliverables</h3>
          {event.deliverables?.length === 0 ? (
            <div className="text-center py-8">
              <Download className="w-10 h-10 text-white/20 mx-auto mb-2" />
              <p className="text-white/40">No deliverables uploaded yet</p>
              <p className="text-white/30 text-xs mt-1">Your videos and photos will appear here after the project</p>
            </div>
          ) : (
            <div className="space-y-3">
              {event.deliverables?.map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    {d.type === 'photo' ? '' : ''}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium capitalize">{d.type}</p>
                    <p className="text-white/40 text-xs truncate">{d.url}</p>
                  </div>
                  <Download className="w-4 h-4 text-primary" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      </div>

      {/* Sidebar — always visible regardless of active tab */}
      <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4">
        <AssignedStaffCard event={event} />
        <EquipmentOverviewCard event={event} />
        <CommentsCard event={event} onSend={sendComment} myRole="client" locked={event.status === 'completed_paid'} />
      </div>

      </div>

      {/* Floating Direct Messages popup */}
      <DirectMessagesPopup event={event} onSend={sendMessage} myRole="client" locked={event.status === 'completed_paid'} />
    </div>
  );
}