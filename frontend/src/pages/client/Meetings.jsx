import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, Clock, Users } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import { formatDateTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in the *local* timezone.
function toLocalInputValue(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function MeetingCard({ meeting, onJoin }) {
  const statusColor = {
    requested:  'bg-yellow-500/20 text-yellow-400',
    scheduled:  'bg-blue-500/20 text-blue-400',
    ongoing:    'bg-green-500/20 text-green-400',
    done:       'bg-gray-500/20 text-gray-400',
    cancelled:  'bg-red-500/20 text-red-400',
    declined:   'bg-red-500/20 text-red-400',
    expired:    'bg-orange-500/20 text-orange-400',
  };

  const statusLabel = {
    requested: 'Awaiting confirmation',
    expired:   'Expired',
  };

  // The backend is the source of truth for expiry (it sweeps meetings past
  // their scheduled window to 'expired', and respects an admin's manual
  // reactivation) — this just reflects that status, no local time math.
  const isJoinable = ['scheduled', 'ongoing'].includes(meeting.status);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-white font-semibold">{meeting.title}</h3>
            <p className="text-white/50 text-xs mt-0.5">
              {meeting.event?.eventName || 'General Meeting'}
            </p>
          </div>
        </div>
        <span className={`badge ${statusColor[meeting.status] || 'bg-gray-500/20 text-gray-400'}`}>
          {statusLabel[meeting.status] || meeting.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/50">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatDateTime(meeting.scheduledAt)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {meeting.duration} min
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {(meeting.participants?.length || 0) + 1} participants
        </span>
      </div>

      {isJoinable && meeting.roomId && (
        <button
          onClick={() => onJoin(meeting.roomId)}
          className="mt-4 w-full btn-primary flex items-center justify-center gap-2"
        >
          <Video className="w-4 h-4" />
          Join Meeting
        </button>
      )}

      {meeting.status === 'expired' && (
        <p className="mt-3 text-orange-400/80 text-xs border-t border-white/10 pt-3">
          This meeting's scheduled time passed and it was never started. Contact the team if you still need it.
        </p>
      )}

      {meeting.status === 'requested' && (
        <p className="mt-3 text-yellow-400/80 text-xs border-t border-white/10 pt-3">
          Your request has been sent. We'll confirm a time soon.
        </p>
      )}

      {meeting.status === 'declined' && (
        <p className="mt-3 text-red-400/80 text-xs border-t border-white/10 pt-3">
          This request was declined{meeting.declineReason ? `: ${meeting.declineReason}` : '.'}
        </p>
      )}

      {meeting.notes && (
        <p className="mt-3 text-white/40 text-xs italic border-t border-white/10 pt-3">
          {meeting.notes}
        </p>
      )}
    </div>
  );
}

export default function ClientMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: '', preferredAt: '', duration: 30, eventId: '', notes: '' });
  const navigate = useNavigate();

  const fetchMeetings = async () => {
    try {
      const { data } = await api.get('/meetings');
      setMeetings(data.meetings || []);
    } catch (err) {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data } = await api.get('/events');
      setEvents(data.events || []);
    } catch (err) {
      // Non-critical: the event dropdown is optional, so fail quietly
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetchEvents();
  }, []);

  const handleJoin = (roomId) => {
    if (roomId) {
      navigate(`/meeting/${roomId}`);   // Same tab - as requested
    } else {
      toast.error('Meeting link not available');
    }
  };

  const resetForm = () => setForm({ title: '', preferredAt: '', duration: 30, eventId: '', notes: '' });

  const selectedEvent = events.find(ev => ev._id === form.eventId) || null;
  const minDateTime = toLocalInputValue(new Date());
  const maxDateTime = selectedEvent?.eventDate ? toLocalInputValue(selectedEvent.eventDate) : undefined;

  const handleEventChange = (eventId) => {
    const ev = events.find(e => e._id === eventId) || null;
    setForm(f => {
      const eventMax = ev?.eventDate ? new Date(ev.eventDate).getTime() : null;
      const currentTime = f.preferredAt ? new Date(f.preferredAt).getTime() : null;
      const stillValid = !eventMax || !currentTime || currentTime <= eventMax;
      return { ...f, eventId, preferredAt: stillValid ? f.preferredAt : '' };
    });
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/meetings/request', form);
      toast.success('Meeting request sent!');
      setShowModal(false);
      resetForm();
      fetchMeetings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const upcoming = meetings.filter(m => ['requested', 'scheduled', 'ongoing'].includes(m.status));
  // 'expired' lives here too now — it's history, not an active request, and
  // shouldn't just vanish from the client's view.
  const past = meetings.filter(m => ['done', 'cancelled', 'declined', 'expired'].includes(m.status));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Meetings"
        subtitle="Your scheduled needs assessment and project meetings"
        action={
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Request Meeting
          </button>
        }
      />

      {upcoming.length > 0 && (
        <div>
          <h2 className="section-title mb-4">Upcoming Meetings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcoming.map(m => (
              <MeetingCard key={m._id} meeting={m} onJoin={handleJoin} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="section-title mb-4">Past Meetings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {past.map(m => (
              <MeetingCard key={m._id} meeting={m} onJoin={handleJoin} />
            ))}
          </div>
        </div>
      )}

      {meetings.length === 0 && (
        <EmptyState
          icon={Video}
          title="No meetings scheduled yet"
          description="Request a meeting with the team, or your needs assessment meetings will appear here once scheduled."
        />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Request a Meeting" size="lg">
        <form onSubmit={handleRequest} className="space-y-4">
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
            <label className="label">What's this about?</label>
            <input
              className="input"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
              placeholder="e.g. Project scope discussion"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Preferred Date & Time</label>
              <input
                type="datetime-local"
                className="input"
                value={form.preferredAt}
                onChange={e => setForm({ ...form, preferredAt: e.target.value })}
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
              <input
                type="number"
                className="input"
                value={form.duration}
                onChange={e => setForm({ ...form, duration: e.target.value })}
                min="15"
                step="15"
              />
            </div>
          </div>
          <div>
            <label className="label">Notes <span className="text-white/30 font-normal">(optional)</span></label>
            <textarea
              className="input min-h-[70px]"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Anything the team should know ahead of time..."
            />
          </div>
          <p className="text-white/40 text-xs">
            This sends a request to the team — they'll confirm a time and you'll see it appear above.
          </p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {submitting ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}