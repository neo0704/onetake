import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, MapPin, ArrowRight, Wrench } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, StatusBadge, PageHeader } from '../../components/shared';
import { formatDate } from '../../utils/helpers';

export default function FreelancerEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    api.get('/events').then(r => { setEvents(r.data.events); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

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

            return (
              <div key={ev._id} onClick={() => navigate(`/freelancer/events/${ev._id}`)}
                className="card hover:border-primary/30 cursor-pointer transition-all hover:bg-white/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate">{ev.eventName}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-white/50 overflow-hidden">
                        <span className="flex items-center gap-1 flex-shrink-0"><CalendarDays className="w-3.5 h-3.5" />{formatDate(ev.eventDate)}</span>
                        <span className="flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{ev.location}</span></span>
                      </div>
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
                    <ArrowRight className="w-4 h-4 text-white/30" />
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