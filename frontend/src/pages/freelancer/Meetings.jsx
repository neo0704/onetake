import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, ExternalLink, Clock, Plus } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import { formatDateTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

// NOTE: aligned to the actual Meeting schema statuses ('ongoing'/'done'),
// not 'in_progress'/'completed' — those are never actually set by the
// backend, so the old checks here silently never matched a live meeting.
const statusColor = {
  requested:  'bg-yellow-500/20 text-yellow-400',
  scheduled:  'bg-blue-500/20 text-blue-400',
  ongoing:    'bg-green-500/20 text-green-400',
  done:       'bg-gray-500/20 text-gray-400',
  declined:   'bg-red-500/20 text-red-400',
  cancelled:  'bg-red-500/20 text-red-400',
  expired:    'bg-orange-500/20 text-orange-400',
};

const statusLabel = {
  requested: 'Awaiting confirmation',
  expired:   'Expired',
};

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in the *local* timezone.
function toLocalInputValue(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function FreelancerMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: '', preferredAt: '', duration: 30, eventId: '', notes: '' });
  const navigate = useNavigate();

  const fetchMeetings = () => {
    api.get('/meetings').then(r => { setMeetings(r.data.meetings || []); setLoading(false); }).catch(() => setLoading(false));
  };

  const fetchEvents = () => {
    api.get('/events').then(r => setEvents(r.data.events || [])).catch(() => {});
  };

  useEffect(() => {
    fetchMeetings();
    fetchEvents();
  }, []);

  const resetForm = () => setForm({ title: '', preferredAt: '', duration: 30, eventId: '', notes: '' });

  const selectedEvent = events.find(ev => ev._id === form.eventId) || null;
  const minDateTime = toLocalInputValue(new Date());
  // Only limit the date to the event's date if that date is still ahead of us.
  // If the event is today or already past, min would end up AFTER max — an impossible
  // range that can freeze or crash the phone's date picker — so we skip the limit.
  const eventMaxValue = selectedEvent?.eventDate ? toLocalInputValue(selectedEvent.eventDate) : '';
  const maxDateTime = eventMaxValue && eventMaxValue >= minDateTime ? eventMaxValue : undefined;
  const eventDatePassed = Boolean(eventMaxValue) && !maxDateTime;

  const handleEventChange = (eventId) => {
    const ev = events.find(e => e._id === eventId) || null;
    setForm(f => {
      const rawMax   = ev?.eventDate ? new Date(ev.eventDate).getTime() : null;
      const eventMax = rawMax && rawMax >= Date.now() ? rawMax : null;   // ignore past event dates
      const currentTime = f.preferredAt ? new Date(f.preferredAt).getTime() : null;
      const stillValid = !eventMax || !currentTime || currentTime <= eventMax;
      return { ...f, eventId, preferredAt: stillValid ? f.preferredAt : '' };
    });
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const when = new Date(form.preferredAt);
      if (isNaN(when.getTime())) {
        toast.error('Please pick a valid date and time');
        setSubmitting(false);
        return;
      }
      // Send an ISO time (with timezone) so the server doesn't read it in its own timezone
      await api.post('/meetings/request', { ...form, preferredAt: when.toISOString() });
      toast.success('Meeting request sent to the admin!');
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

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Meetings"
        action={
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Request Meeting
          </button>
        }
      />
      {meetings.length === 0 ? (
        <EmptyState icon={Video} title="No meetings scheduled" description="Request a meeting with the admin, or meetings scheduled for you will appear here." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {meetings.map(m => {
            const canJoin = ['scheduled', 'ongoing'].includes(m.status);
            const isExpired = m.status === 'expired';
            return (
              <div key={m._id} className="card">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${canJoin ? 'bg-primary/20' : 'bg-white/10'}`}>
                    <Video className={`w-5 h-5 ${canJoin ? 'text-primary' : 'text-white/40'}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{m.title}</h3>
                    <p className="text-white/40 text-xs">{m.event?.eventName || 'General'}</p>
                    <span className="flex items-center gap-1 text-white/50 text-sm mt-1"><Clock className="w-3.5 h-3.5" />{formatDateTime(m.scheduledAt)}</span>
                  </div>
                  <span className={`badge ${statusColor[m.status] || 'bg-gray-500/20 text-gray-400'}`}>{statusLabel[m.status] || m.status}</span>
                </div>

                {canJoin && (
                  <button onClick={() => navigate(`/meeting/${m.roomId}`)} className="btn-primary w-full justify-center text-sm">
                    <ExternalLink className="w-4 h-4" /> Join Meeting
                  </button>
                )}

                {isExpired && (
                  <p className="text-orange-400/80 text-xs border-t border-white/10 pt-3">
                    This meeting's scheduled time passed and it was never started. Contact the admin if you still need it.
                  </p>
                )}

                {m.status === 'requested' && (
                  <p className="text-yellow-400/80 text-xs border-t border-white/10 pt-3">
                    Your request has been sent. The admin will confirm a time soon.
                  </p>
                )}

                {m.status === 'declined' && (
                  <p className="text-red-400/80 text-xs border-t border-white/10 pt-3">
                    This request was declined{m.declineReason ? `: ${m.declineReason}` : '.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
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
              placeholder="e.g. Question about project scope"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {maxDateTime && (
                <p className="text-white/30 text-xs mt-1">Must be on or before {selectedEvent.eventName}'s date</p>
              )}
              {eventDatePassed && (
                <p className="text-white/30 text-xs mt-1">{selectedEvent.eventName}'s date has passed — pick any future time.</p>
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
              placeholder="Anything the admin should know ahead of time..."
            />
          </div>
          <p className="text-white/40 text-xs">
            This sends a request to the admin — they'll confirm a time and you'll see it appear above.
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