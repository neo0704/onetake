import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, CheckCircle, XCircle, Send,
  Plus, Trash2, Save, Users, Wrench,
  Calendar, ChevronDown, ChevronUp, AlertTriangle, X, Star, MessageSquare, Paperclip, Settings,
} from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, StatusBadge, Modal } from '../../components/shared';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import AssessmentTab     from '../../components/AssessmentTab';
import MeetingScheduleCard from '../../components/MeetingScheduleCard';
import ProjectTimeline   from '../../components/ProjectTimeline';
import DamageReportModal from '../../components/DamageReportModal';
import { formatDate, formatDateTime, formatCurrency, STATUS_LABELS } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── Derive the backend origin from the axios base URL so that relative
//    upload paths (e.g. /uploads/checkin/photo.jpg) resolve correctly
//    instead of hitting the React dev-server.
const API_ORIGIN = (api.defaults.baseURL || '').replace(/\/api.*$/, '');

const STATUS_ORDER = [
  'inquiry_accepted', 'meeting_scheduled',
  'needs_assessed', 'quotation_sent', 'confirmed', 'downpayment_paid',
  'assigned', 'in_progress', 'completed_pending_balance', 'completed_paid',
];

const COMPLETED = ['completed_paid', 'completed_pending_balance', 'cancelled'];

const ROLES = [
  'Camera Operator', 'Videographer', 'Photographer', 'Livestream Operator',
  'Video Editor', 'Audio Engineer', 'Lighting Technician', 'Technical Director',
  'Drone Pilot', 'Stream Operator', 'Director of Photography',
];

// ── Badge colour maps (mirrors Equipment.jsx) ────────────────────────────────
const AVAIL_COLORS = {
  available:   'bg-green-500/20 text-green-400',
  in_use:      'bg-blue-500/20  text-blue-400',
  maintenance: 'bg-yellow-500/20 text-yellow-400',
  retired:     'bg-red-500/20   text-red-400',
};
const CONDITION_COLORS = {
  excellent:    'bg-green-500/20 text-green-400',
  good:         'bg-green-500/20 text-green-400',
  fair:         'bg-yellow-500/20 text-yellow-400',
  needs_repair: 'bg-red-500/20 text-red-400',
};

const getTabs = (status) => {
  const tabs = ['overview'];
  if (['inquiry_accepted', 'meeting_scheduled'].includes(status)) tabs.push('meeting');
  if (['needs_assessed', 'quotation_sent', 'confirmed', 'assigned',
       'in_progress', 'completed_pending_balance', 'completed_paid'].includes(status)) {
    tabs.push('assessment');
  }
  if (['confirmed', 'downpayment_paid', 'assigned', 'in_progress',
       'completed_pending_balance', 'completed_paid'].includes(status)) {
    tabs.push('assignment');
  }
  if (status === 'completed_paid') {
    tabs.push('deliverables');
  }
  return tabs;
};

// ── Feedback Banner — surfaced immediately once the client rates the event ────
function FeedbackBanner({ feedback, clientName }) {
  return (
    <div className="p-4 bg-gradient-to-r from-yellow-500/10 via-primary/5 to-transparent border border-yellow-500/25 rounded-xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
              <Star
                key={n}
                className={`w-4 h-4 ${n <= feedback.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`}
              />
            ))}
          </span>
          <p className="text-yellow-400 font-semibold text-sm">
            {clientName ? `${clientName} rated this event ${feedback.rating}/5` : `Client Feedback — ${feedback.rating}/5`}
          </p>
        </div>
        {feedback.submittedAt && (
          <span className="text-white/30 text-xs flex-shrink-0">{formatDateTime(feedback.submittedAt)}</span>
        )}
      </div>
      {feedback.comment ? (
        <p className="text-white/70 text-sm italic mt-2 leading-relaxed">"{feedback.comment}"</p>
      ) : (
        <p className="text-white/30 text-xs italic mt-2">No written comment left.</p>
      )}
    </div>
  );
}

