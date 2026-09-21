import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Calendar, Users, MapPin, Tag, Phone, Mail, Clock, Lock, Camera,
  ChevronDown, Video, Loader2, AlertCircle, X, CheckCircle2,
} from 'lucide-react';
import api from '../../services/api';
import { eventDateMin } from '../../utils/dateHelpers';
import toast from 'react-hot-toast';

const SERVICES = [
  {
    key:         'liveStreaming',
    label:       'Multi-Camera Live Event Coverage & Livestreaming',
    description: 'Professional multi-camera setup for live events with real-time streaming. Includes a Technical Director, Sony broadcast camcorders, HD production switcher, and hybrid speaker integration.',
    badge:       'Most Popular',
  },
  {
    key:         'documentation',
    label:       'Events Digital Documentation',
    description: 'Full photo and video coverage with Same-Day Edit (SDE) video. Two photographers and two videographers + drone footage.',
  },
  {
    key:         'weddingDebut',
    label:       'Wedding, Debut & Birthday Photo/Video with Livestream',
    description: 'Comprehensive photography and videography package for weddings, debuts, and birthdays with live streaming.',
  },
  {
    key:         'virtualLivestreaming',
    label:       'Remote & Virtual Livestreaming',
    description: 'Professional broadcast quality streaming for hybrid events, virtual conferences, and online meetings.',
  },
];

const SERVICE_LABELS = SERVICES.reduce((acc, s) => ({ ...acc, [s.key]: s.label }), {});

const MEETING_OPTIONS = [
  {
    value: 'online',
    label: 'Online Meeting',
    desc:  'Video meeting via our system. You will receive a meeting link after your inquiry is reviewed.',
    icon:  Video,
  },
  {
    value: 'ftf',
    label: 'Face-to-Face',
    desc:  'Meet at our production studio in Dasmariñas, Cavite.',
    icon:  MapPin,
  },
];

// Central validation so inline field errors, the summary progress, and the
// submit-time toast all agree on what "complete" means.
function getFormErrors(form, bookedDates) {
  const errors = {};
  if (!form.eventName.trim())      errors.eventName = 'Please enter an event name';
  if (!form.eventDate)             errors.eventDate = 'Please select an event date';
  else if (bookedDates?.has(form.eventDate)) {
    errors.eventDate = 'This date is already booked. Please choose another date.';
  }
  if (!form.eventCategory)         errors.eventCategory = 'Please select an event category';
  if (form.eventCategory === 'Others' && !form.eventCategoryOther.trim()) {
    errors.eventCategoryOther = 'Please describe your event type';
  }
  if (!form.location.trim())       errors.location = 'Please enter a venue or location';
  if (!form.selectedService)       errors.selectedService = 'Please select a service';
  if (!form.meetingType)           errors.meetingType = 'Please select your preferred meeting type';
  return errors;
}

function SectionHeader({ icon: Icon, title, subtitle, required }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h3 className="text-white font-semibold text-base leading-tight">
          {title}{required && ' *'}
        </h3>
        {subtitle && <p className="text-white/40 text-xs mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-red-400 text-xs mt-1.5">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {message}
    </p>
  );
}

function SummaryRow({ icon: Icon, label, value, required }) {
  const isEmpty = !value;
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5 text-white/60 text-sm">
        <Icon className="w-4 h-4 text-white/40" />
        {label}
      </div>
      {isEmpty ? (
        <span className={`text-xs text-right ${required ? 'text-amber-400/80' : 'text-white/30'}`}>
          {required ? 'Not added yet' : '—'}
        </span>
      ) : (
        <span className="text-white text-sm font-medium truncate max-w-[45%] text-right">
          {value}
        </span>
      )}
    </div>
  );
}

