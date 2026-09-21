import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, MapPin, ArrowRight, Plus } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, StatusBadge, PageHeader } from '../../components/shared';
import ServiceBadges from '../../components/shared/ServiceBadges';
import { formatDate } from '../../utils/helpers';

export default function ClientEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/events').then(r => { setEvents(r.data.events); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="My Projects" subtitle={`${events.length} projects`}
        action={
          <button onClick={() => navigate('/client/inquiry')} className="btn-primary w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" /> <span className="sm:hidden">New</span><span className="hidden sm:inline">New Inquiry</span>
          </button>
        } />

      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No projects yet"
          description="Submit an inquiry to book your project"
          action={<button onClick={() => navigate('/client/inquiry')} className="btn-primary">Submit Inquiry</button>} />
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <div key={event._id} onClick={() => navigate(`/client/events/${event._id}`)}
              className="card hover:border-primary/30 cursor-pointer transition-all hover:bg-white/5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-semibold truncate">{event.eventName?.trim() || 'Untitled Project'}</h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-sm text-white/50">
                      <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />{formatDate(event.eventDate)}</span>
                      <span className="flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{event.location}</span></span>
                    </div>
                    <div className="mt-2">
                      <ServiceBadges services={event.services} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 pl-[52px] sm:pl-0">
                  <StatusBadge status={event.status} />
                  <ArrowRight className="w-4 h-4 text-white/30 hidden sm:block" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}