// ── Messaging Settings popover (per-project, opened via a gear icon) ─────────
function MessagingSettingsPopover({ event, onToggle, savingField }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const settings = event.messagingSettings || {};
  const allowDirect   = settings.allowClientFreelancerDirectMessages     !== false;
  const allowTeammate = settings.allowFreelancerFreelancerDirectMessages !== false;

  const Row = ({ field, label, checked }) => (
    <div className="flex items-start justify-between gap-3 py-2">
      <p className="text-white/70 text-sm leading-snug">{label}</p>
      <button
        onClick={() => onToggle(field, !checked)}
        disabled={savingField === field}
        aria-pressed={checked}
        style={{ width: '40px', height: '22px' }}
        className={`relative rounded-full transition-colors flex-shrink-0 overflow-hidden ${
          checked ? 'bg-green-500' : 'bg-white/20'
        } ${savingField === field ? 'opacity-50' : ''}`}
      >
        <span
          style={{
            width: '16px',
            height: '16px',
            top: '3px',
            left: '3px',
            transform: checked ? 'translateX(18px)' : 'translateX(0)',
          }}
          className="absolute bg-white rounded-full transition-transform duration-200"
        />
      </button>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Messaging settings"
        aria-label="Messaging settings"
        className="btn-ghost p-2 flex-shrink-0"
      >
        <Settings className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-dark-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-white font-medium text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Messaging Settings
            </h3>
            <p className="text-white/30 text-xs mt-0.5">Controls for this project only.</p>
          </div>
          <div className="px-4 py-2 divide-y divide-white/5">
            <Row field="allowClientFreelancerDirectMessages" label="Client ↔ freelancer direct messages" checked={allowDirect} />
            <Row field="allowFreelancerFreelancerDirectMessages" label="Freelancer ↔ freelancer direct messages" checked={allowTeammate} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar: Assigned Staff (compact, always-visible team + check-in glance) ──
function AssignedStaffCard({ event }) {
  const team = event.assignedFreelancers || [];
  const showAttend = ['in_progress', 'completed_pending_balance', 'completed_paid'].includes(event.status);
  const checkedInCount = (event.attendance || []).filter(a => a.checkedIn).length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Assigned Staff
        </h3>
        {showAttend && team.length > 0 && (
          <span className="text-white/40 text-xs flex-shrink-0">{checkedInCount}/{team.length} in</span>
        )}
      </div>

      {team.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">No team assigned yet</p>
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
                  ? checked ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-orange-500/15'
                  : 'bg-white/5 border-white/5'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${showAttend && checked ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'}`}>
                  {(af.freelancer?.name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{af.freelancer?.name}</p>
                  <p className="text-white/40 text-xs truncate">{af.role || 'No role set'}</p>
                </div>
                {showAttend && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0
                    ${checked ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {checked ? 'In' : 'Not yet'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAttend && team.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: team.length ? `${(checkedInCount / team.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar: Equipment Overview (aggregated across the assigned team) ─────────
function EquipmentOverviewCard({ event }) {
  const team = event.assignedFreelancers || [];
  const itemMap = {};

  team.forEach(af => {
    (af.equipment || []).forEach(eq => {
      const item = eq.equipment;
      const key = item?._id?.toString() || item?.toString();
      if (!key) return;
      if (!itemMap[key]) {
        itemMap[key] = { name: item?.name || 'Equipment', category: item?.category || '', qty: 0, holders: [] };
      }
      itemMap[key].qty += eq.quantity || 1;
      if (af.freelancer?.name) itemMap[key].holders.push(af.freelancer.name);
    });
  });

  const items = Object.values(itemMap);

  return (
    <div className="card">
      <h3 className="section-title flex items-center gap-2 mb-3">
        <Wrench className="w-4 h-4 text-primary" /> Equipment Overview
      </h3>
      {items.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">No equipment assigned yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5 border border-white/5 text-sm">
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{it.name}</p>
                <p className="text-white/40 text-xs truncate">{it.holders.join(', ')}</p>
              </div>
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
// Formats bytes into a friendly "12.3 KB" / "1.4 MB" label for attachment chips
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Renders an attachment as either an inline image thumbnail or a downloadable file chip
function AttachmentList({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {attachments.map((att, ai) => {
        const isImage = att.type?.startsWith('image/');
        const href = `${API_ORIGIN}${att.url}`;
        return isImage ? (
          <a key={ai} href={href} target="_blank" rel="noopener noreferrer">
            <img src={href} alt={att.name} className="w-28 h-28 object-cover rounded-lg border border-white/10 hover:opacity-90 transition-opacity" />
          </a>
        ) : (
          <a key={ai} href={href} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <Paperclip className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-white/70 text-xs truncate max-w-[140px]">{att.name}</span>
            {att.size > 0 && <span className="text-white/30 text-[10px] flex-shrink-0">{formatFileSize(att.size)}</span>}
          </a>
        );
      })}
    </div>
  );
}

function CommentsCard({ event, onSend, myRole, locked }) {
  const [comment, setComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  const addFiles = (fileList) => setPendingFiles(prev => [...prev, ...Array.from(fileList)].slice(0, 5));
  const removeFile = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSend = async (e) => {
    e.preventDefault();
    if (!comment.trim() && pendingFiles.length === 0) return;
    const content     = comment;
    const attachments = pendingFiles;
    setComment('');
    setPendingFiles([]);
    setSending(true);
    try {
      await onSend(content, attachments);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card flex flex-col">
      <h3 className="section-title flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-primary" /> Comments
      </h3>
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1" style={{ maxHeight: '260px' }}>
        {(event.messages || []).length === 0 && (
          <p className="text-white/30 text-xs text-center py-6">No comments yet</p>
        )}
        {(event.messages || []).map((msg, i) => {
          const isMe = msg.senderRole === myRole;
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-white/40 mb-0.5 px-1">
                  {msg.senderName} · <span className="capitalize">{msg.senderRole}</span>
                </span>
                {msg.content && (
                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words
                    ${isMe ? 'bg-primary text-white rounded-br-md' : 'bg-white/10 text-white/90 rounded-bl-md'}`}>
                    {msg.content}
                  </div>
                )}
                <AttachmentList attachments={msg.attachments} />
                {msg.createdAt && (
                  <span className="text-[10px] text-white/30 mt-1 px-1">{formatDateTime(msg.createdAt)}</span>
                )}
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
        <>
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 pt-2 border-t border-white/10">
              {pendingFiles.map((f, i) => (
                <span key={i} className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-white/10 text-xs text-white/70">
                  <Paperclip className="w-3 h-3 text-primary flex-shrink-0" />
                  <span className="truncate max-w-[110px]">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="p-0.5 rounded hover:bg-white/10 text-white/40">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-1.5 pt-2 border-t border-white/10">
            <input ref={fileInputRef} type="file" multiple className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors flex-shrink-0" title="Attach files">
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              className="input flex-1 text-sm py-1.5"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
            />
            <button type="submit" disabled={sending} className="btn-primary px-3 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

// ── Floating Direct Messages popup — private per-pair threads (client↔admin
// here, admin↔freelancer per assigned freelancer). Click the floating icon
// to open; tabs only show up when there's more than one thread. ──────────────
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
        <div className="card fixed inset-x-4 bottom-24 sm:absolute sm:inset-x-auto sm:bottom-16 sm:right-0 w-auto sm:w-[340px] flex flex-col shadow-2xl" style={{ maxHeight: '480px' }}>
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

export default function AdminEventDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [event,              setEvent]              = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [saving,             setSaving]             = useState(false);
  const [tab,                setTab]                = useState('overview');
  const [deliverableForm,    setDeliverableForm]    = useState({ type: 'video', url: '' });
  const [addingDeliverable,  setAddingDeliverable]  = useState(false);
  const [equipment,          setEquipment]          = useState([]);
  const [freelancers,        setFreelancers]        = useState([]);
  const [assignedFreelancers,setAssignedFreelancers]= useState([]);
  const [expandedFr,         setExpandedFr]         = useState(null);
  // Tracks which multi-unit equipment items are expanded in the picker (per-freelancer keyed by eqId)
  const [expandedEqItems,    setExpandedEqItems]    = useState(new Set());
  const [newCheckItem,       setNewCheckItem]       = useState('');
  const [paymentSummary,     setPaymentSummary]     = useState(null);
  const [showPayWarn,        setShowPayWarn]        = useState(false);
  const [showDamageReport,   setShowDamageReport]   = useState(false);
  const [lightboxPhotos,     setLightboxPhotos]     = useState([]);
  const [lightboxIndex,      setLightboxIndex]      = useState(0);

  const [showCancelModal,    setShowCancelModal]    = useState(false);
  const [cancelAction,       setCancelAction]       = useState(null);
  const [adminNote,          setAdminNote]          = useState('');
  const [cancelLoading,      setCancelLoading]      = useState(false);

  const [confirm, setConfirm] = useState({
    open: false, title: '', message: '', type: 'warning',
    confirmLabel: 'Confirm', onConfirm: null, loading: false,
  });
  const askConfirm   = (opts) => setConfirm({ open: true, loading: false, ...opts });
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false, loading: false }));
  const runConfirm   = async () => {
    setConfirm(c => ({ ...c, loading: true }));
    try { await confirm.onConfirm(); } finally { closeConfirm(); }
  };

  // True while the user has unsaved edits to the assignment draft
  // (added/removed freelancers, roles, equipment units). While it is true the
  // background poll refreshes `event` but leaves `assignedFreelancers` alone,
  // so the Team panel is never wiped mid-edit.
  const dirtyRef = useRef(false);

  const fetchEvent = useCallback(async (opts = {}) => {
    const { syncDraft = true } = opts;
    try {
      const { data } = await api.get(`/events/${id}`);
      const ev = data.event;
      setEvent(ev);
      if (syncDraft && !dirtyRef.current) {
        setAssignedFreelancers(
          (ev.assignedFreelancers || []).map(af => ({
            freelancer: af.freelancer?._id || af.freelancer,
            role:       af.role || '',
            equipment:  (af.equipment || []).map(eq => ({
              equipment:   eq.equipment?._id || eq.equipment,
              quantity:    eq.quantity || 1,
              // unitIndices: which specific unit slots (0-based) are assigned
              unitIndices: eq.unitIndices || [],
            })),
          }))
        );
      }
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  // Poll for updates (new messages, attendance, etc.) so the page — and the
  // unread-messages badge in particular — stays live without a manual reload.
  useEffect(() => {
    const interval = setInterval(() => { fetchEvent({ syncDraft: false }); }, 15000); // every 15s
    return () => clearInterval(interval);
  }, [fetchEvent]);

  useEffect(() => {
    api.get('/equipment').then(r => setEquipment(r.data.equipment || []));
    api.get('/users?role=freelancer').then(r => setFreelancers(r.data.users || []));
  }, []);

  useEffect(() => {
    if (!event) return;
    if (tab === 'assignment' || event.status === 'downpayment_paid') {
      api.get(`/payments/summary/${event._id}`)
        .then(r => setPaymentSummary(r.data.summary))
        .catch(() => setPaymentSummary(null));
    }
  }, [tab, event]);

  const updateStatus = async (newStatus) => {
    try {
      await api.put(`/events/${id}/status`, { status: newStatus });
      toast.success(`Status updated`);
      fetchEvent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const saveAssessment = async (formData) => {
    setSaving(true);
    try {
      await api.put(`/events/${id}/needs-assessment`, formData);
      toast.success('Assessment saved. Packages will auto-fill the quotation.');
      fetchEvent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving assessment'); }
    finally { setSaving(false); }
  };

  const [savingMessagingField, setSavingMessagingField] = useState(null);

  const toggleMessagingSetting = async (field, value) => {
    setSavingMessagingField(field);
    // Optimistic update so the toggle feels instant
    setEvent(prev => prev && ({
      ...prev,
      messagingSettings: { ...prev.messagingSettings, [field]: value },
    }));
    try {
      await api.patch(`/events/${id}/messaging-settings`, { [field]: value });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update setting');
      fetchEvent(); // revert to server truth on failure
    } finally {
      setSavingMessagingField(null);
    }
  };

  const doSaveAssignment = async () => {
    setSaving(true);
    try {
      await api.put(`/events/${id}/assign`, { assignedFreelancers });
      toast.success('Team and equipment assigned.');
      dirtyRef.current = false;   // saved — server is now the source of truth
      fetchEvent();
      setShowPayWarn(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  // Roles that legitimately carry no gear. Anyone whose role is in this list is
  // exempt from the "must have equipment" rule below — add or remove as needed.
  const NO_EQUIPMENT_ROLES = ['coordinator', 'assistant', 'host'];

  const nameOf = (fId) =>
    freelancers.find(f => f._id === fId)?.name || 'a team member';

  const saveAssignment = async () => {
    // Warn if any freelancer has no role assigned
    const missingRoles = assignedFreelancers.filter(af => !af.role || af.role.trim() === '');
    if (missingRoles.length > 0) {
      const names = missingRoles.map(af => nameOf(af.freelancer));
      toast.error(`Please assign a role to: ${names.join(', ')}`);
      return;
    }

    // Every team member must have at least one piece of equipment assigned,
    // unless their role is exempt above.
    const missingEquipment = assignedFreelancers.filter(af => {
      const exempt = NO_EQUIPMENT_ROLES.includes((af.role || '').trim().toLowerCase());
      if (exempt) return false;
      const units = (af.equipment || []).reduce(
        (n, e) => n + (e.unitIndices?.length || e.quantity || 0), 0
      );
      return units === 0;
    });
    if (missingEquipment.length > 0) {
      const names = missingEquipment.map(af => nameOf(af.freelancer));
      toast.error(`Please assign equipment to: ${names.join(', ')}`);
      return;
    }
    const total    = paymentSummary?.totalAmount || 0;
    const paid     = paymentSummary?.totalPaid   || 0;
    const required = total * 0.5;
    if (total > 0 && paid < required) { setShowPayWarn(true); return; }
    doSaveAssignment();
  };

  // ── Cancellation resolution ───────────────────────────────────────────────
  const openCancelResolution = (action) => {
    setCancelAction(action);
    setAdminNote('');
    setShowCancelModal(true);
  };

  const processCancellation = async () => {
    setCancelLoading(true);
    try {
      await api.put(`/events/${id}/process-cancellation`, { action: cancelAction, adminNote });
      toast.success(
        cancelAction === 'approve'
          ? 'Cancellation approved. Event has been cancelled.'
          : 'Cancellation request rejected. Event is now active again.'
      );
      setShowCancelModal(false);
      fetchEvent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process cancellation');
    } finally { setCancelLoading(false); }
  };

  // ── Equipment toggle helpers ──────────────────────────────────────────────

  // Toggle expansion of a multi-unit equipment row in the picker
  const toggleEqExpand = (eqId) => {
    setExpandedEqItems(prev => {
      const n = new Set(prev);
      n.has(eqId) ? n.delete(eqId) : n.add(eqId);
      return n;
    });
  };

  // For qty === 1 equipment: simple on/off toggle
  const toggleEquip = (fId, eqId) => {
    dirtyRef.current = true;
    setAssignedFreelancers(prev => prev.map(af => {
      if (af.freelancer !== fId) return af;
      const has = af.equipment.find(e => e.equipment === eqId);
      return has
        ? { ...af, equipment: af.equipment.filter(e => e.equipment !== eqId) }
        : { ...af, equipment: [...af.equipment, { equipment: eqId, quantity: 1, unitIndices: [0] }] };
    }));
  };

  // For qty > 1 equipment: toggle an individual unit slot by index
  const toggleUnit = (fId, eqId, unitIndex) => {
    dirtyRef.current = true;
    setAssignedFreelancers(prev => prev.map(af => {
      if (af.freelancer !== fId) return af;
      const existing = af.equipment.find(e => e.equipment === eqId);

      if (!existing) {
        // First unit selected for this equipment
        return {
          ...af,
          equipment: [...af.equipment, { equipment: eqId, quantity: 1, unitIndices: [unitIndex] }],
        };
      }

      const currentIndices = existing.unitIndices || [];
      const hasUnit        = currentIndices.includes(unitIndex);
      const newIndices     = hasUnit
        ? currentIndices.filter(i => i !== unitIndex)
        : [...currentIndices, unitIndex].sort((a, b) => a - b);

      if (newIndices.length === 0) {
        // All units deselected — remove equipment entry entirely
        return { ...af, equipment: af.equipment.filter(e => e.equipment !== eqId) };
      }

      return {
        ...af,
        equipment: af.equipment.map(e =>
          e.equipment === eqId
            ? { ...e, quantity: newIndices.length, unitIndices: newIndices }
            : e
        ),
      };
    }));
  };

  const addFreelancer = (fr) => {
    if (assignedFreelancers.find(af => af.freelancer === fr._id)) {
      toast.error(`${fr.name} is already in the team`); return;
    }
    dirtyRef.current = true;
    setAssignedFreelancers(prev => [...prev, { freelancer: fr._id, role: '', equipment: [] }]);
    setExpandedFr(fr._id);
  };

  const removeFreelancer = (fId) => {
    dirtyRef.current = true;
    setAssignedFreelancers(prev => prev.filter(af => af.freelancer !== fId));
    if (expandedFr === fId) setExpandedFr(null);
  };

  const setRole = (fId, role) => {
    dirtyRef.current = true;
    setAssignedFreelancers(prev => prev.map(af => af.freelancer === fId ? { ...af, role } : af));
  };

  const addCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    try {
      await api.post(`/events/${id}/checklist`, { item: newCheckItem });
      setNewCheckItem(''); fetchEvent();
    } catch { toast.error('Failed to add'); }
  };

  const toggleCheckItem = async (itemId) => {
    try { await api.put(`/events/${id}/checklist/${itemId}`); fetchEvent(); }
    catch { toast.error('Failed'); }
  };

  const deleteCheckItem = async (itemId) => {
    try { await api.delete(`/events/${id}/checklist/${itemId}`); fetchEvent(); }
    catch { toast.error('Failed'); }
  };

  const sendComment = async (content) => {
    try {
      await api.post(`/events/${id}/comments`, { content });
      fetchEvent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post comment');
    }
  };

  const addDeliverable = async (e) => {
    e.preventDefault();
    if (!deliverableForm.url.trim()) return;
    setAddingDeliverable(true);
    try {
      await api.post(`/events/${id}/deliverables`, deliverableForm);
      toast.success('Deliverable added — client has been notified');
      setDeliverableForm({ type: 'video', url: '' });
      fetchEvent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add deliverable');
    } finally {
      setAddingDeliverable(false);
    }
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!event)  return <div className="text-white/50 p-8">Event not found</div>;

  const tabs       = getTabs(event.status);
  const isEnded    = COMPLETED.includes(event.status);
  const services   = event.services || {};
  const isCancelPending = event.status === 'cancellation_requested';
  const activeTab  = tabs.includes(tab) ? tab : 'overview';

  // If client selected "Others" category, the custom description was prepended
  // to specialRequests as "Event type: [value]\n\n[rest]". Parse them apart.
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

      {/* ── Cancellation Resolution Modal ─────────────────────────────────── */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => !cancelLoading && setShowCancelModal(false)}
        title={cancelAction === 'approve' ? 'Approve Cancellation' : 'Reject Cancellation Request'}
      >
        <div className="space-y-4">
          {cancelAction === 'approve' ? (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-red-400 font-semibold text-sm">This will permanently cancel the event</p>
                <p className="text-white/50 text-xs leading-relaxed">
                  The client will be notified that their cancellation has been approved and that
                  all payments made are non-refundable.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-white/50 text-xs leading-relaxed">
                The event will be restored to its previous active status and the client will be notified
                that their request was not approved.
              </p>
            </div>
          )}

          {event.cancellationRequest?.reason && (
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-white/40 text-xs mb-1">Client's reason</p>
              <p className="text-white/70 text-sm italic">"{event.cancellationRequest.reason}"</p>
            </div>
          )}

          <div>
            <label className="text-white/50 text-xs block mb-1.5">
              Note to client <span className="text-white/30">(optional)</span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder={
                cancelAction === 'approve'
                  ? 'e.g. Cancellation confirmed. Thank you for informing us.'
                  : 'e.g. We are unable to cancel at this stage as the team has already been deployed.'
              }
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowCancelModal(false)} disabled={cancelLoading} className="btn-ghost flex-1 justify-center">
              Go Back
            </button>
            <button
              onClick={processCancellation}
              disabled={cancelLoading}
              className={`flex-1 px-4 py-2.5 rounded-xl border font-medium text-sm transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${cancelAction === 'approve'
                  ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30 hover:border-red-500/60'
                  : 'bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/30 hover:border-green-500/60'
                }`}
            >
              {cancelLoading
                ? 'Processing…'
                : cancelAction === 'approve' ? 'Approve Cancellation' : 'Reject & Restore Event'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/admin/events')} className="btn-ghost p-2 flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{event.eventName}</h1>
              <StatusBadge status={event.status} />
              <MessagingSettingsPopover event={event} onToggle={toggleMessagingSetting} savingField={savingMessagingField} />
            </div>
            <p className="text-white/50 text-sm mt-0.5 truncate">
              {event.client?.name} · {formatDate(event.eventDate)} · {event.location}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-shrink-0 pl-[52px] sm:pl-0">
          {event.status === 'inquiry_received' && (<>
            <button onClick={() => askConfirm({
              title: 'Accept Inquiry?',
              message: `Accept the inquiry from ${event.client?.name} for "${event.eventName}"? You will then schedule a needs assessment meeting.`,
              type: 'success', confirmLabel: 'Yes, Accept',
              onConfirm: () => updateStatus('inquiry_accepted'),
            })} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">
              Accept
            </button>
            <button onClick={() => askConfirm({
              title: 'Decline Inquiry?',
              message: `Decline "${event.eventName}" from ${event.client?.name}?`,
              type: 'danger', confirmLabel: 'Yes, Decline',
              onConfirm: () => updateStatus('cancelled'),
            })} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30">
              Decline
            </button>
          </>)}

          {event.status === 'needs_assessed' && event.needsAssessment?.assessedAt && (
            <button onClick={() => navigate(`/admin/quotations/create/${event._id}`)} className="btn-primary text-sm">
              <FileText className="w-4 h-4" /> Create Quotation
            </button>
          )}

          {event.status === 'needs_assessed' && !event.needsAssessment?.assessedAt && (
            <button onClick={() => setTab('assessment')} className="btn-secondary text-sm">
              <FileText className="w-4 h-4" /> Fill Assessment First
            </button>
          )}

          {event.status === 'confirmed' && (
            <button onClick={() => askConfirm({
              title: 'Mark Downpayment as Paid?',
              message: 'Confirm that the 50% downpayment has been received from the client?',
              type: 'success', confirmLabel: 'Yes, Confirm Payment',
              onConfirm: () => updateStatus('downpayment_paid'),
            })} className="btn-primary text-sm">
              <CheckCircle className="w-4 h-4" /> Mark Downpayment Paid
            </button>
          )}

          {event.status === 'downpayment_paid' && (
            <button onClick={() => setTab('assignment')} className="btn-primary text-sm">
              <Users className="w-4 h-4" /> Assign Team
            </button>
          )}

          {event.status === 'downpayment_paid' && paymentSummary !== null && (paymentSummary?.totalPaid || 0) === 0 && (
            <button onClick={() => askConfirm({
              title: 'Undo Downpayment Mark?',
              message: 'No payment record exists for this event. This will revert the status back to "Confirmed" so the client can submit their actual payment. Continue?',
              type: 'warning', confirmLabel: 'Yes, Revert to Confirmed',
              onConfirm: () => updateStatus('confirmed'),
            })} className="flex items-center gap-1.5 px-3 py-2 bg-orange-500/15 border border-orange-500/30 text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-500/25 transition-colors">
              <AlertTriangle className="w-4 h-4" />
              Undo — No Payment Received
            </button>
          )}

          {event.status === 'assigned' && (
            <button onClick={() => askConfirm({
              title: 'Start Event?',
              message: 'Mark this event as In Progress?',
              type: 'info', confirmLabel: 'Yes, Start',
              onConfirm: () => updateStatus('in_progress'),
            })} className="btn-primary text-sm">
              Start Event
            </button>
          )}

          {event.status === 'in_progress' && (
            <button onClick={() => askConfirm({
              title: 'Complete Event?',
              message: 'Mark as completed pending balance? The client will be notified to pay the remaining amount.',
              type: 'success', confirmLabel: 'Yes, Complete',
              onConfirm: () => updateStatus('completed_pending_balance'),
            })} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">
              Complete Event
            </button>
          )}

          {event.status === 'completed_pending_balance' && (
            <button onClick={() => askConfirm({
              title: 'Mark as Fully Paid?',
              message: 'Confirm that the full balance has been received?',
              type: 'success', confirmLabel: 'Yes, Mark Paid',
              onConfirm: () => updateStatus('completed_paid'),
            })} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">
              Mark Fully Paid
            </button>
          )}

          {['completed_pending_balance', 'completed_paid'].includes(event.status) &&
           (event.assignedFreelancers || []).some(af => (af.equipment || []).length > 0) && (
            <button
              onClick={() => setShowDamageReport(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors">
              <AlertTriangle className="w-4 h-4" />
              Report Damage
            </button>
          )}

          {!isEnded && !isCancelPending && (
            <button
              onClick={() => askConfirm({
                title: 'Cancel This Event?',
                message: `Are you sure you want to cancel "${event.eventName}" for ${event.client?.name}? This cannot be undone and the client will be notified.`,
                type: 'danger', confirmLabel: 'Yes, Cancel Event',
                onConfirm: () => updateStatus('cancelled'),
              })}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-colors">
              <XCircle className="w-4 h-4" />
              Cancel Event
            </button>
          )}

          {isCancelPending && (<>
            <button
              onClick={() => openCancelResolution('reject')}
              className="px-3 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors">
              Reject Request
            </button>
            <button
              onClick={() => openCancelResolution('approve')}
              className="px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors">
              Approve Cancellation
            </button>
          </>)}
        </div>
      </div>

      {/* Client Feedback — surfaced right after the paid status, not buried below */}
      {event.status === 'completed_paid' && event.feedback?.rating && (
        <FeedbackBanner feedback={event.feedback} clientName={event.client?.name} />
      )}

      {/* Cancellation Request Banner */}
      {isCancelPending && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-orange-400 font-semibold">Cancellation Requested by Client</p>
              <p className="text-white/50 text-sm mt-0.5">
                <span className="text-white font-medium">{event.client?.name}</span> has requested to cancel this event.
                {event.cancellationRequest?.requestedAt && (
                  <span className="text-white/30 ml-1 text-xs">
                    · {new Date(event.cancellationRequest.requestedAt).toLocaleDateString('en-PH', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                )}
              </p>
              {event.cancellationRequest?.reason && (
                <p className="text-white/40 text-sm mt-2 italic">"{event.cancellationRequest.reason}"</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => openCancelResolution('reject')}
              className="flex-1 py-2 bg-white/5 border border-white/10 text-white/70 rounded-lg text-sm font-medium
                hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-400 transition-colors">
              Reject — Keep Event Active
            </button>
            <button onClick={() => openCancelResolution('approve')}
              className="flex-1 py-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-colors">
              Approve Cancellation
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px
              ${activeTab === t ? 'text-primary border-primary' : 'text-white/50 border-transparent hover:text-white'}`}>
            {t === 'assessment'   ? 'Assessment' :
             t === 'meeting'      ? 'Meeting Schedule' :
             t === 'assignment'   ? 'Team Assignment' :
             t === 'deliverables' ? 'Deliverables' :
             t === 'chat'         ? 'Chat' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Main content (left) + always-visible sidebar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 space-y-4">

      {/* ═══ OVERVIEW ═══ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title mb-4">Event Details</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Event Name', event.eventName],
                ['Client',     event.client?.name],
                ['Date',       formatDate(event.eventDate)],
                ['Category',   event.eventCategory === 'Others' && parsedCategory.categoryOther
                                 ? `Others — ${parsedCategory.categoryOther}`
                                 : (event.eventCategory || '—')],
                ['Location',   event.location],
                ['Attendees',  event.needsAssessment?.attendees || event.attendees || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-white/40 text-xs">{k}</dt>
                  <dd className="text-white font-medium mt-0.5">{v || '—'}</dd>
                </div>
              ))}
            </dl>

            {Object.values(services).some(Boolean) && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Requested Services</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(services).filter(([,v]) => v).map(([k]) => (
                    <span key={k} className="badge bg-blue-500/20 text-blue-300 text-xs">
                      {k === 'liveStreaming'        ? 'Multi-Camera Live Coverage'    :
                       k === 'documentation'        ? 'Digital Documentation'         :
                       k === 'weddingDebut'         ? 'Wedding / Debut / Birthday'    :
                       k === 'virtualLivestreaming' ? 'Remote & Virtual Livestreaming':
                       k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {parsedCategory.specialRequests && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Special Requests</p>
                <p className="text-white/70 text-sm">{parsedCategory.specialRequests}</p>
              </div>
            )}

            {event.meetingPreference?.type && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Client Meeting Preference</p>
                <div className="flex flex-wrap gap-3 text-xs text-white/60">
                  <span className="badge bg-white/10 text-white">
                    {event.meetingPreference.type === 'ftf' ? 'Face-to-Face' : 'Online Meeting'}
                  </span>
                  {event.meetingPreference.preferredDate && (
                    <span>{formatDate(event.meetingPreference.preferredDate)}
                      {event.meetingPreference.preferredTime ? ` at ${event.meetingPreference.preferredTime}` : ''}
                    </span>
                  )}
                  {event.meetingPreference.preferredLocation && (
                    <span>{event.meetingPreference.preferredLocation}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {['inquiry_accepted', 'meeting_scheduled'].includes(event.status) && (
            <MeetingScheduleCard event={event} onUpdate={fetchEvent} />
          )}

          <ProjectTimeline event={event} />
        </div>
      )}

      {/* ═══ MEETING TAB ═══ */}
      {activeTab === 'meeting' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-400 font-semibold text-sm">Schedule the Needs Assessment Meeting</p>
            <p className="text-blue-400/70 text-xs mt-1">
              Review the client's preferred schedule and confirm the meeting details.
              Once confirmed, the client will be notified. After the meeting, click Mark as Done to unlock the Assessment tab.
            </p>
          </div>
          <MeetingScheduleCard event={event} onUpdate={fetchEvent} />
        </div>
      )}

      {/* ═══ ASSESSMENT TAB ═══ */}
      {activeTab === 'assessment' && (
        <div className="space-y-4">
          {event.status === 'needs_assessed' && !event.needsAssessment?.assessedAt && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
              <p className="text-primary font-semibold text-sm">Fill in the Needs Assessment</p>
              <p className="text-white/50 text-xs mt-1">
                Record what was discussed in the meeting — select the exact packages agreed with the client.
                These will automatically fill the quotation. The quotation button only appears after you save this assessment.
              </p>
            </div>
          )}
          {event.needsAssessment?.assessedAt && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-green-400 font-semibold text-sm">Assessment Saved</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {event.needsAssessment.selectedPackages?.length || 0} package(s) selected — will auto-fill the quotation.
                </p>
              </div>
              {event.status === 'needs_assessed' && (
                <button onClick={() => navigate(`/admin/quotations/create/${event._id}`)}
                  className="btn-primary text-sm flex-shrink-0 self-start sm:self-auto">
                  <FileText className="w-4 h-4" /> Create Quotation
                </button>
              )}
            </div>
          )}
          <AssessmentTab event={event} saving={saving} onSave={saveAssessment} />
        </div>
      )}

      {/* ═══ ASSIGNMENT TAB ═══ */}
      {activeTab === 'assignment' && (
        <div className="space-y-4">

          {/* Freelancer Check-In Status */}
          {['in_progress', 'completed_pending_balance', 'completed_paid'].includes(event.status) &&
           (event.assignedFreelancers || []).length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title">Check-In Status</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                  ${(event.attendance || []).filter(a => a.checkedIn).length === event.assignedFreelancers.length
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-orange-500/20 text-orange-400'}`}>
                  {(event.attendance || []).filter(a => a.checkedIn).length} / {event.assignedFreelancers.length} present
                </span>
              </div>

              <div className="space-y-2">
                {event.assignedFreelancers.map((af, i) => {
                  const fId = af.freelancer?._id?.toString() || af.freelancer?.toString();
                  const att = (event.attendance || []).find(
                    a => (a.freelancer?._id?.toString() || a.freelancer?.toString()) === fId
                  );
                  const checked = att?.checkedIn || false;
                  return (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border
                      ${checked ? 'bg-green-500/5 border-green-500/20' : 'bg-orange-500/5 border-orange-500/10'}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                        ${checked ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/15 text-orange-400'}`}>
                        {(af.freelancer?.name || '?')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{af.freelancer?.name}</p>
                        <p className="text-white/40 text-xs">{af.role || 'No role assigned'}</p>
                        {checked && att?.checkInTime && (
                          <p className="text-green-400/70 text-xs mt-0.5 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {new Date(att.checkInTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' at '}
                            {new Date(att.checkInTime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>

                      {/* ── Proof photo thumbnails (multiple) ───────────────── */}
                      {checked && att?.proofPhotos?.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {att.proofPhotos.map((photo, photoIdx) => (
                            <button
                              key={photoIdx}
                              onClick={() => { setLightboxPhotos(att.proofPhotos); setLightboxIndex(photoIdx); }}
                              className="group relative flex-shrink-0"
                              title={`View proof photo ${photoIdx + 1}`}
                            >
                              <img
                                src={`${API_ORIGIN}${photo}`}
                                alt={`Check-in proof ${photoIdx + 1}`}
                                className="w-10 h-10 rounded-lg object-cover border border-white/20 group-hover:border-primary/60 transition-colors"
                              />
                              <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-[9px] font-semibold">VIEW</span>
                              </div>
                              {att.proofPhotos.length > 1 && photoIdx === 0 && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                  {att.proofPhotos.length}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {checked && (!att?.proofPhotos || att.proofPhotos.length === 0) && (
                        <span className="text-white/20 text-xs flex-shrink-0 italic">no photo</span>
                      )}

                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0
                        ${checked ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/15 text-orange-400'}`}>
                        {checked ? <><CheckCircle className="w-3 h-3" /> Checked In</> : 'Not Yet'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{
                      width: event.assignedFreelancers.length
                        ? `${((event.attendance || []).filter(a => a.checkedIn).length / event.assignedFreelancers.length) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {paymentSummary && paymentSummary.totalAmount > 0 &&
           (paymentSummary.totalPaid || 0) < (paymentSummary.totalAmount * 0.5) && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-semibold text-sm">No Downpayment Received</p>
                <p className="text-yellow-400/70 text-xs mt-1">
                  The 50% downpayment of {formatCurrency((paymentSummary.totalAmount || 0) * 0.5)} has not been received yet.
                  Paid so far: {formatCurrency(paymentSummary.totalPaid || 0)}.
                  You can still assign the team but it is recommended to wait for the downpayment first.
                </p>
              </div>
            </div>
          )}

          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/50 text-xs">
            Click a freelancer to add them, set their role, then pick the equipment they will use. For multi-unit equipment, click to expand and select individual units.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Available freelancers */}
            <div className="card">
              <h3 className="section-title mb-3">Available Freelancers</h3>
              <div className="space-y-2">
                {freelancers.filter(fr => (fr.availability || 'available') === 'available').map(fr => (
                  <button key={fr._id} onClick={() => addFreelancer(fr)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 transition-all text-left">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                      {fr.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{fr.name}</p>
                      <p className="text-white/40 text-xs">{(fr.skills || []).slice(0, 2).join(', ') || 'No skills listed'}</p>
                    </div>
                    <Plus className="w-4 h-4 text-white/30 flex-shrink-0" />
                  </button>
                ))}
                {freelancers.filter(fr => (fr.availability || 'available') === 'available').length === 0 && (
                  <p className="text-white/30 text-sm text-center py-4">No available freelancers</p>
                )}
              </div>
            </div>

            {/* Team being built */}
            <div className="card">
              <h3 className="section-title mb-3">Team ({assignedFreelancers.length})</h3>
              {assignedFreelancers.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">No team members yet</p>
              ) : (
                <div className="space-y-3">
                  {assignedFreelancers.map(af => {
                    const frInfo = freelancers.find(f => f._id === af.freelancer);
                    const isOpen = expandedFr === af.freelancer;
                    return (
                      <div key={af.freelancer} className="border border-white/10 rounded-xl overflow-hidden">
                        {/* Freelancer header */}
                        <div className="flex items-center gap-3 p-3 bg-white/5">
                          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                            {(frInfo?.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm">{frInfo?.name}</p>
                            <p className="text-white/40 text-xs">
                              {af.equipment.length === 0
                                ? 'No equipment assigned'
                                : `${af.equipment.reduce((s, e) => s + (e.quantity || 1), 0)} unit(s) across ${af.equipment.length} item(s)`}
                            </p>
                          </div>
                          <button onClick={() => setExpandedFr(isOpen ? null : af.freelancer)} className="btn-ghost p-1">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <button onClick={() => removeFreelancer(af.freelancer)} className="text-white/20 hover:text-red-400 p-1">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Expanded panel */}
                        {isOpen && (
                          <div className="p-3 border-t border-white/10 space-y-3">
                            {/* Role */}
                            <div>
                              <label className="label">Role / Position</label>
                              <select className="input text-sm" value={af.role} onChange={e => setRole(af.freelancer, e.target.value)}>
                                <option value="">Select role...</option>
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>

                            {/* Equipment picker */}
                            <div>
                              <label className="label">Equipment Assigned</label>
                              <div className="max-h-72 overflow-y-auto border border-white/10 rounded-xl divide-y divide-white/5">
                                {equipment.map(eq => {
                                  const assigned       = af.equipment.find(e => e.equipment === eq._id);
                                  const totalUnits     = eq.quantity || 1;
                                  const isMulti        = totalUnits > 1;
                                  const isEqExpanded   = expandedEqItems.has(eq._id);
                                  const selectedIndices = assigned?.unitIndices || [];

                                  // Resolve per-unit arrays (fall back to global values)
                                  const unitConds  = eq.unitConditions?.length  === totalUnits ? eq.unitConditions  : Array(totalUnits).fill(eq.condition    || 'good');
                                  const unitAvails = eq.unitAvailabilities?.length === totalUnits ? eq.unitAvailabilities : Array(totalUnits).fill(eq.availability || 'available');
                                  const unitSerials = eq.serialNumbers || [];

                                  // Single-unit: block assignment when condition is needs_repair
                                  const isSingleNeedsRepair = !isMulti && unitConds[0] === 'needs_repair';

                                  return (
                                    <div key={eq._id}>
                                      {/* ── Main equipment row ── */}
                                      <div
                                        onClick={() => {
                                          if (isMulti) { toggleEqExpand(eq._id); return; }
                                          if (isSingleNeedsRepair) return;
                                          toggleEquip(af.freelancer, eq._id);
                                        }}
                                        className={`flex items-center gap-2 p-2.5 transition-all
                                          ${isSingleNeedsRepair
                                            ? 'opacity-40 cursor-not-allowed'
                                            : 'cursor-pointer'}
                                          ${assigned
                                            ? 'bg-primary/15'
                                            : !isSingleNeedsRepair ? 'hover:bg-white/5' : ''}
                                          ${isMulti && isEqExpanded ? '' : ''}`}>

                                        {isMulti ? (
                                          /* Chevron for multi-unit */
                                          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200
                                            ${isEqExpanded ? 'rotate-0 text-primary' : '-rotate-90 text-white/30'}`} />
                                        ) : (
                                          /* Checkbox for single unit */
                                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                            ${assigned ? 'border-primary bg-primary' : 'border-white/30'}`}>
                                            {assigned && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                                          </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                          <p className={`text-xs font-medium ${assigned ? 'text-white' : 'text-white/60'}`}>
                                            {eq.name}
                                          </p>
                                          <p className="text-white/30 text-[10px] capitalize">{eq.category}</p>
                                        </div>

                                        {/* Needs-repair warning badge for single-unit items */}
                                        {isSingleNeedsRepair && (
                                          <span className="badge text-[9px] bg-red-500/20 text-red-400 flex-shrink-0">
                                            Needs Repair
                                          </span>
                                        )}

                                        {isMulti ? (
                                          /* "X/N" counter for multi-unit */
                                          <span className={`text-xs font-mono flex-shrink-0 px-1.5 py-0.5 rounded-md
                                            ${assigned
                                              ? 'bg-primary/20 text-primary font-bold'
                                              : 'bg-white/5 text-white/30'}`}>
                                            {selectedIndices.length}/{totalUnits}
                                          </span>
                                        ) : (
                                          assigned && <span className="text-primary text-xs flex-shrink-0">✓</span>
                                        )}
                                      </div>

                                      {/* ── Per-unit sub-rows (only for multi-unit when expanded) ── */}
                                      {isMulti && isEqExpanded && (
                                        <div className="bg-white/[0.02] border-t border-white/5">
                                          {Array.from({ length: totalUnits }, (_, i) => {
                                            const serial      = unitSerials[i] || null;
                                            const cond        = unitConds[i]   || 'good';
                                            const avail       = unitAvails[i]  || 'available';
                                            const isSelected  = selectedIndices.includes(i);
                                            const isUnavail   = avail !== 'available';
                                            const isNeedsRepair = cond === 'needs_repair';
                                            const isDisabled  = isUnavail || isNeedsRepair;

                                            return (
                                              <div
                                                key={i}
                                                onClick={() => !isDisabled && toggleUnit(af.freelancer, eq._id, i)}
                                                className={`flex items-center gap-2 pl-8 pr-2.5 py-2 text-xs border-b border-white/5 last:border-0 transition-all
                                                  ${isDisabled
                                                    ? 'opacity-40 cursor-not-allowed'
                                                    : isSelected
                                                      ? 'bg-primary/10 cursor-pointer'
                                                      : 'hover:bg-white/5 cursor-pointer'}`}>

                                                {/* Checkbox */}
                                                <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                                  ${isSelected ? 'border-primary bg-primary' : isDisabled ? 'border-white/15' : 'border-white/30'}`}>
                                                  {isSelected && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
                                                </div>

                                                {/* Unit number */}
                                                <span className="text-white/35 font-mono w-6 flex-shrink-0">#{i + 1}</span>

                                                {/* Serial */}
                                                {serial
                                                  ? <span className={`font-mono flex-1 truncate ${isSelected ? 'text-white/80' : 'text-white/40'}`}>{serial}</span>
                                                  : <span className="text-white/20 italic flex-1">no serial</span>}

                                                {/* Condition badge */}
                                                <span className={`badge text-[9px] capitalize flex-shrink-0 ${CONDITION_COLORS[cond] || 'bg-gray-500/20 text-gray-400'}`}>
                                                  {cond.replace('_', ' ')}
                                                </span>

                                                {/* Availability badge */}
                                                <span className={`badge text-[9px] capitalize flex-shrink-0 ${AVAIL_COLORS[avail] || 'bg-gray-500/20 text-gray-400'}`}>
                                                  {avail.replace('_', ' ')}
                                                </span>
                                              </div>
                                            );
                                          })}

                                          {/* "Deselect all" shortcut if any are selected */}
                                          {selectedIndices.length > 0 && (
                                            <div className="pl-8 pr-2.5 py-1.5 border-t border-white/5">
                                              <button
                                                className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // Remove entire equipment entry to deselect all
                                                  setAssignedFreelancers(prev => prev.map(a =>
                                                    a.freelancer !== af.freelancer ? a
                                                    : { ...a, equipment: a.equipment.filter(e => e.equipment !== eq._id) }
                                                  ));
                                                }}>
                                                Clear selection ({selectedIndices.length} selected)
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {assignedFreelancers.length > 0 && (
            <button onClick={saveAssignment} disabled={saving} className="btn-primary w-full justify-center py-3">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : `Save Assignment (${assignedFreelancers.length} member${assignedFreelancers.length !== 1 ? 's' : ''})`}
            </button>
          )}
        </div>
      )}

      {/* ═══ DELIVERABLES TAB ═══ */}
      {activeTab === 'deliverables' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title mb-3">Add Deliverable</h3>
            <p className="text-white/40 text-xs mb-4">
              Paste a link to the finished video or photo set (e.g. Google Drive, Dropbox, or your CDN).
              The client will be notified automatically and can view it from their event page.
            </p>
            <form onSubmit={addDeliverable} className="flex flex-col sm:flex-row gap-3">
              <select
                className="input sm:w-40"
                value={deliverableForm.type}
                onChange={e => setDeliverableForm(f => ({ ...f, type: e.target.value }))}
              >
                <option value="video">Video</option>
                <option value="photo">Photo</option>
              </select>
              <input
                type="url"
                required
                className="input flex-1"
                placeholder="https://drive.google.com/..."
                value={deliverableForm.url}
                onChange={e => setDeliverableForm(f => ({ ...f, url: e.target.value }))}
              />
              <button type="submit" disabled={addingDeliverable} className="btn-primary sm:w-auto justify-center">
                <Plus className="w-4 h-4" />
                {addingDeliverable ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3 className="section-title mb-3">
              Uploaded Deliverables {event.deliverables?.length > 0 && `(${event.deliverables.length})`}
            </h3>
            {(event.deliverables?.length || 0) === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No deliverables added yet.</p>
            ) : (
              <div className="space-y-2">
                {event.deliverables.map((d, i) => (
                  <a key={i} href={d.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-primary/30 transition-colors">
                    <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      {d.type === 'photo' ? <Paperclip className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm capitalize">{d.type}</p>
                      <p className="text-white/40 text-xs truncate">{d.url}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat tab removed — comments now live permanently in the sidebar CommentsCard */}

      </div>

      {/* Sidebar — always visible regardless of active tab */}
      <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4">
        <AssignedStaffCard event={event} />
        <EquipmentOverviewCard event={event} />
        <CommentsCard event={event} onSend={sendComment} myRole="admin" locked={event.status === 'completed_paid'} />
      </div>

      </div>

      {/* Floating Direct Messages popup */}
      <DirectMessagesPopup event={event} onSend={sendMessage} myRole="admin" locked={event.status === 'completed_paid'} />

      {/* Payment warning modal */}
      <Modal isOpen={showPayWarn} onClose={() => setShowPayWarn(false)} title="No Downpayment Received">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-semibold text-sm">50% Downpayment Not Yet Received</p>
              <p className="text-yellow-400/70 text-xs mt-1">
                The required downpayment of {formatCurrency((paymentSummary?.totalAmount || 0) * 0.5)} has not been received.
                It is recommended to wait for payment confirmation before assigning the team.
              </p>
              <p className="text-white/50 text-xs mt-2">
                Paid so far: {formatCurrency(paymentSummary?.totalPaid || 0)} of {formatCurrency(paymentSummary?.totalAmount || 0)}
              </p>
            </div>
          </div>
          <p className="text-white/60 text-sm">Would you still like to proceed with the assignment?</p>
          <div className="flex gap-3">
            <button onClick={() => setShowPayWarn(false)} className="btn-secondary flex-1 justify-center">
              Cancel — Wait for Payment
            </button>
            <button onClick={doSaveAssignment} disabled={saving}
              className="flex-1 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              {saving ? 'Saving...' : 'Proceed Anyway'}
            </button>
          </div>
        </div>
      </Modal>

      {showDamageReport && event && (
        <DamageReportModal
          event={event}
          onClose={() => setShowDamageReport(false)}
          onSubmitted={fetchEvent}
        />
      )}

      <ConfirmDialog
        isOpen={confirm.open} onClose={closeConfirm} onConfirm={runConfirm}
        title={confirm.title} message={confirm.message} type={confirm.type}
        confirmLabel={confirm.confirmLabel} loading={confirm.loading}
      />

      {/* ── Check-in proof photo lightbox (multi-photo) ──────────────────── */}
      {lightboxPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxPhotos([])}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold">
                Check-In Proof Photo
                {lightboxPhotos.length > 1 && (
                  <span className="text-white/40 font-normal ml-2 text-sm">
                    {lightboxIndex + 1} / {lightboxPhotos.length}
                  </span>
                )}
              </p>
              <button onClick={() => setLightboxPhotos([])} className="text-white/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <img
              src={`${API_ORIGIN}${lightboxPhotos[lightboxIndex]}`}
              alt={`Check-in proof ${lightboxIndex + 1}`}
              className="w-full rounded-2xl border border-white/10 object-contain max-h-[70vh]"
            />

            {/* Prev / Next arrows */}
            {lightboxPhotos.length > 1 && (
              <div className="flex justify-between mt-3">
                <button
                  onClick={() => setLightboxIndex(i => (i - 1 + lightboxPhotos.length) % lightboxPhotos.length)}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 text-sm transition-colors"
                >
                  ← Prev
                </button>
                {/* Dot indicators */}
                <div className="flex items-center gap-1.5">
                  {lightboxPhotos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === lightboxIndex ? 'bg-white' : 'bg-white/30'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setLightboxIndex(i => (i + 1) % lightboxPhotos.length)}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 text-sm transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}