import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Send, Package, Plus, Clock, X, Wrench, RefreshCw, User, Camera, Users, MessageSquare, Paperclip } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, StatusBadge, Modal } from '../../components/shared';
import ProjectTimeline from '../../components/ProjectTimeline';
import { formatDate, formatDateTime } from '../../utils/helpers';
import useAuthStore from '../../store/authStore';
import { getSocket } from '../../services/socket';
import toast from 'react-hot-toast';

// ── Derive the backend origin from the axios base URL so that relative
//    upload paths (e.g. /uploads/messages/file.jpg) resolve correctly
//    instead of hitting the React dev-server.
const API_ORIGIN = (api.defaults.baseURL || '').replace(/\/api.*$/, '');

// Statuses where equipment is no longer relevant (project over)
const COMPLETED_STATUSES = ['completed_paid', 'completed_pending_balance', 'cancelled'];

// ── Sidebar: Assigned Staff (whole team, "You" highlighted) ───────────────────
function AssignedStaffCard({ event, myId }) {
  const team = event.assignedFreelancers || [];
  const showAttend = ['in_progress', 'completed_pending_balance', 'completed_paid'].includes(event.status);
  const checkedInCount = (event.attendance || []).filter(a => a.checkedIn).length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Team
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
            const fId  = String(af.freelancer?._id || af.freelancer || '');
            const isMe = fId === myId;
            const att  = (event.attendance || []).find(a => String(a.freelancer?._id || a.freelancer || '') === fId);
            const checked = att?.checkedIn || false;
            return (
              <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm transition-colors
                ${isMe
                  ? 'bg-primary/10 border-primary/25'
                  : showAttend
                    ? checked ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/5'
                    : 'bg-white/5 border-white/5'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${showAttend && checked ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'}`}>
                  {(af.freelancer?.name || '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{af.freelancer?.name}{isMe ? ' (You)' : ''}</p>
                  <p className="text-white/40 text-xs truncate">{af.role || 'Crew'}</p>
                </div>
                {showAttend && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0
                    ${checked ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                    {checked ? 'In' : 'Not yet'}
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

// ── Sidebar: Equipment Overview (aggregated across the whole team) ────────────
function EquipmentOverviewCard({ event }) {
  const team = event.assignedFreelancers || [];
  const itemMap = {};

  team.forEach(af => {
    (af.equipment || []).forEach(eq => {
      const item = eq.equipment;
      const key  = typeof item === 'object' && item !== null ? String(item._id) : String(item || '');
      const name = typeof item === 'object' && item !== null ? item.name : 'Equipment';
      if (!key) return;
      if (!itemMap[key]) itemMap[key] = { name: name || 'Equipment', qty: 0, holders: [] };
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
// (client, admin, every assigned freelancer — including other freelancers).
// Uses sender id rather than role for the "You" badge, since more than one
// freelancer can post here. ───────────────────────────────────────────────
function CommentsCard({ event, onSend, myId, locked }) {
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
          const isMe = String(msg.sender?._id || msg.sender || '') === myId;
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

// ── Floating Direct Messages popup — private threads with Admin and with the
// Client separately. Click the floating icon to open; tabs only appear when
// there's more than one thread. ─────────────────────────────────────────────
function DirectMessagesPopup({ event, onSend, myRole, myId, locked }) {
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

  const isMineFn = (msg, t) => t.threadType === 'teammate'
    ? String(msg.sender?._id || msg.sender || '') === myId
    : msg.senderRole === myRole;

  // Persisted "seen" tracking — survives reloads and correctly treats any
  // thread never opened before as fully unread (instead of assuming
  // whatever's already there at page-load is "seen"). Keyed by myId too,
  // since multiple freelancers may share a device/browser.
  const storageKey = (t) =>
    `dm_seen_${event._id || 'ev'}_${myId || 'anon'}_${t.threadType || 'default'}_${t.freelancerId || t.label || 'x'}`;

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
    return msgs.slice(seen).filter(m => !isMineFn(m, t)).length;
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
                  const isMe = active?.threadType === 'teammate'
                    ? String(msg.sender?._id || msg.sender || '') === myId
                    : msg.senderRole === myRole;
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

export default function FreelancerEventDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();

  const [event,         setEvent]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('overview');
  const [checkingIn,    setCheckingIn]    = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInPhotos, setCheckInPhotos] = useState([]);
  const [dbEquipment,   setDbEquipment]   = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [showReqModal,  setShowReqModal]  = useState(false);
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqForm,       setReqForm]       = useState({ equipmentId: '', customName: '', useCustom: false, quantity: 1, reason: '' });

  const socket = getSocket();
  const myId   = String(user?._id || '');

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${id}`);
      setEvent(data.event);
    } finally { setLoading(false); }
  }, [id]);

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await api.get(`/equipment-requests?eventId=${id}`);
      setRequests(data.requests || []);
    } catch {}
  }, [id]);

  const fetchDbEquipment = useCallback(async () => {
    try {
      const { data } = await api.get('/equipment');
      // Load ALL equipment — show availability badge, disable unavailable ones
      setDbEquipment(data.equipment || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchEvent();
    fetchRequests();
    fetchDbEquipment();
    if (socket) {
      socket.emit('join_event', id);
      socket.on('new_message', fetchEvent);
      return () => { socket.off('new_message', fetchEvent); socket.emit('leave_event', id); };
    }
  }, [id]);

  const checkIn = async () => {
    if (checkInPhotos.length === 0) {
      toast.error('Please attach at least one photo as proof of attendance');
      return;
    }
    setCheckingIn(true);
    try {
      const fd = new FormData();
      checkInPhotos.forEach(photo => fd.append('proofPhotos', photo));
      await api.post(`/events/${id}/checkin`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Checked in successfully!');
      setShowCheckInModal(false);
      setCheckInPhotos([]);
      fetchEvent();
    } catch (err) {
      console.error('Check-in Error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || err.message || 'Failed to check in');
    } finally {
      setCheckingIn(false);
    }
  };
  const sendComment = async (content) => {
    try {
      await api.post(`/events/${id}/comments`, { content });
      fetchEvent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post comment');
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

  const submitRequest = async (e) => {
    e.preventDefault();
    const selectedEq = dbEquipment.find(eq => eq._id === reqForm.equipmentId);
    const itemName   = reqForm.useCustom ? reqForm.customName : selectedEq?.name;
    if (!itemName?.trim()) { toast.error('Please select or enter equipment'); return; }
    setSubmittingReq(true);
    try {
      await api.post('/equipment-requests', { eventId: id, equipment: reqForm.useCustom ? undefined : reqForm.equipmentId, itemName, quantity: reqForm.quantity, reason: reqForm.reason });
      toast.success('Request submitted!');
      setShowReqModal(false);
      setReqForm({ equipmentId: '', customName: '', useCustom: false, quantity: 1, reason: '' });
      fetchRequests();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmittingReq(false); }
  };

  const deleteRequest = async (reqId) => {
    try {
      await api.delete(`/equipment-requests/${reqId}`);
      toast.success('Request cancelled');
      fetchRequests();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <LoadingSpinner />;
  if (!event)  return <div className="text-white/50 p-8">Project not found</div>;

  const myAssignment = (event.assignedFreelancers || []).find(af => {
    const fId = String(af.freelancer?._id || af.freelancer || '');
    return fId === myId;
  });
  const myRole      = myAssignment?.role || '';
  const myAttendance = (event.attendance || []).find(a => {
    return String(a.freelancer?._id || a.freelancer || '') === myId;
  });

  // ── COMPLETED: clear equipment from view ─────────────────────────────────
  const isCompleted = COMPLETED_STATUSES.includes(event.status);
  // Only show equipment if NOT completed
  const myEquipment = isCompleted ? [] : (myAssignment?.equipment || []);

  // Tabs — hide "my equipment" and "requests" for completed projects
  const TABS = isCompleted
    ? ['overview']
    : ['overview', 'my equipment', 'requests'];

  const statusColors = {
    pending:  'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-green-500/20  text-green-400',
    rejected: 'bg-red-500/20    text-red-400',
  };
  const availColors = {
    available:   'bg-green-500/20  text-green-400',
    in_use:      'bg-blue-500/20   text-blue-400',
    maintenance: 'bg-yellow-500/20 text-yellow-400',
    retired:     'bg-red-500/20    text-red-400',
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/freelancer/events')} className="btn-ghost p-2 flex-shrink-0"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title min-w-0 break-words">{event.eventName}</h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-white/50 text-sm mt-0.5 truncate">{formatDate(event.eventDate)} · {event.location}</p>
          {myRole && <span className="badge bg-primary/20 text-primary mt-1 inline-block">Your Role: {myRole}</span>}
        </div>
      </div>

      {/* Completed banner */}
      {isCompleted && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <p className="text-green-400 font-semibold">
            {event.status === 'cancelled' ? ' Project Cancelled' : ' Project Completed'}
          </p>
          <p className="text-white/50 text-sm mt-0.5">
            {event.status === 'cancelled'
              ? 'This project was cancelled. Equipment has been returned.'
              : 'Great work! This project has been completed. Equipment has been returned to inventory.'}
          </p>
        </div>
      )}

      {/* Check-in banner */}
      {event.status === 'in_progress' && (
        <div className={`card border ${myAttendance?.checkedIn ? 'border-green-500/30 bg-green-500/10' : 'border-primary/30 bg-primary/10'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`font-semibold ${myAttendance?.checkedIn ? 'text-green-400' : 'text-white'}`}>
                {myAttendance?.checkedIn ? " You're checked in" : '📍 Check-in required'}
              </p>
              {myAttendance?.checkInTime && <p className="text-white/40 text-xs mt-0.5">At {formatDateTime(myAttendance.checkInTime)}</p>}
            </div>
            {!myAttendance?.checkedIn && (
              <button onClick={() => setShowCheckInModal(true)} disabled={checkingIn} className="btn-primary self-start sm:self-auto">
                <CheckCircle className="w-4 h-4" />
                Check In Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px
              ${tab === t ? 'text-primary border-primary' : 'text-white/50 border-transparent hover:text-white'}`}>
            {t === 'my equipment' ? (
              <span className="flex items-center gap-1.5">
                My Equipment
                {myEquipment.length > 0 && (
                  <span className="w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">{myEquipment.length}</span>
                )}
              </span>
            ) : t === 'requests' ? (
              <span className="flex items-center gap-1.5">
                Requests
                {requests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="w-4 h-4 bg-yellow-500 text-black text-xs rounded-full flex items-center justify-center font-bold">{requests.filter(r => r.status === 'pending').length}</span>
                )}
              </span>
            ) : t}
          </button>
        ))}
      </div>

      {/* Main content (left) + always-visible sidebar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 space-y-4">

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title mb-3">Project Info</h3>
            <dl className="space-y-2">
              {[['Date', formatDate(event.eventDate)], ['Location', event.location], ['Attendees', event.attendees || 'TBD'], ['Type', event.videoType || '—']].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <dt className="text-white/50">{k}</dt>
                  <dd className="text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ProjectTimeline event={event} />
        </div>
      )}

      {/* MY EQUIPMENT */}
      {tab === 'my equipment' && !isCompleted && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="section-title">Equipment Assigned to You</h3>
                <p className="text-white/40 text-xs mt-0.5">Items assigned for your use on this project</p>
              </div>
              <button onClick={() => setShowReqModal(true)} className="btn-secondary text-sm self-start sm:self-auto flex-shrink-0">
                <RefreshCw className="w-3.5 h-3.5" /> Request Update
              </button>
            </div>

            {myEquipment.length === 0 ? (
              <div className="text-center py-10">
                <Package className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/50 font-medium">No equipment assigned yet</p>
                <p className="text-white/30 text-sm mt-1">Admin will assign equipment before the project starts</p>
                <button onClick={() => setShowReqModal(true)} className="btn-primary text-sm mt-4">
                  <Plus className="w-4 h-4" /> Request Equipment
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myEquipment.map((item, i) => {
                  const eq    = typeof item.equipment === 'object' && item.equipment !== null ? item.equipment : null;
                  const name  = eq?.name  || String(item.equipment || 'Equipment');
                  const cat   = eq?.category   || '';
                  const cond  = eq?.condition   || '';
                  const avail = eq?.availability || 'available';
                  return (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-colors">
                      <div className="w-11 h-11 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold">{name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {cat  && <span className="badge bg-blue-500/10 text-blue-300 text-xs capitalize">{cat}</span>}
                          {cond && <span className="text-white/40 text-xs capitalize">{cond.replace(/_/g,' ')}</span>}
                          <span className={`badge text-xs capitalize ${availColors[avail] || 'bg-gray-500/20 text-gray-400'}`}>{avail.replace(/_/g,' ')}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white/40 text-xs">Qty</p>
                        <p className="text-white font-black text-2xl leading-none">{item.quantity}</p>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setShowReqModal(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/20 rounded-xl text-white/40 hover:text-white hover:border-white/40 transition-colors text-sm mt-2">
                  <RefreshCw className="w-4 h-4" /> Request Equipment Update
                </button>
              </div>
            )}
          </div>

          {/* Other team members' equipment */}
          {(event.assignedFreelancers || []).some(af => {
            const fId = String(af.freelancer?._id || af.freelancer || '');
            return fId !== myId && (af.equipment || []).length > 0;
          }) && (
            <div className="card">
              <h3 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Other Team Members' Equipment
              </h3>
              {(event.assignedFreelancers || [])
                .filter(af => String(af.freelancer?._id || af.freelancer || '') !== myId && (af.equipment || []).length > 0)
                .map((af, i) => (
                  <div key={i} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs text-white/50">
                        {(af.freelancer?.name || '?')[0]}
                      </div>
                      <span className="text-white/50 text-sm">{af.freelancer?.name} — <span className="text-white/30">{af.role}</span></span>
                    </div>
                    <div className="space-y-1 pl-8">
                      {(af.equipment || []).map((item, j) => {
                        const name = typeof item.equipment === 'object' ? item.equipment?.name : 'Equipment';
                        return (
                          <div key={j} className="flex items-center justify-between text-sm p-2 bg-white/5 rounded-lg">
                            <span className="text-white/60 flex items-center gap-1.5"><Wrench className="w-3 h-3 text-white/20" />{name}</span>
                            <span className="text-white/40 text-xs">×{item.quantity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* REQUESTS */}
      {tab === 'requests' && !isCompleted && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="section-title">Equipment Requests</h3>
              <p className="text-white/40 text-xs mt-0.5">Request additional or replacement equipment</p>
            </div>
            <button onClick={() => setShowReqModal(true)} className="btn-primary text-sm self-start sm:self-auto flex-shrink-0">
              <Plus className="w-4 h-4" /> New Request
            </button>
          </div>
          {requests.length === 0 ? (
            <div className="card text-center py-10">
              <Package className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/50">No requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req._id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${req.status === 'approved' ? 'bg-green-500/20' : req.status === 'rejected' ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                        <Package className={`w-4 h-4 ${req.status === 'approved' ? 'text-green-400' : req.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{req.itemName}</p>
                        <p className="text-white/50 text-sm">Qty: {req.quantity}</p>
                        {req.reason && <p className="text-white/40 text-xs mt-1 italic truncate">"{req.reason}"</p>}
                        {req.adminNote && (
                          <p className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${req.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            Admin: {req.adminNote}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`badge ${statusColors[req.status]}`}>
                        {req.status === 'pending' && <Clock className="w-3 h-3 mr-1 inline" />}{req.status}
                      </span>
                      {req.status === 'pending' && (
                        <button onClick={() => deleteRequest(req._id)} className="text-white/20 hover:text-red-400 p-1"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CHECKLIST */}
      {tab === 'checklist' && (
        <div className="card">
          <h3 className="section-title mb-4">Pre-Event Checklist</h3>
          <div className="space-y-2">
            {(event.preEventChecklist || []).length === 0 && <p className="text-white/40 text-sm text-center py-6">No checklist items yet</p>}
            {(event.preEventChecklist || []).map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${item.completed ? 'border-green-500/20 bg-green-500/5' : 'border-white/10 bg-white/5'}`}>
                <input type="checkbox" checked={item.completed} readOnly className="w-4 h-4 accent-primary" />
                <span className={`text-sm ${item.completed ? 'text-white/50 line-through' : 'text-white'}`}>{item.item}</span>
                {item.completed && <span className="ml-auto text-green-400 text-xs">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHAT tab removed — comments now live in the sidebar CommentsCard */}

      </div>

      {/* Sidebar — always visible regardless of active tab */}
      <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4">
        <AssignedStaffCard event={event} myId={myId} />
        {!isCompleted && <EquipmentOverviewCard event={event} />}
        <CommentsCard event={event} onSend={sendComment} myId={myId} locked={event.status === 'completed_paid'} />
      </div>

      </div>

      {/* Floating Direct Messages popup */}
      <DirectMessagesPopup event={event} onSend={sendMessage} myRole="freelancer" myId={myId} locked={event.status === 'completed_paid'} />

      {/* ── Check-in Photo Modal ─────────────────────────────────────────── */}
      <Modal isOpen={showCheckInModal} onClose={() => { setShowCheckInModal(false); setCheckInPhotos([]); }} title="Check-In Verification">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Please attach a photo as proof that you are on-site. This will be visible to the admin.
          </p>

          {/* Photo upload */}
          <div>
            <label className="label">
              Proof Photos <span className="text-red-400">*</span>
              <span className="text-white/30 font-normal ml-1">(up to 5 photos)</span>
            </label>

            {/* Existing previews */}
            {checkInPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {checkInPhotos.map((photo, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Check-in proof ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => setCheckInPhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-red-400 hover:bg-black/80 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-1 left-1 text-white/50 text-xs bg-black/50 px-1 rounded">
                      {(photo.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add photo button — hidden once 5 reached */}
            {checkInPhotos.length < 5 && (
              <label className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                ${checkInPhotos.length > 0 ? 'border-primary/40 bg-primary/5 hover:border-primary/60' : 'border-white/20 hover:border-white/40'}`}>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white/40" />
                </div>
                <div className="text-center">
                  <p className="text-white/60 text-sm font-medium">
                    {checkInPhotos.length === 0 ? 'Take a photo or upload one' : 'Add another photo'}
                  </p>
                  <p className="text-white/30 text-xs mt-0.5">
                    JPG, PNG — max 10MB · {5 - checkInPhotos.length} remaining
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) setCheckInPhotos(prev => [...prev, file]);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-400 text-xs">
              Make sure the photo clearly shows you are present at the event venue. The admin will review this as part of attendance verification.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowCheckInModal(false); setCheckInPhotos([]); }} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="button" onClick={checkIn} disabled={checkingIn || checkInPhotos.length === 0} className="btn-primary flex-1 justify-center">
              <CheckCircle className="w-4 h-4" />
              {checkingIn ? 'Checking in...' : 'Confirm Check-In'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showReqModal} onClose={() => setShowReqModal(false)} title="Request Equipment Update">
        <form onSubmit={submitRequest} className="space-y-4">
          <div className="flex gap-2">
            {['From List', 'Custom Item'].map((label, i) => (
              <button key={label} type="button"
                onClick={() => setReqForm(f => ({ ...f, useCustom: i === 1, equipmentId: '', customName: '', quantity: 1 }))}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${(i === 1) === reqForm.useCustom ? 'border-primary bg-primary/15 text-white' : 'border-white/10 bg-white/5 text-white/50'}`}>
                {label}
              </button>
            ))}
          </div>

          {!reqForm.useCustom && (
            <div>
              <label className="label">Select Equipment *</label>
              {dbEquipment.length === 0 ? (
                <p className="text-white/40 text-sm p-3 bg-white/5 rounded-xl">No equipment found</p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-1.5 border border-white/10 rounded-xl p-2">
                  {dbEquipment.map(eq => {
                    const avail       = eq.availability || 'available';
                    const isAvailable = avail === 'available';
                    const qty         = eq.quantity || eq.availableQuantity || 1;

                    const availBadge = {
                      available:   { cls: 'bg-green-500/20 text-green-400', label: 'Available' },
                      in_use:      { cls: 'bg-blue-500/20  text-blue-400',  label: 'In Use'    },
                      maintenance: { cls: 'bg-yellow-500/20 text-yellow-400', label: 'Maintenance' },
                      retired:     { cls: 'bg-red-500/20   text-red-400',   label: 'Retired'   },
                    }[avail] || { cls: 'bg-gray-500/20 text-gray-400', label: avail };

                    return (
                      <button key={eq._id} type="button"
                        disabled={!isAvailable}
                        onClick={() => isAvailable && setReqForm(f => ({
                          ...f,
                          equipmentId: eq._id,
                          quantity: qty   // ← auto-fill from DB quantity
                        }))}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all
                          ${!isAvailable
                            ? 'opacity-40 cursor-not-allowed bg-white/3'
                            : reqForm.equipmentId === eq._id
                              ? 'bg-primary/20 border border-primary/40'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}>
                        <Wrench className={`w-4 h-4 flex-shrink-0 ${reqForm.equipmentId === eq._id ? 'text-primary' : 'text-white/30'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isAvailable ? 'text-white' : 'text-white/40'}`}>{eq.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-white/40 text-xs capitalize">{eq.category}</p>
                            <span className="text-white/20 text-xs">·</span>
                            <span className="text-white/40 text-xs">Qty: {qty}</span>
                          </div>
                        </div>
                        {/* Availability badge */}
                        <span className={`badge text-xs flex-shrink-0 ${availBadge.cls}`}>
                          {availBadge.label}
                        </span>
                        {reqForm.equipmentId === eq._id && isAvailable && (
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Show auto-filled quantity when item selected */}
              {reqForm.equipmentId && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <p className="text-primary/80 text-xs">
                    Quantity auto-set to <strong>{reqForm.quantity}</strong> based on available stock
                  </p>
                </div>
              )}
            </div>
          )}

          {reqForm.useCustom && (
            <div className="space-y-3">
              <div>
                <label className="label">Equipment Name *</label>
                <input className="input" placeholder="e.g. Extra Tripod, Wireless Mic"
                  value={reqForm.customName}
                  onChange={e => setReqForm(f => ({ ...f, customName: e.target.value }))}
                  required={reqForm.useCustom} />
              </div>
              <div>
                <label className="label">Quantity</label>
                <input type="number" min="1" className="input w-28" value={reqForm.quantity}
                  onChange={e => setReqForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
          )}

          <div>
            <label className="label">Reason <span className="text-white/30">(Optional)</span></label>
            <textarea className="input min-h-[70px]" placeholder="Why do you need this?" value={reqForm.reason}
              onChange={e => setReqForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowReqModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submittingReq} className="btn-primary flex-1 justify-center">
              <Package className="w-4 h-4" />{submittingReq ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}