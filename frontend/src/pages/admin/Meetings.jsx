import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, Clock, Users, ExternalLink, Check, X, CalendarClock, Lock, Unlock } from 'lucide-react';
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

  const selectedEvent = events.find(ev => ev._id === form.eventId) || null;
  const minDateTime = toLocalInputValue(new Date());
  const maxDateTime = selectedEvent?.eventDate ? toLocalInputValue(selectedEvent.eventDate) : undefined;

  const handleEventChange = (eventId) => {
    const ev = events.find(e => e._id === eventId) || null;
    setForm(f => {
      const eventMax = ev?.eventDate ? new Date(ev.eventDate).getTime() : null;
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
    try {
      if (approvingMeeting) {
        await api.patch(`/meetings/${approvingMeeting._id}/approve`, { ...form, participantIds: selectedParticipants });
        toast.success('Meeting confirmed!');
      } else {
        await api.post('/meetings', { ...form, participantIds: selectedParticipants });
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
        action={<button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> New Meeting</button>} />

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
          <div className="grid grid-cols-2 gap-4">
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
              {selectedEvent?.eventDate && (
                <p className="text-white/30 text-xs mt-1">Must be on or before {selectedEvent.eventName}'s date</p>
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