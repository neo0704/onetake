import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, MapPin, ArrowRight, Plus } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, StatusBadge, PageHeader } from '../../components/shared';
import ServiceBadges from '../../components/shared/ServiceBadges';
import { formatDate } from '../../utils/helpers';
import { ListPageSkeleton } from '../../components/shared/Skeletons';

// Left accent colour per status, so the list can be scanned at a glance
const STATUS_ACCENT = {
  inquiry_received:          'border-l-blue-400',
  inquiry_accepted:          'border-l-purple-400',
  meeting_scheduled:         'border-l-purple-400',
  needs_assessed:            'border-l-purple-400',
  quotation_sent:            'border-l-yellow-400',
  confirmed:                 'border-l-teal-400',
  downpayment_paid:          'border-l-teal-400',
  assigned:                  'border-l-teal-400',
  in_progress:               'border-l-orange-400',
  completed_pending_balance: 'border-l-amber-400',
  completed_paid:            'border-l-green-400',
  cancelled:                 'border-l-red-400',
};

// "Today", "Tomorrow", "In 5 days", "2 days ago". Skipped for finished / cancelled projects.
function relativeDay(eventDate, status) {
  if (!eventDate || ['completed_paid', 'cancelled'].includes(status)) return null;
  const d = new Date(eventDate);
  if (isNaN(d)) return null;
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((startOf(d) - startOf(new Date())) / 86400000);
  if (diff === 0) return { text: 'Today',    cls: 'bg-primary/20 text-primary' };
  if (diff === 1) return { text: 'Tomorrow', cls: 'bg-yellow-500/15 text-yellow-400' };
  if (diff > 1 && diff <= 7)  return { text: `In ${diff} days`, cls: 'bg-yellow-500/15 text-yellow-400' };
  if (diff > 7 && diff <= 60) return { text: `In ${diff} days`, cls: 'bg-white/5 text-white/50' };
  if (diff < 0) return { text: `${-diff} day${diff === -1 ? '' : 's'} ago`, cls: 'bg-white/5 text-white/40' };
  return null;
}

// Calendar-style tile showing the event date (month, year and day)
function DateTile({ date }) {
  const d = date ? new Date(date) : null;
  if (!d || isNaN(d)) {
    return (
      <div className="w-14 h-14 bg-primary/15 border border-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
        <CalendarDays className="w-5 h-5 text-primary" />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 bg-primary/15 border border-primary/20 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
      title={formatDate(date)}>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-primary leading-none">
        {d.toLocaleDateString('en-US', { month: 'short' })} {d.getFullYear()}
      </span>
      <span className="text-xl font-bold text-white leading-none mt-1">{d.getDate()}</span>
    </div>
  );
}

export default function ClientEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/events').then(r => { setEvents(r.data.events); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <ListPageSkeleton filters={false} action />;

  // A new inquiry is only allowed once every existing project is finished
  // (keep in sync with FINISHED_STATUSES in backend eventController.js)
  const FINISHED = ['completed_paid', 'cancelled'];
  const hasActiveEvent = events.some(e => !FINISHED.includes(e.status));
  const blockedTitle = 'You can send a new inquiry once your current project is completed or cancelled.';

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="My Projects" subtitle={`${events.length} projects`}
        action={
          <button onClick={() => navigate('/client/inquiry')}
            disabled={hasActiveEvent}
            title={hasActiveEvent ? blockedTitle : undefined}
            className="btn-primary w-full sm:w-auto justify-center disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" /> <span className="sm:hidden">New</span><span className="hidden sm:inline">New Inquiry</span>
          </button>
        } />

      {hasActiveEvent && (
        <p className="text-amber-400/80 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          {blockedTitle}
        </p>
      )}

      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No projects yet"
          description="Submit an inquiry to book your project"
          action={<button onClick={() => navigate('/client/inquiry')} className="btn-primary">Submit Inquiry</button>} />
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const rel = relativeDay(event.eventDate, event.status);
            return (
              <div key={event._id} onClick={() => navigate(`/client/events/${event._id}`)}
                className={`group card cursor-pointer transition-all duration-200 hover:bg-white/[0.06] hover:-translate-y-0.5 border-l-4 ${STATUS_ACCENT[event.status] || 'border-l-white/20'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <DateTile date={event.eventDate} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-white font-semibold truncate max-w-full">{event.eventName?.trim() || 'Untitled Project'}</h3>
                        {rel && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${rel.cls}`}>{rel.text}</span>}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-white/50 min-w-0">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{event.location}</span>
                        </div>
                      )}
                      <div className="mt-2">
                        <ServiceBadges services={event.services} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:gap-1 flex-shrink-0 pl-[68px] sm:pl-0">
                    <StatusBadge status={event.status} />
                    <span className="text-white/30 text-xs">Submitted {formatDate(event.createdAt)}</span>
                  </div>
                  <ArrowRight className="hidden sm:block w-4 h-4 shrink-0 text-white/20 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}