// ── Popup calendar date picker — blocks past dates and already-booked dates
// outright (not just a warning) by disabling those cells entirely ────────────
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseYMD(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
// N calendar days before the given YYYY-MM-DD string. Used to keep
// "maxDate" strictly N days clear of a given date (e.g. preferred meeting
// date must be at least 3 days before the event date).
function daysBefore(str, n) {
  const d = parseYMD(str);
  d.setDate(d.getDate() - n);
  return ymd(d);
}

function DatePickerField({ value, onChange, minDate, maxDate, bookedDates, error, disabled, placeholder = 'Select a date' }) {
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

  // Keep the visible month in sync if the field becomes enabled/valid later
  // (e.g. Preferred Date once an Event Date is finally picked)
  useEffect(() => {
    if (!open) setViewDate(parseYMD(value || minDate || ymd(new Date())));
  }, [value, minDate, open]);

  const minD     = minDate ? parseYMD(minDate) : null;
  const maxD     = maxDate ? parseYMD(maxDate) : null;
  const todayStr = ymd(new Date());
  const year     = viewDate.getFullYear();
  const month    = viewDate.getMonth();

  const firstWeekday  = new Date(year, month, 1).getDay();
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
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
        <div className="card absolute z-50 mt-2 w-[300px] max-w-[85vw] shadow-2xl">
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
              const isBooked    = bookedDates?.has(dStr);
              const isDisabled  = isBeforeMin || isAfterMax || isBooked;
              const isSelected  = value === dStr;
              const isToday     = dStr === todayStr;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  title={isBooked ? 'Already booked' : undefined}
                  onClick={() => { onChange(dStr); setOpen(false); }}
                  className={`relative w-9 h-9 rounded-lg text-xs font-medium transition-colors
                    ${isSelected
                      ? 'bg-primary text-white'
                      : isBooked
                        ? 'bg-red-500/10 text-red-400/40 line-through cursor-not-allowed'
                        : (isBeforeMin || isAfterMax)
                          ? 'text-white/15 cursor-not-allowed'
                          : 'text-white/70 hover:bg-primary/15 hover:text-white cursor-pointer'}
                    ${isToday && !isSelected ? 'ring-1 ring-primary/40' : ''}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {bookedDates && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-[10px] text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-primary inline-block" /> Selected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-red-500/30 inline-block" /> Already booked
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientInquiry() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [bookedDates, setBookedDates] = useState(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    eventName:          '',
    eventDate:          '',
    eventCategory:      '',
    eventCategoryOther: '',
    location:           '',
    attendees:          '',
    selectedService:    '',
    meetingType:        '',
    preferredDate:      '',
    preferredTime:      '',
    specialRequests:    '',
  });

  const minDate = eventDateMin();
  const today   = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/events/booked-dates');
        if (!cancelled) setBookedDates(new Set(data.dates || []));
      } catch {
        // Non-fatal — the server still re-validates on submit either way
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const requiredFields = useMemo(() => {
    const base = ['eventName', 'eventDate', 'eventCategory', 'location', 'selectedService', 'meetingType'];
    if (form.eventCategory === 'Others') base.push('eventCategoryOther');
    return base;
  }, [form.eventCategory]);

  const errors = useMemo(() => getFormErrors(form, bookedDates), [form, bookedDates]);
  const completedCount = requiredFields.length - Object.keys(errors).length;

  const markTouched = (field) => () => setTouched(t => ({ ...t, [field]: true }));
  const showError = (field) => (touched[field] || attemptedSubmit) && errors[field];
  const errorInputClass = (field) =>
    showError(field) ? 'border-red-500/60 focus:border-red-500' : '';

  const submit = (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    const currentErrors = getFormErrors(form, bookedDates);
    if (Object.keys(currentErrors).length > 0) {
      toast.error(Object.values(currentErrors)[0]);
      return;
    }

    // Fields all valid — show the confirmation popup before actually submitting.
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    const servicesPayload = {
      liveStreaming: false,
      documentation: false,
      weddingDebut: false,
      virtualLivestreaming: false,
      [form.selectedService]: true,
    };

    const meetingPreference = {
      type:          form.meetingType,
      preferredDate: form.preferredDate || undefined,
      preferredTime: form.preferredTime || undefined,
    };

    // Prepend the custom "Others" description to specialRequests so admin sees it
    const specialRequests = form.eventCategory === 'Others' && form.eventCategoryOther.trim()
      ? `Event type: ${form.eventCategoryOther.trim()}${form.specialRequests ? '\n\n' + form.specialRequests : ''}`
      : form.specialRequests;

    setSaving(true);
    try {
      await api.post('/events', {
        eventName:    form.eventName,
        eventDate:    form.eventDate,
        eventCategory: form.eventCategory,
        location:     form.location,
        attendees:    form.attendees,
        services:     servicesPayload,
        specialRequests,
        meetingPreference,
      });

      setShowConfirm(false);
      toast.success('Inquiry submitted successfully. Our team will review it shortly.');
      navigate('/client/events');
    } catch (err) {
      if (err.response?.status === 409) {
        // Someone else booked this date between page-load and submit — refresh
        // the booked-dates list so the calendar reflects reality immediately.
        setBookedDates(prev => new Set(prev).add(form.eventDate));
        setAttemptedSubmit(true);
        setShowConfirm(false);
      }
      toast.error(err.response?.data?.message || 'Failed to submit inquiry');
    } finally {
      setSaving(false);
    }
  };

  const categoryDisplay = form.eventCategory === 'Others'
    ? (form.eventCategoryOther.trim() || 'Others')
    : form.eventCategory;

  const SubmitLabel = () => (
    <>
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      {saving ? 'Submitting...' : 'Submit Inquiry'}
    </>
  );

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-5 px-1">
        <h1 className="page-title">Submit an Inquiry</h1>
        <p className="text-white/50 text-sm mt-1">
          Tell us about your event and we&apos;ll prepare a custom package just for you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left / main column - form */}
        <form id="inquiry-form" onSubmit={submit} className="lg:col-span-2 space-y-5">

          {/* Event details */}
          <div className="card">
            <SectionHeader icon={Calendar} title="Event Details" required
              subtitle="Please provide the basic information about your event." />
            <div className="space-y-3">
              <div>
                <label className="label">Event Name *</label>
                <input
                  className={`input ${errorInputClass('eventName')}`}
                  placeholder="e.g. Annual General Meeting 2026"
                  value={form.eventName}
                  onChange={e => setForm(f => ({ ...f, eventName: e.target.value }))}
                  onBlur={markTouched('eventName')}
                  required
                />
                <FieldError message={showError('eventName')} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Event Date *</label>
                  <DatePickerField
                    value={form.eventDate}
                    onChange={(newEventDate) => {
                      setForm(f => ({
                        ...f,
                        eventDate: newEventDate,
                        // Clear preferred meeting date if it's no longer at
                        // least 3 days before the new event date
                        preferredDate: f.preferredDate && f.preferredDate > daysBefore(newEventDate, 3) ? '' : f.preferredDate,
                      }));
                      setTouched(t => ({ ...t, eventDate: true }));
                    }}
                    minDate={minDate}
                    bookedDates={bookedDates}
                    error={!!showError('eventDate')}
                  />
                  <FieldError message={showError('eventDate')} />
                  {form.eventDate && (
                    <p className="text-white/30 text-xs mt-1">Date available</p>
                  )}
                </div>
                <div>
                  <label className="label">Event Category *</label>
                  <div className="relative">
                    <select
                      className={`input appearance-none pr-9 ${errorInputClass('eventCategory')}`}
                      value={form.eventCategory}
                      onChange={e => setForm(f => ({ ...f, eventCategory: e.target.value, eventCategoryOther: '' }))}
                      onBlur={markTouched('eventCategory')}
                      required
                    >
                      <option value="">Select category...</option>
                      <option value="Corporate">Corporate</option>
                      <option value="Wedding">Wedding</option>
                      <option value="Debut">Debut</option>
                      <option value="Birthday">Birthday</option>
                      <option value="Concert">Concert</option>
                      <option value="Conference">Conference</option>
                      <option value="Government">Government</option>
                      <option value="Religious">Religious</option>
                      <option value="Sports">Sports</option>
                      <option value="Others">Others</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <FieldError message={showError('eventCategory')} />
                </div>
              </div>
              {form.eventCategory === 'Others' && (
                <div>
                  <label className="label">Please specify *</label>
                  <input
                    className={`input ${errorInputClass('eventCategoryOther')}`}
                    placeholder="e.g. Product Launch, School Event, Alumni Reunion..."
                    value={form.eventCategoryOther}
                    onChange={e => setForm(f => ({ ...f, eventCategoryOther: e.target.value }))}
                    onBlur={markTouched('eventCategoryOther')}
                    required
                  />
                  <FieldError message={showError('eventCategoryOther')} />
                </div>
              )}
              <div>
                <label className="label">Venue / Location *</label>
                <input
                  className={`input ${errorInputClass('location')}`}
                  placeholder="e.g. Lanson Place, Mall of Asia, Pasay City"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  onBlur={markTouched('location')}
                  required
                />
                <FieldError message={showError('location')} />
              </div>
              <div>
                <label className="label">Expected Attendees</label>
                <input type="number" min="1" className="input" placeholder="e.g. 200"
                  value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Services - SINGLE SELECT */}
          <div className="card">
            <SectionHeader icon={Users} title="Service Needed" required
              subtitle="Choose one service" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SERVICES.map(svc => (
                <div
                  key={svc.key}
                  role="radio"
                  aria-checked={form.selectedService === svc.key}
                  tabIndex={0}
                  onClick={() => setForm(f => ({ ...f, selectedService: svc.key }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setForm(f => ({ ...f, selectedService: svc.key }));
                    }
                  }}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all
                    ${form.selectedService === svc.key
                      ? 'border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]'
                      : 'border-white/10 bg-white/5 hover:border-white/25'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all
                    ${form.selectedService === svc.key ? 'border-primary bg-primary' : 'border-white/30'}`}>
                    {form.selectedService === svc.key && (
                      <div className="w-2.5 h-2.5 bg-white rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-snug ${form.selectedService === svc.key ? 'text-white' : 'text-white/70'}`}>
                      {svc.label}
                    </p>
                    <p className={`text-xs mt-1 leading-relaxed ${form.selectedService === svc.key ? 'text-white/60' : 'text-white/40'}`}>
                      {svc.description}
                    </p>
                    {svc.badge && (
                      <p className="text-primary text-xs mt-2 font-medium flex items-center gap-1">
                        ★ {svc.badge}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <FieldError message={showError('selectedService')} />
          </div>

          {/* Needs Assessment Meeting Preference */}
          <div className="card">
            <SectionHeader icon={Clock} title="Needs Assessment Meeting" required
              subtitle="How would you prefer to discuss your event requirements with our team?" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {MEETING_OPTIONS.map(opt => {
                const selected = form.meetingType === opt.value;
                return (
                  <div
                    key={opt.value}
                    role="radio"
                    aria-checked={selected}
                    tabIndex={0}
                    onClick={() => setForm(f => ({ ...f, meetingType: opt.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setForm(f => ({ ...f, meetingType: opt.value }));
                      }
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all
                      ${selected
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-white/10 bg-white/5 hover:border-white/25'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <opt.icon className={`w-4 h-4 flex-shrink-0 ${selected ? 'text-primary' : 'text-white/40'}`} />
                      <p className={`font-semibold text-sm ${selected ? 'text-white' : 'text-white/70'}`}>
                        {opt.label}
                      </p>
                    </div>
                    <p className={`text-xs leading-relaxed ${selected ? 'text-white/60' : 'text-white/40'}`}>
                      {opt.desc}
                    </p>
                  </div>
                );
              })}
            </div>
            <FieldError message={showError('meetingType')} />

            {/* Online Meeting Info */}
            {form.meetingType === 'online' && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-blue-400 font-medium">Online Meeting</p>
                <p className="text-blue-400/80 text-xs mt-1 leading-relaxed">
                  You will receive a meeting invitation from our team. Our admin will contact
                  you to confirm the exact date and time.
                </p>
              </div>
            )}

            {/* Face-to-Face Info */}
            {form.meetingType === 'ftf' && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-amber-400 font-medium">Face-to-Face Meeting</p>
                <p className="text-amber-400/80 text-xs mt-1 leading-relaxed">
                  You will meet our team at our production studio in Dasmariñas, Cavite.
                  Our admin team will contact you to confirm the exact date and time.
                </p>
              </div>
            )}

            {/* Preferred schedule — shown once a meeting type is chosen */}
            {form.meetingType && (
              <div className="space-y-3 pt-1 mt-4">
                <p className="text-white/50 text-xs">
                  Let us know your preferred schedule. Our admin will confirm or suggest an alternative.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Preferred Date</label>
                    {(() => {
                      const latestAllowed = form.eventDate ? daysBefore(form.eventDate, 3) : null;
                      // No valid day satisfies both "today or later" and "3+
                      // days before the event" — the event is too soon for a
                      // meeting-preference window at all.
                      const windowImpossible = form.eventDate && latestAllowed < today;

                      if (windowImpossible) {
                        return (
                          <>
                            <div className="input w-full flex items-center opacity-40 cursor-not-allowed">
                              <span className="text-white/30">Not applicable</span>
                            </div>
                            <p className="text-white/30 text-xs mt-1">
                              Your event is too soon for a meeting preference — our team will reach out directly to schedule.
                            </p>
                          </>
                        );
                      }

                      return (
                        <>
                          <DatePickerField
                            value={form.preferredDate}
                            onChange={(d) => setForm(f => ({ ...f, preferredDate: d }))}
                            minDate={today}
                            maxDate={latestAllowed || undefined}
                            disabled={!form.eventDate}
                            placeholder="Select a date"
                          />
                          {!form.eventDate
                            ? <p className="text-white/30 text-xs mt-1">Set an event date first</p>
                            : <p className="text-white/30 text-xs mt-1">Must be at least 3 days before event date</p>
                          }
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="label">Preferred Time</label>
                    <div className="relative">
                      <select
                        className="input appearance-none pr-9"
                        value={form.preferredTime}
                        onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))}
                      >
                        <option value="">Select time...</option>
                        {[
                          '8:00 AM','9:00 AM','10:00 AM','11:00 AM',
                          '1:00 PM','2:00 PM','3:00 PM','4:00 PM',
                        ].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Special requests */}
          <div className="card">
            <h3 className="section-title mb-3">Special Requests</h3>
            <textarea className="input min-h-[100px]"
              placeholder="Any special requirements, specific setups, or things we should know..."
              value={form.specialRequests}
              onChange={e => setForm(f => ({ ...f, specialRequests: e.target.value }))} />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-white/30 text-xs">Optional — share anything that will help us prepare.</p>
              {form.specialRequests.length > 0 && (
                <p className="text-white/30 text-xs whitespace-nowrap">{form.specialRequests.length} characters</p>
              )}
            </div>
          </div>

          {/* Mobile-only submit (sidebar handles it on desktop) */}
          <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3 lg:hidden">
            <SubmitLabel />
          </button>
        </form>

        {/* Right column - summary & help */}
        <div className="space-y-5 lg:sticky lg:top-6">
          <div className="card">
            <h3 className="text-white font-semibold text-base">Inquiry Summary</h3>
            <p className="text-white/40 text-xs mt-0.5">Review your information before submitting.</p>

            <div className="flex items-center gap-2 mt-3 mb-1">
              <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${requiredFields.length ? Math.round((completedCount / requiredFields.length) * 100) : 0}%` }}
                />
              </div>
              <span className="text-white/40 text-xs font-medium whitespace-nowrap">
                {completedCount}/{requiredFields.length}
              </span>
            </div>

            <div className="divide-y divide-white/5">
              <SummaryRow icon={Calendar} label="Event Name" value={form.eventName} required />
              <SummaryRow icon={Calendar} label="Event Date" value={form.eventDate} required />
              <SummaryRow icon={Tag} label="Event Category" value={categoryDisplay} required />
              <SummaryRow icon={MapPin} label="Venue / Location" value={form.location} required />
              <SummaryRow icon={Users} label="Expected Attendees" value={form.attendees} />
              <SummaryRow icon={Users} label="Service Needed" value={SERVICE_LABELS[form.selectedService]} required />
            </div>
          </div>

          <div className="card">
            <h3 className="text-white font-semibold text-base">Need Help?</h3>
            <p className="text-white/40 text-xs mt-0.5 mb-4">We&apos;re here to assist you with your inquiry.</p>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm text-white/70">
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
               0906 8642 868
              </div>
              <div className="flex items-center gap-2.5 text-sm text-white/70">
                <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                livetakeproductions@gmail.com
              </div>
              <div className="flex items-center gap-2.5 text-sm text-white/70">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                Mon - Sat, 8:00 AM - 6:00 PM
              </div>
            </div>

            <button
              type="submit"
              form="inquiry-form"
              disabled={saving}
              className="btn-primary w-full justify-center py-3 mt-5 hidden lg:flex bg-gradient-to-r from-primary to-fuchsia-500"
            >
              <SubmitLabel />
            </button>
            <p className="flex items-center justify-center gap-1.5 text-white/30 text-xs mt-3">
              <Lock className="w-3 h-3" />
              Your information is safe with us.
            </p>
          </div>
        </div>
      </div>

      {/* Confirm-before-submit modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !saving && setShowConfirm(false)}
        >
          <div
            className="card w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-white font-semibold text-base">Confirm Your Inquiry</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={saving}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-white/40 text-xs mb-4">
              Please double-check your details before submitting. You can go back to make changes.
            </p>

            <div className="divide-y divide-white/5 rounded-xl bg-white/5 px-3.5 mb-5">
              <SummaryRow icon={Calendar} label="Event Name" value={form.eventName} required />
              <SummaryRow icon={Calendar} label="Event Date" value={form.eventDate} required />
              <SummaryRow icon={Tag} label="Event Category" value={categoryDisplay} required />
              <SummaryRow icon={MapPin} label="Venue / Location" value={form.location} required />
              <SummaryRow icon={Users} label="Expected Attendees" value={form.attendees} />
              <SummaryRow icon={Users} label="Service Needed" value={SERVICE_LABELS[form.selectedService]} required />
              <SummaryRow
                icon={form.meetingType === 'ftf' ? MapPin : Video}
                label="Meeting Type"
                value={MEETING_OPTIONS.find(o => o.value === form.meetingType)?.label}
                required
              />
              {form.preferredDate && (
                <SummaryRow icon={Calendar} label="Preferred Date" value={form.preferredDate} />
              )}
              {form.preferredTime && (
                <SummaryRow icon={Clock} label="Preferred Time" value={form.preferredTime} />
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={saving}
                className="flex-1 justify-center py-2.5 rounded-xl border border-white/15 text-white/70 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                Go Back &amp; Edit
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                disabled={saving}
                className="btn-primary flex-1 justify-center py-2.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {saving ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}