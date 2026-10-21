import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, MapPin, ArrowRight, Wrench } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, StatusBadge, PageHeader } from '../../components/shared';
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

export default function FreelancerEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    api.get('/events').then(r => { setEvents(r.data.events); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <ListPageSkeleton filters={false} />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="My Projects" subtitle={`${events.length} assigned projects`} />

      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No projects assigned" description="Project assignments will appear here" />
      ) : (
        <div className="space-y-3">
          {events.map(ev => {
            const myId = user?._id;
            const myAssignment = ev.assignedFreelancers?.find(
              af => af.freelancer?._id?.toString() === myId || af.freelancer?.toString() === myId
            );
            const myEquipment = myAssignment?.equipment || [];
            const equipmentNames = myEquipment.slice(0, 2).map(eq =>
              typeof eq.equipment === 'object' ? eq.equipment?.name : eq.equipment || 'Equipment'
            ).filter(Boolean);
            const hasMore = myEquipment.length > 2;
            const rel = relativeDay(ev.eventDate, ev.status);

            return (
              <div key={ev._id} onClick={() => navigate(`/freelancer/events/${ev._id}`)}
                className={`group card cursor-pointer transition-all duration-200 hover:bg-white/[0.06] hover:-translate-y-0.5 border-l-4 ${STATUS_ACCENT[ev.status] || 'border-l-white/20'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <DateTile date={ev.eventDate} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-white font-semibold truncate max-w-full">{ev.eventName}</h3>
                        {rel && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${rel.cls}`}>{rel.text}</span>}
                      </div>
                      {ev.location && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-white/50 min-w-0">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{ev.location}</span>
                        </div>
                      )}
                      {myEquipment.length > 0 && (
                        <div className="hidden sm:block mt-2 p-2 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Wrench className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                            <span className="text-primary/80 text-sm font-medium">
                              {myEquipment.length} item{myEquipment.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          {equipmentNames.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {equipmentNames.map((name, i) => (
                                <span key={i} className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                  {name}
                                </span>
                              ))}
                              {hasMore && <span className="text-xs text-primary/50">+{myEquipment.length - 2}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={ev.status} />
                    <ArrowRight className="w-4 h-4 text-white/20 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}