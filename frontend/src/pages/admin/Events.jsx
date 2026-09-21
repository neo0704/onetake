import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, MapPin, Users, List, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, StatusBadge, PageHeader } from '../../components/shared';
import ServiceBadges from '../../components/shared/ServiceBadges';
import { formatDate } from '../../utils/helpers';

const STATUS_FILTERS = [
  'all','inquiry_received','inquiry_accepted','needs_assessed','quotation_sent',
  'confirmed','assigned','in_progress','completed_pending_balance','completed_paid','cancelled'
];

// Statuses that count as an actual "booking" on the calendar — i.e. the
// admin has accepted the inquiry and it hasn't been cancelled.
const BOOKED_STATUSES = [
  'inquiry_accepted', 'meeting_scheduled', 'needs_assessed', 'quotation_sent',
  'confirmed', 'downpayment_paid', 'assigned', 'in_progress',
  'completed_pending_balance', 'completed_paid',
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Builds the full 6-row grid for a given month, including the trailing days
// of the previous/next month needed to fill out complete weeks.
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset   = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart     = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null); // dateKey string or null
  const navigate = useNavigate();

  const fetch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await api.get('/events', { params });
      setEvents(data.events);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [statusFilter]);

  // ── Calendar data: group booked events by day ───────────────────────────
  const eventsByDay = useMemo(() => {
    const map = new Map();
    events
      .filter(e => BOOKED_STATUSES.includes(e.status) && e.eventDate)
      .forEach(e => {
        const key = dateKey(new Date(e.eventDate));
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      });
    return map;
  }, [events]);

  const monthGrid = useMemo(
    () => buildMonthGrid(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor]
  );

  const todayKey = dateKey(new Date());
  const goPrevMonth = () => { setSelectedDay(null); setMonthCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1)); };
  const goNextMonth = () => { setSelectedDay(null); setMonthCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1)); };
  const goToday     = () => { setSelectedDay(null); setMonthCursor(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }); };

  const selectedDayEvents = selectedDay ? (eventsByDay.get(selectedDay) || []) : [];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Projects" subtitle={`${events.length} total projects`} />

      {/* Pending inquiry alert */}
      {events.filter(e => e.status === 'inquiry_received').length > 0 && statusFilter === 'all' && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-blue-400 font-medium text-sm sm:text-base">
            🕐 {events.filter(e => e.status === 'inquiry_received').length} new project inquiry/inquiries pending review
          </p>
          <button onClick={() => setStatusFilter('inquiry_received')}
            className="text-blue-400 text-sm underline hover:text-blue-300 self-start sm:self-auto shrink-0">
            View inquiries
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={(e) => { e.preventDefault(); fetch(); }} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input className="input pl-9 w-full" placeholder="Search events..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary shrink-0">Search</button>
        </form>
        <select className="input w-full sm:w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUS_FILTERS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Status' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* List / Calendar toggle */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => setView('list')}
            className={`flex items-center justify-center gap-1.5 flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${view === 'list' ? 'bg-primary text-white' : 'text-white/50 hover:text-white'}`}
          >
            <List className="w-4 h-4" /> List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center justify-center gap-1.5 flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${view === 'calendar' ? 'bg-primary text-white' : 'text-white/50 hover:text-white'}`}
          >
            <Calendar className="w-4 h-4" /> Calendar
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : events.length === 0 ? (
        <EmptyState icon={Calendar} title="No projects found"
          description="Projects will appear here once clients submit inquiries" />

      ) : view === 'list' ? (
        <div className="space-y-3">
          {events.map(event => (
            <div key={event._id} onClick={() => navigate(`/admin/events/${event._id}`)}
              className="card hover:border-primary/30 cursor-pointer transition-all duration-200 hover:bg-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold truncate">{event.eventName}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-white/50">
                        <span className="flex items-center gap-1 min-w-0"><Users className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{event.client?.name}</span></span>
                        <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3.5 h-3.5" />{formatDate(event.eventDate)}</span>
                        <span className="flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{event.location}</span></span>
                      </div>
                      <div className="mt-2">
                        <ServiceBadges services={event.services} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:gap-1 pl-[52px] sm:pl-0">
                  <StatusBadge status={event.status} />
                  <span className="text-white/30 text-xs">{formatDate(event.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      ) : (
        // ═══ CALENDAR VIEW ═══
        <div className="space-y-4">
          <div className="card">
            {/* Month nav */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="section-title text-base sm:text-lg">
                {monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={goToday} className="btn-ghost text-xs px-2.5 py-1.5">Today</button>
                <button onClick={goPrevMonth} className="btn-ghost p-1.5"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={goNextMonth} className="btn-ghost p-1.5"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAY_LABELS.map(w => (
                <div key={w} className="text-center text-white/40 text-[10px] sm:text-xs font-semibold py-2">
                  <span className="sm:hidden">{w.slice(0, 1)}</span>
                  <span className="hidden sm:inline">{w}</span>
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {monthGrid.map(d => {
                const key         = dateKey(d);
                const inMonth     = d.getMonth() === monthCursor.getMonth();
                const dayEvents   = eventsByDay.get(key) || [];
                const isToday     = key === todayKey;
                const isSelected  = key === selectedDay;
                const visible     = dayEvents.slice(0, 2);
                const overflow    = dayEvents.length - visible.length;

                return (
                  <button
                    key={key}
                    onClick={() => dayEvents.length > 0 && setSelectedDay(isSelected ? null : key)}
                    className={`min-h-[52px] sm:min-h-[84px] p-1 sm:p-1.5 rounded-lg text-left border transition-colors flex flex-col gap-1
                      ${inMonth ? 'bg-white/[0.03]' : 'bg-transparent opacity-40'}
                      ${isSelected ? 'border-primary' : 'border-white/5'}
                      ${dayEvents.length > 0 ? 'hover:border-primary/40 cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className={`text-[11px] sm:text-xs font-medium ${isToday ? 'w-5 h-5 flex items-center justify-center rounded-full bg-primary text-white' : 'text-white/50'}`}>
                      {d.getDate()}
                    </span>
                    {/* Mobile: just a dot indicator per event to save space */}
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 sm:hidden">
                        {dayEvents.slice(0, 4).map(ev => (
                          <span key={ev._id} className="w-1.5 h-1.5 rounded-full bg-primary" />
                        ))}
                      </div>
                    )}
                    {/* Desktop/tablet: event name pills */}
                    <div className="hidden sm:flex flex-col gap-0.5">
                      {visible.map(ev => (
                        <span
                          key={ev._id}
                          className="text-[10px] leading-tight px-1 py-0.5 rounded bg-primary/20 text-primary-200 truncate"
                          title={ev.eventName}
                        >
                          {ev.eventName}
                        </span>
                      ))}
                      {overflow > 0 && (
                        <span className="text-[10px] text-white/40 px-1">+{overflow} more</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail list */}
          {selectedDay && (
            <div className="card">
              <h3 className="section-title mb-3">
                Bookings — {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                })}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="text-white/40 text-sm">No accepted bookings on this date.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map(ev => (
                    <div
                      key={ev._id}
                      onClick={() => navigate(`/admin/events/${ev._id}`)}
                      className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{ev.eventName}</p>
                        <p className="text-white/40 text-xs truncate">
                          {ev.client?.name}{ev.location ? ` · ${ev.location}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={ev.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}