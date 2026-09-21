import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, Video, CheckCircle, Edit3, AlertTriangle, ChevronDown } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

// ── Popup calendar date picker (same UI as the client Inquiry form) ───────────
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseYMD(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function DatePickerField({ value, onChange, minDate, maxDate, error, disabled, placeholder = 'Select a date' }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseYMD(value || minDate || ymd(new Date())));
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!open) setViewDate(parseYMD(value || minDate || ymd(new Date())));
  }, [value, minDate, open]);

  const minD     = minDate ? parseYMD(minDate) : null;
  const maxD     = maxDate ? parseYMD(maxDate) : null;
  const todayStr = ymd(new Date());
  const year     = viewDate.getFullYear();
  const month    = viewDate.getMonth();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const goMonth = (delta) => setViewDate(new Date(year, month + delta, 1));

  const displayLabel = value
    ? parseYMD(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`input w-full flex items-center justify-between text-left
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
          ${error ? 'border-red-500/60 focus:border-red-500' : ''}`}
      >
        <span className={value ? 'text-white' : 'text-white/30'}>{displayLabel}</span>
        <Calendar className="w-4 h-4 text-white/40 flex-shrink-0" />
      </button>

      {open && !disabled && (
        <div className="card absolute z-50 mt-2 w-[300px] max-w-[calc(100vw-2rem)] shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => goMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 transition-colors">
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            <p className="text-white font-semibold text-sm">{monthLabel}</p>
            <button type="button" onClick={() => goMonth(1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 transition-colors">
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map(d => (
              <div key={d} className="text-center text-white/30 text-[10px] font-semibold py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const dStr        = ymd(date);
              const isBeforeMin = minD && date < minD;
              const isAfterMax  = maxD && date > maxD;
              const isDisabled  = isBeforeMin || isAfterMax;
              const isSelected  = value === dStr;
              const isToday     = dStr === todayStr;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => { onChange(dStr); setOpen(false); }}
                  className={`relative w-9 h-9 rounded-lg text-xs font-medium transition-colors
                    ${isSelected
                      ? 'bg-primary text-white'
                      : isDisabled
                        ? 'text-white/15 cursor-not-allowed'
                        : 'text-white/70 hover:bg-primary/15 hover:text-white cursor-pointer'}
                    ${isToday && !isSelected ? 'ring-1 ring-primary/40' : ''}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};

const TIME_SLOTS = [
  '8:00 AM','9:00 AM','10:00 AM','11:00 AM',
  '1:00 PM','2:00 PM','3:00 PM', '4:00 PM',
];

// Maps "9:00 AM" → "09:00" for datetime-local
const TIME_MAP = {
  '8:00 AM': '08:00', '9:00 AM': '09:00', '10:00 AM': '10:00', '11:00 AM': '11:00',
  '1:00 PM': '13:00', '2:00 PM': '14:00', '3:00 PM':  '15:00', '4:00 PM':  '16:00',
};

export default function MeetingScheduleCard({ event, onUpdate }) {
  const pref        = event.meetingPreference  || {};
  const sched       = event.scheduledMeeting   || {};
  const isScheduled = event.status === 'meeting_scheduled';

  const [editing,  setEditing]  = useState(!isScheduled);
  const [saving,   setSaving]   = useState(false);
  const [marking,  setMarking]  = useState(false);

  const [form, setForm] = useState({
    meetingType:   sched.meetingType   || pref.type    || 'online',
    confirmedDate: sched.confirmedDate
      ? new Date(sched.confirmedDate).toISOString().slice(0, 10)
      : (pref.preferredDate ? new Date(pref.preferredDate).toISOString().slice(0, 10) : ''),
    confirmedTime: sched.confirmedTime || pref.preferredTime || '',
    location:      sched.location || (pref.type === 'ftf' ? (pref.preferredLocation || 'Livetake Productions — Block E11 Lot 10, San Lorenzo 1, City of Dasmariñas, Cavite') : ''),
    notes:         sched.notes || '',
  });

  const today   = new Date().toISOString().slice(0, 10);
  const maxDate = event.eventDate ? new Date(event.eventDate).toISOString().slice(0, 10) : '';
  const isFtf   = form.meetingType === 'ftf';

  // ── Create in-system meeting (online) ──────────────────────────────────────
// ── Create in-system meeting (online) ──────────────────────────────────────
const createInSystemMeeting = async () => {
  const time24 = TIME_MAP[form.confirmedTime] || '09:00';
  const scheduledAt = `${form.confirmedDate}T${time24}:00`;

  try {
    const { data } = await api.post('/meetings', {
      eventId:     event._id,
      title:       `Needs Assessment — ${event.eventName}`,
      scheduledAt,
      duration:    60,
      notes:       form.notes || 'Needs assessment meeting with client.',
    });

    console.log('✅ Meeting created successfully:', data.meeting);
    return true;
  } catch (err) {
    console.error('Meeting creation failed:', err.response?.data || err);
    toast.error('Failed to create video meeting. Please try again.');
    return false;
  }
};

  // ── Confirm and schedule ───────────────────────────────────────────────────
  const saveSchedule = async () => {
    if (!form.confirmedDate) { toast.error('Please set a meeting date'); return; }
    if (!form.confirmedTime) { toast.error('Please set a meeting time'); return; }
    if (isFtf && !form.location.trim()) { toast.error('Please enter the meeting location'); return; }

    setSaving(true);
    try {
      // 1. Save the schedule to the event
      await api.put(`/events/${event._id}/schedule-meeting`, {
        meetingType:   form.meetingType,
        confirmedDate: form.confirmedDate,
        confirmedTime: form.confirmedTime,
        location:      isFtf ? form.location : 'In-system meeting — see Meetings section',
        notes:         form.notes,
      });

      // 2. For online: create the in-system meeting so client can see it
      if (!isFtf) {
        const created = await createInSystemMeeting();
        if (created) {
          toast.success('Online meeting scheduled and created in the system. Client and admin are both added as participants.');
        } else {
          toast.success('Meeting schedule saved. In-system meeting creation failed — create it manually in the Meetings tab.');
        }
      } else {
        toast.success('Face-to-face meeting scheduled. Client has been notified.');
      }

      setEditing(false);
      onUpdate?.();
    } catch (err) {
      console.error('[saveSchedule]', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to schedule meeting');
    } finally {
      setSaving(false);
    }
  };

  // ── Mark meeting as done → needs_assessed (assessment tab unlocks) ─────────
  const markDone = async () => {
    setMarking(true);
    try {
      await api.put(`/events/${event._id}/meeting-done`);
      toast.success('Meeting marked as done. Fill in the Assessment tab before creating the quotation.');
      onUpdate?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setMarking(false); }
  };

  return (
    <div className="card space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="section-title flex items-center gap-2">
            {isFtf
              ? <MapPin className="w-4 h-4 text-primary" />
              : <Video  className="w-4 h-4 text-primary" />}
            Needs Assessment Meeting
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            {isScheduled
              ? 'Meeting confirmed. Click "Mark as Done" after it concludes to unlock the Assessment tab.'
              : "Review the client's preferred schedule and confirm the meeting details."}
          </p>
        </div>
        {isScheduled && !editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost text-xs py-1.5 flex items-center gap-1">
            <Edit3 className="w-3.5 h-3.5" /> Reschedule
          </button>
        )}
      </div>
{/* Client's preferred schedule */}
{event.meetingPreference?.type && (
  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
    <p className="text-blue-400 text-xs font-semibold mb-1.5">Client Preferred Schedule</p>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
      <span>
        Type: <span className="text-white font-medium">
          {event.meetingPreference.type === 'ftf' ? 'Face-to-Face' : 'Online'}
        </span>
      </span>

      {event.meetingPreference?.type === 'ftf' && (
        <span className="text-amber-400">Will be held at our production establishment</span>
      )}

      {event.meetingPreference.preferredDate && (
        <span>Preferred Date: <span className="text-white">{fmtDate(event.meetingPreference.preferredDate)}</span></span>
      )}

      {event.meetingPreference.preferredTime && (
        <span>Preferred Time: <span className="text-white">{event.meetingPreference.preferredTime}</span></span>
      )}

      {!event.meetingPreference.preferredDate && !event.meetingPreference.preferredTime && (
        <span className="text-white/40 italic">No preferred schedule specified</span>
      )}
    </div>
  </div>
)}
      {/* Confirmed schedule view */}
      {isScheduled && !editing && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-3">
          <p className="text-green-400 font-semibold text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {sched.meetingType === 'ftf' ? 'Face-to-Face Meeting Confirmed' : 'Online Meeting Confirmed'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-white/70">
              <Calendar className="w-4 h-4 text-primary/60 flex-shrink-0" />
              {fmtDate(sched.confirmedDate)}
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <Clock className="w-4 h-4 text-primary/60 flex-shrink-0" />
              {sched.confirmedTime}
            </div>
            {sched.meetingType === 'ftf' && sched.location && (
              <div className="flex items-start gap-2 text-white/70 col-span-2">
                <MapPin className="w-4 h-4 text-primary/60 flex-shrink-0 mt-0.5" />
                {sched.location}
              </div>
            )}
            {sched.meetingType !== 'ftf' && (
              <div className="col-span-2 text-white/50 text-xs flex items-center gap-2">
                <Video className="w-3.5 h-3.5 text-primary/50" />
                Meeting is in the system — visible in the Meetings section for all participants
              </div>
            )}
            {sched.notes && (
              <p className="col-span-2 text-white/40 text-xs italic">Note: {sched.notes}</p>
            )}
          </div>
        </div>
      )}

      {/* Edit / create form */}
      {editing && (
        <div className="space-y-4 pt-2 border-t border-white/10">

          {/* Meeting type */}
          <div>
            <label className="label">Meeting Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { value: 'online', label: 'Online (In-System Meeting)' },
                { value: 'ftf',    label: 'Face-to-Face'               },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, meetingType: opt.value, location: opt.value === 'ftf' ? 'Livetake Productions — Block E11 Lot 10, San Lorenzo 1, City of Dasmariñas, Cavite' : '' }))}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                    ${form.meetingType === opt.value
                      ? 'border-primary bg-primary/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/50 hover:text-white'}`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {!isFtf && (
              <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-primary/80 text-xs leading-relaxed">
                  Selecting Online will automatically create a meeting inside the system.
                  Both you (admin) and the client will be added as participants and will be able to see it in the Meetings section.
                  No external link or platform needed.
                </p>
              </div>
            )}
          </div>

          {/* Date and time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Confirmed Date</label>
              <DatePickerField
                value={form.confirmedDate}
                onChange={(d) => setForm(f => ({ ...f, confirmedDate: d }))}
                minDate={today}
                maxDate={maxDate || undefined}
              />
              {maxDate && <p className="text-white/30 text-xs mt-1">Must be before the event date</p>}
            </div>
            <div>
              <label className="label">Confirmed Time</label>
              <select className="input" value={form.confirmedTime}
                onChange={e => setForm(f => ({ ...f, confirmedTime: e.target.value }))}>
                <option value="">Select time...</option>
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* FTF location */}
          {isFtf && (
            <div className="space-y-2">
              <label className="label flex items-center gap-2">
                Meeting Location
                <span className="text-primary/60 text-xs font-normal">(pre-filled)</span>
              </label>
              <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-white text-sm">Livetake Productions — Block E11 Lot 10, San Lorenzo 1, City of Dasmari&ntilde;as, Cavite</p>
              </div>
              <input className="input text-sm"
                placeholder="Override if meeting is held elsewhere..."
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notes <span className="text-white/30">(Optional)</span></label>
            <textarea className="input min-h-[60px]"
              placeholder={isFtf
                ? 'Parking information, what to bring, agenda...'
                : 'Agenda, topics to cover in the assessment...'}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3">
            {isScheduled && (
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
            )}
            <button type="button" onClick={saveSchedule} disabled={saving}
              className="btn-primary flex-1 justify-center">
              <Calendar className="w-4 h-4" />
              {saving
                ? 'Scheduling...'
                : isScheduled
                  ? 'Update Schedule'
                  : `Confirm ${isFtf ? 'Face-to-Face' : 'Online'} Meeting`}
            </button>
          </div>
        </div>
      )}

      {/* Mark as done button */}
      {isScheduled && !editing && (
        <div className="pt-3 border-t border-white/10">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-3">
            <p className="text-yellow-400 text-xs font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> After clicking Mark as Done
            </p>
            <p className="text-yellow-400/70 text-xs mt-1">
              The Assessment tab will unlock. Fill in the needs assessment before creating the quotation.
              The Create Quotation button only appears after the assessment is saved.
            </p>
          </div>
          <button onClick={markDone} disabled={marking}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-sm font-semibold hover:bg-green-500/30 transition-colors">
            <CheckCircle className="w-4 h-4" />
            {marking ? 'Updating...' : 'Mark Meeting as Done — Proceed to Assessment'}
          </button>
        </div>
      )}
    </div>
  );
}