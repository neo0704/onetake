import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, Plus, Clock, Users, ExternalLink, Check, X, CalendarClock, Lock, Unlock,
  ChevronLeft, ChevronRight, MapPin, List, CalendarDays,
} from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import { formatDateTime, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in the *local* timezone.
// Slicing a raw UTC ISO string would silently shift the displayed time by
// the browser's UTC offset, which is why the requested time looked wrong.
function toLocalInputValue(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function MeetingCard({ meeting, onJoin, onToggleLock, togglingLock }) {
  // NOTE: statuses here are aligned to the actual Meeting schema
  // ('ongoing'/'done'), not 'in_progress'/'completed' — those values are
  // never actually set anywhere in the backend, so the old check silently
  // never matched a truly ongoing meeting.
  const statusColor = {
    scheduled: 'bg-blue-500/20 text-blue-400',
    ongoing:   'bg-green-500/20 text-green-400',
    done:      'bg-gray-500/20 text-gray-400',
    cancelled: 'bg-red-500/20 text-red-400',
    declined:  'bg-red-500/20 text-red-400',
    expired:   'bg-orange-500/20 text-orange-400',
  };

  const isExpired = meeting.status === 'expired';
  const isReactivated = meeting.manuallyReactivated;

  return (
    <div className={`card ${isExpired ? 'border border-orange-500/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpired ? 'bg-orange-500/20' : 'bg-primary/20'}`}>
            <Video className={`w-5 h-5 ${isExpired ? 'text-orange-400' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className="text-white font-semibold">{meeting.title}</h3>
            <p className="text-white/50 text-xs mt-0.5">{meeting.event?.eventName || 'General Meeting'}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`badge ${statusColor[meeting.status] || 'bg-gray-500/20 text-gray-400'}`}>
            {isExpired ? 'Expired' : meeting.status}
          </span>
          {isReactivated && !isExpired && (
            <span className="badge bg-primary/20 text-primary text-[10px]">Manually Enabled</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/50">
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formatDateTime(meeting.scheduledAt)}</span>
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{meeting.duration} min</span>
        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{(meeting.participants?.length || 0) + 1} participants</span>
      </div>

      {isExpired && (
        <p className="mt-3 text-orange-400/80 text-xs border-t border-white/10 pt-3">
          This meeting's scheduled window closed and it was automatically locked. Clients and freelancers can no longer join it.
        </p>
      )}

      <div className="flex gap-2 mt-4">
        {['scheduled', 'ongoing'].includes(meeting.status) && (
          <button onClick={() => onJoin(meeting.roomId)} className="btn-primary text-sm flex-1 justify-center">
            <ExternalLink className="w-4 h-4" /> Join Meeting
          </button>
        )}

        {(isExpired || isReactivated) && (
          <button
            onClick={() => onToggleLock(meeting)}
            disabled={togglingLock}
            className={`text-sm flex-1 justify-center disabled:opacity-50 ${isExpired ? 'btn-primary' : 'btn-secondary'}`}
          >
            {isExpired ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {togglingLock ? 'Working...' : isExpired ? 'Enable Anyway' : 'Disable Again'}
          </button>
        )}
      </div>
    </div>
  );
}

function RequestCard({ meeting, onApprove, onDecline, declining }) {
  return (
    <div className="card border border-yellow-500/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">{meeting.title}</h3>
            <p className="text-white/50 text-xs mt-0.5">
              Requested by {meeting.requestedBy?.name || 'someone'}
              {meeting.requestedBy?.role ? ` (${meeting.requestedBy.role})` : ''}
              {meeting.event?.eventName ? ` · ${meeting.event.eventName}` : ''}
            </p>
          </div>
        </div>
        <span className="badge bg-yellow-500/20 text-yellow-400">Requested</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/50">
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formatDateTime(meeting.scheduledAt)}</span>
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{meeting.duration} min</span>
      </div>

      {meeting.notes && (
        <p className="mt-3 text-white/40 text-xs italic border-t border-white/10 pt-3">{meeting.notes}</p>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={() => onDecline(meeting)} disabled={declining} className="btn-secondary text-sm flex-1 justify-center disabled:opacity-50">
          <X className="w-4 h-4" /> Decline
        </button>
        <button onClick={() => onApprove(meeting)} className="btn-primary text-sm flex-1 justify-center">
          <Check className="w-4 h-4" /> Review & Confirm
        </button>
      </div>
    </div>
  );
}

// ── Calendar helpers ──────────────────────────────────────────────────────────
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtClock = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// "2:00 PM" → { h: 14, min: 0 }
function parseSlot(label) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return { h, min: Number(m[2]) };
}

const CAL_STATUS = {
  scheduled: { chip: 'bg-blue-500/20 text-blue-300',     dot: 'bg-blue-400',   label: 'Scheduled' },
  ongoing:   { chip: 'bg-green-500/20 text-green-300',   dot: 'bg-green-400',  label: 'Ongoing'   },
  requested: { chip: 'bg-yellow-500/20 text-yellow-300', dot: 'bg-yellow-400', label: 'Requested' },
  done:      { chip: 'bg-gray-500/20 text-gray-400',     dot: 'bg-gray-400',   label: 'Done'      },
  expired:   { chip: 'bg-orange-500/20 text-orange-300', dot: 'bg-orange-400', label: 'Expired'   },
};
const CAL_FALLBACK = CAL_STATUS.done;

// Merge the two places meetings live into one list:
//  1. Meeting records (online/in-system meetings, requests, ad-hoc meetings)
//  2. Event.scheduledMeeting — the ONLY record of face-to-face needs-assessment
//     meetings, since those never create a Meeting document.
// `blocking` marks entries that actually occupy the admin's time.
function buildCalendarEntries(meetings, events) {
  const entries = [];
  const eventsWithMeetingRecord = new Set();

  for (const m of meetings) {
    if (['cancelled', 'declined'].includes(m.status)) continue;
    const start = new Date(m.scheduledAt);
    if (isNaN(start.getTime())) continue;
    const duration = Number(m.duration) || 60;
    const evId = m.event?._id || m.event;
    if (evId) eventsWithMeetingRecord.add(String(evId));
    entries.push({
      id: m._id,
      kind: 'meeting',
      title: m.title,
      subtitle: m.event?.eventName || 'General Meeting',
      start,
      end: new Date(start.getTime() + duration * 60000),
      status: m.status,
      roomId: m.roomId,
      blocking: ['scheduled', 'ongoing'].includes(m.status),
    });
  }

  for (const ev of events) {
    const sm = ev.scheduledMeeting;
    if (!sm?.confirmedDate || !sm.confirmedTime) continue;
    if (!['confirmed', 'done'].includes(sm.status) || ev.status === 'cancelled') continue;
    // Online needs-assessment meetings already have a Meeting record above
    if (sm.meetingType === 'online' && eventsWithMeetingRecord.has(String(ev._id))) continue;

    const slot = parseSlot(sm.confirmedTime);
    if (!slot) continue;
    // confirmedDate is stored as a date-only value (UTC midnight)
    const [y, mo, d] = new Date(sm.confirmedDate).toISOString().slice(0, 10).split('-').map(Number);
    const start = new Date(y, mo - 1, d, slot.h, slot.min);
    entries.push({
      id: `event-${ev._id}`,
      kind: 'event',
      title: `Needs Assessment — ${ev.eventName}`,
      subtitle: sm.meetingType === 'ftf' ? 'Face-to-face' : 'Online',
      meetingType: sm.meetingType,
      start,
      end: new Date(start.getTime() + 60 * 60000),
      status: sm.status === 'done' ? 'done' : 'scheduled',
      blocking: sm.status === 'confirmed',
    });
  }
  return entries;
}

function MeetingsCalendar({ entries, onJoin, onCreateOn }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => ymdLocal(new Date()));

  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const todayStr = ymdLocal(new Date());

  const byDay = useMemo(() => {
    const map = {};
    for (const e of entries) (map[ymdLocal(e.start)] ||= []).push(e);
    Object.values(map).forEach(list => list.sort((a, b) => a.start - b.start));
    return map;
  }, [entries]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const goMonth = (delta) => setViewMonth(new Date(year, month + delta, 1));
  const goToday = () => {
    const n = new Date();
    setViewMonth(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelected(todayStr);
  };

  const dayEntries = byDay[selected] || [];
  const [sy, sm, sd] = selected.split('-').map(Number);
  const selectedLabel = new Date(sy, sm - 1, sd).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const isPastDay = selected < todayStr;

  return (
    <div className="space-y-4">
      <div className="card">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => goMonth(-1)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => goMonth(1)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-white font-semibold">{monthLabel}</h2>
          <button type="button" onClick={goToday} className="btn-secondary text-xs py-1.5 px-3">Today</button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-white/30 text-[10px] font-semibold uppercase tracking-wide py-1">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const dStr       = ymdLocal(date);
            const list       = byDay[dStr] || [];
            const isSelected = dStr === selected;
            const isToday    = dStr === todayStr;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(dStr)}
                className={`min-h-[56px] sm:min-h-[92px] p-1.5 rounded-xl border text-left flex flex-col gap-1 transition-colors
                  ${isSelected ? 'border-primary/60 bg-primary/10' : 'border-white/5 bg-white/[0.02] hover:border-white/20'}
                  ${isToday && !isSelected ? 'ring-1 ring-primary/40' : ''}`}
              >
                <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-white/60'}`}>
                  {date.getDate()}
                </span>

                {/* Desktop: time + title chips */}
                <div className="hidden sm:flex flex-col gap-1 min-w-0">
                  {list.slice(0, 2).map(e => (
                    <span key={e.id}
                      className={`truncate text-[10px] leading-tight px-1.5 py-0.5 rounded ${(CAL_STATUS[e.status] || CAL_FALLBACK).chip}`}>
                      {fmtClock(e.start)} · {e.title}
                    </span>
                  ))}
                  {list.length > 2 && (
                    <span className="text-[10px] text-white/40 px-1">+{list.length - 2} more</span>
                  )}
                </div>

                {/* Mobile: just dots */}
                {list.length > 0 && (
                  <div className="flex sm:hidden gap-0.5 flex-wrap">
                    {list.slice(0, 4).map(e => (
                      <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${(CAL_STATUS[e.status] || CAL_FALLBACK).dot}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-white/10 text-[10px] text-white/40">
          {Object.values(CAL_STATUS).map(s => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><Video className="w-3 h-3" /> Online</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Face-to-face</span>
        </div>
      </div>

      {/* Selected day detail */}
      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="section-title">{selectedLabel}</h3>
          {!isPastDay && (
            <button type="button" onClick={() => onCreateOn(selected)} className="btn-primary text-xs py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Schedule here
            </button>
          )}
        </div>

        {dayEntries.length === 0 ? (
          <p className="text-white/40 text-sm py-4 text-center">No meetings on this day.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {dayEntries.map(e => {
              const st = CAL_STATUS[e.status] || CAL_FALLBACK;
              const Icon = e.kind === 'event' && e.meetingType === 'ftf' ? MapPin : Video;
              return (
                <div key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{e.title}</p>
                      <p className="text-white/40 text-xs truncate">
                        {fmtClock(e.start)} – {fmtClock(e.end)} · {e.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${st.chip}`}>{st.label}</span>
                    {e.kind === 'meeting' && ['scheduled', 'ongoing'].includes(e.status) && (
                      <button type="button" onClick={() => onJoin(e.roomId)} className="btn-secondary text-xs py-1.5 px-3">
                        <ExternalLink className="w-3.5 h-3.5" /> Join
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [form, setForm] = useState({ title: '', scheduledAt: '', duration: 60, notes: '', eventId: '', isPrivate: false });
  const [events, setEvents] = useState([]);
  const [approvingMeeting, setApprovingMeeting] = useState(null);
  const [decliningMeeting, setDecliningMeeting] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const [togglingLockId, setTogglingLockId] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const navigate = useNavigate();

  const fetch = async () => {
    const { data } = await api.get('/meetings');
    setMeetings(data.meetings);
    setLoading(false);
  };
  useEffect(() => {
    fetch();
    api.get('/users?role=client').then(r => setClients(r.data.users));
    api.get('/users?role=freelancer').then(r => setFreelancers(r.data.users));
    api.get('/events').then(r => setEvents(r.data.events || []));
  }, []);

  const calendarEntries = useMemo(() => buildCalendarEntries(meetings, events), [meetings, events]);

  const resetForm = () => {
    setForm({ title: '', scheduledAt: '', duration: 60, notes: '', eventId: '', isPrivate: false });
    setSelectedParticipants([]);
    setApprovingMeeting(null);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  // Opened from the calendar's "Schedule here" — pre-fills that day at 9:00 AM
  const openCreateOn = (dayStr) => {
    resetForm();
    setForm(f => ({ ...f, scheduledAt: `${dayStr}T09:00` }));
    setShowModal(true);
  };

  const selectedEvent = events.find(ev => ev._id === form.eventId) || null;
  const minDateTime = toLocalInputValue(new Date());
  // Only limit the date to the event's date if that date is still ahead of us.
  // If the event is today or already past, min would end up AFTER max — an impossible
  // range that can freeze or crash the phone's date picker — so we skip the limit.
  const eventMaxValue = selectedEvent?.eventDate ? toLocalInputValue(selectedEvent.eventDate) : '';
  const maxDateTime = eventMaxValue && eventMaxValue >= minDateTime ? eventMaxValue : undefined;
  const eventDatePassed = Boolean(eventMaxValue) && !maxDateTime;

  // Warn (not block) if the chosen time overlaps another confirmed meeting
  const slotStart = form.scheduledAt ? new Date(form.scheduledAt) : null;
  const slotEnd   = slotStart && !isNaN(slotStart.getTime())
    ? new Date(slotStart.getTime() + (Number(form.duration) || 60) * 60000)
    : null;
  const slotConflicts = slotEnd
    ? calendarEntries.filter(e => e.blocking && e.id !== approvingMeeting?._id && slotStart < e.end && slotEnd > e.start)
    : [];

  const handleEventChange = (eventId) => {
    const ev = events.find(e => e._id === eventId) || null;
    setForm(f => {
      const rawMax   = ev?.eventDate ? new Date(ev.eventDate).getTime() : null;
      const eventMax = rawMax && rawMax >= Date.now() ? rawMax : null;   // ignore past event dates
      const currentTime = f.scheduledAt ? new Date(f.scheduledAt).getTime() : null;
      const stillValid = !eventMax || !currentTime || currentTime <= eventMax;
      return { ...f, eventId, scheduledAt: stillValid ? f.scheduledAt : '' };
    });
  };

  const openApprove = (meeting) => {
    setApprovingMeeting(meeting);
    setForm({
      title: meeting.title || '',
      scheduledAt: toLocalInputValue(meeting.scheduledAt),
      duration: meeting.duration || 60,
      notes: meeting.notes || '',
      eventId: meeting.event?._id || '',
      isPrivate: false
    });
    setSelectedParticipants(meeting.requestedBy?._id ? [meeting.requestedBy._id] : []);
    setShowModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const when = new Date(form.scheduledAt);
    if (isNaN(when.getTime())) {
      toast.error('Please pick a valid date and time');
      return;
    }
    // Send an ISO time (with timezone) so the server doesn't read it in its own timezone
    const payload = { ...form, scheduledAt: when.toISOString(), participantIds: selectedParticipants };
    try {
      if (approvingMeeting) {
        await api.patch(`/meetings/${approvingMeeting._id}/approve`, payload);
        toast.success('Meeting confirmed!');
      } else {
        await api.post('/meetings', payload);
        toast.success('Meeting scheduled!');
      }
      closeModal();
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const openDecline = (meeting) => {
    setDecliningMeeting(meeting);
    setDeclineReason('');
  };

  const closeDeclineModal = () => {
    setDecliningMeeting(null);
    setDeclineReason('');
  };

  const confirmDecline = async () => {
    if (!decliningMeeting) return;
    setDeclining(true);
    try {
      await api.patch(`/meetings/${decliningMeeting._id}/decline`, { reason: declineReason.trim() });
      toast.success('Request declined');
      closeDeclineModal();
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setDeclining(false);
    }
  };

  const toggleParticipant = (id) => setSelectedParticipants(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  // Toggles a meeting between locked (expired) and manually re-enabled.
  // The backend flips status/manuallyReactivated appropriately — this just
  // calls it and refreshes the list.
  const handleToggleLock = async (meeting) => {
    setTogglingLockId(meeting._id);
    try {
      const { data } = await api.patch(`/meetings/${meeting._id}/toggle-lock`);
      toast.success(data.meeting.status === 'expired' ? 'Meeting locked again' : 'Meeting re-enabled — it can be joined again');
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update meeting');
    } finally {
      setTogglingLockId(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  const requests = meetings.filter(m => m.status === 'requested');
  // Manually-reactivated meetings carry status 'scheduled' again, so they
  // naturally land in "upcoming" — the toggle button still shows via the
  // manuallyReactivated flag on the card itself.
  const upcoming = meetings.filter(m => ['scheduled', 'ongoing'].includes(m.status));
  const expired = meetings.filter(m => m.status === 'expired');
  const past = meetings.filter(m => ['done', 'cancelled', 'declined'].includes(m.status));

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Meetings" subtitle="Schedule and manage video conferences"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/10 overflow-hidden">
              <button type="button" onClick={() => setView('list')}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${view === 'list' ? 'bg-primary/20 text-white' : 'text-white/50 hover:text-white'}`}>
                <List className="w-4 h-4" /> <span className="hidden sm:inline">List</span>
              </button>
              <button type="button" onClick={() => setView('calendar')}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${view === 'calendar' ? 'bg-primary/20 text-white' : 'text-white/50 hover:text-white'}`}>
                <CalendarDays className="w-4 h-4" /> <span className="hidden sm:inline">Calendar</span>
              </button>
            </div>
            <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> New Meeting</button>
          </div>
        } />

      {requests.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Meeting Requests <span className="text-white/40 font-normal">({requests.length})</span></h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {requests.map(m => (
              <RequestCard key={m._id} meeting={m} onApprove={openApprove} onDecline={openDecline} declining={decliningMeeting?._id === m._id} />
            ))}
          </div>
        </div>
      )}

      {view === 'calendar' ? (
        <MeetingsCalendar
          entries={calendarEntries}
          onJoin={(roomId) => navigate(`/meeting/${roomId}`)}
          onCreateOn={openCreateOn}
        />
      ) : (
      <>
      {upcoming.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Upcoming</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcoming.map(m => (
              <MeetingCard
                key={m._id}
                meeting={m}
                onJoin={(roomId) => navigate(`/meeting/${roomId}`)}
                onToggleLock={handleToggleLock}
                togglingLock={togglingLockId === m._id}
              />
            ))}
          </div>
        </div>
      )}

      {expired.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Expired <span className="text-white/40 font-normal">({expired.length})</span></h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {expired.map(m => (
              <MeetingCard
                key={m._id}
                meeting={m}
                onJoin={(roomId) => navigate(`/meeting/${roomId}`)}
                onToggleLock={handleToggleLock}
                togglingLock={togglingLockId === m._id}
              />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Past Meetings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {past.map(m => (
              <MeetingCard
                key={m._id}
                meeting={m}
                onJoin={(roomId) => navigate(`/meeting/${roomId}`)}
                onToggleLock={handleToggleLock}
                togglingLock={togglingLockId === m._id}
              />
            ))}
          </div>
        </div>
      )}

      {meetings.length === 0 && <EmptyState icon={Video} title="No meetings scheduled" description="Schedule video meetings with clients and freelancers" />}
      </>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={approvingMeeting ? 'Confirm Meeting Request' : 'Schedule Meeting'} size="lg">
        <form onSubmit={submit} className="space-y-4">
          {approvingMeeting && (
            <p className="text-white/40 text-xs bg-dark-900 border border-white/10 rounded-lg p-3">
              Requested by <span className="text-white/70">{approvingMeeting.requestedBy?.name || 'someone'}</span>.
              Adjust the details below, pick who else should join, then confirm.
            </p>
          )}
          <div>
            <label className="label">Linked Event <span className="text-white/30 font-normal">(optional)</span></label>
            <select className="input" value={form.eventId} onChange={e => handleEventChange(e.target.value)}>
              <option value="">— No specific event —</option>
              {events.map(ev => (
                <option key={ev._id} value={ev._id}>{ev.eventName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Meeting Title</label>
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Project Details Call" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Date & Time</label>
              <input
                type="datetime-local"
                className="input"
                value={form.scheduledAt}
                onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                min={minDateTime}
                max={maxDateTime}
                required
              />
              {maxDateTime && (
                <p className="text-white/30 text-xs mt-1">Must be on or before {selectedEvent.eventName}'s date</p>
              )}
              {eventDatePassed && (
                <p className="text-white/30 text-xs mt-1">{selectedEvent.eventName}'s date has passed — pick any future time.</p>
              )}
              {slotConflicts.length > 0 && (
                <p className="text-amber-400 text-xs mt-1.5">
                  Heads up: overlaps with "{slotConflicts[0].title}" ({fmtClock(slotConflicts[0].start)} – {fmtClock(slotConflicts[0].end)})
                  {slotConflicts.length > 1 ? ` and ${slotConflicts.length - 1} more` : ''}.
                </p>
              )}
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input type="number" className="input" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} min="15" />
            </div>
          </div>
          <div>
            <label className="label">Select Participants</label>
            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-dark-900 rounded-lg border border-white/10">
              <p className="text-xs text-white/40 mb-2">Clients</p>
              {clients.map(c => (
                <label key={c._id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1.5 rounded-lg">
                  <input type="checkbox" checked={selectedParticipants.includes(c._id)}
                    onChange={() => toggleParticipant(c._id)} className="accent-primary" />
                  <span className="text-white text-sm">{c.name}</span>
                  <span className="text-white/40 text-xs">{c.email}</span>
                </label>
              ))}
              <p className="text-xs text-white/40 mb-2 mt-3">
                Freelancers {form.isPrivate && <span className="text-primary/70">(disabled — "Admin & Client only" is on)</span>}
              </p>
              {freelancers.map(f => (
                <label
                  key={f._id}
                  className={`flex items-center gap-2 p-1.5 rounded-lg ${form.isPrivate ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(f._id)}
                    disabled={form.isPrivate}
                    onChange={() => toggleParticipant(f._id)}
                    className="accent-primary"
                  />
                  <span className="text-white text-sm">{f.name}</span>
                  <span className="text-white/40 text-xs">{f.skills?.join(', ')}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => {
                  const turningOn = !form.isPrivate;
                  setForm(f => ({ ...f, isPrivate: turningOn }));
                  // The checkboxes are the actual source of truth for who's
                  // invited — so turning this on has to remove any already-
                  // checked freelancers, not just flip an inert flag that
                  // silently disagrees with what's visibly checked.
                  if (turningOn) {
                    const freelancerIds = new Set(freelancers.map(f => f._id));
                    setSelectedParticipants(prev => prev.filter(id => !freelancerIds.has(id)));
                  }
                }}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.isPrivate ? 'bg-primary' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.isPrivate ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Admin & Client only</p>
                <p className="text-white/40 text-xs">Unchecks and locks out any freelancers below — turn off to select them again</p>
              </div>
            </label>
          </div>
          <div>
            <label className="label">Notes (Optional)</label>
            <textarea className="input min-h-[70px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Agenda, topics to discuss..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">{approvingMeeting ? 'Confirm Meeting' : 'Schedule Meeting'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!decliningMeeting} onClose={closeDeclineModal} title="Decline Meeting Request" size="md">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Decline the request for <span className="text-white font-medium">"{decliningMeeting?.title}"</span> from{' '}
            <span className="text-white font-medium">{decliningMeeting?.requestedBy?.name || 'this person'}</span>? They'll be notified.
          </p>
          <div>
            <label className="label">Reason <span className="text-white/30 font-normal">(optional, shared with the client)</span></label>
            <textarea
              className="input min-h-[70px]"
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="e.g. That time doesn't work for the team, please request another slot"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeDeclineModal} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button
              type="button"
              onClick={confirmDecline}
              disabled={declining}
              className="btn-primary flex-1 justify-center bg-red-500/90 hover:bg-red-500 disabled:opacity-50"
            >
              {declining ? 'Declining...' : 'Decline Request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}