import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, CheckSquare, MapPin, ArrowRight, Package, Wrench } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, StatCard, StatusBadge, EmptyState } from '../../components/shared';
import { formatDate } from '../../utils/helpers';
import useAuthStore from '../../store/authStore';

export default function FreelancerDashboard() {
const [events, setEvents] = useState([]);
  const [myEquipment, setMyEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const ACTIVE_STATUSES = ['confirmed', 'downpayment_paid', 'assigned', 'in_progress'];

  const aggregateEquipment = (events, userId) => {
    const equipMap = new Map();
    events.filter(ev => ACTIVE_STATUSES.includes(ev.status)).forEach(ev => {
      const myAssign = ev.assignedFreelancers?.find(af => {
        const fId = af.freelancer?._id || af.freelancer;
        return fId === userId;
      });
      if (myAssign?.equipment) {
        myAssign.equipment.forEach(item => {
          const eqId = item.equipment?._id || item.equipment;
          const eqName = item.equipment?.name || 'Equipment';
          if (!equipMap.has(eqId)) {
            equipMap.set(eqId, { name: eqName, category: item.equipment?.category || 'other', totalQty: 0, projects: 0 });
          }
          const entry = equipMap.get(eqId);
          entry.totalQty += item.quantity;
          entry.projects += 1;
        });
      }
    });
    return Array.from(equipMap.values());
  };

  useEffect(() => {
    Promise.all([
      api.get('/events'),
      api.get('/freelancers/my-schedule') // Use existing endpoint for user's events
    ]).then(([eventsRes, scheduleRes]) => {
      setEvents(eventsRes.data.events || []);
      setMyEquipment(aggregateEquipment(eventsRes.data.events || [], user?._id));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?._id]);

  if (loading) return <LoadingSpinner />;

  const upcoming = events.filter(e => ['confirmed','assigned'].includes(e.status));
  const inProgress = events.filter(e => e.status === 'in_progress');
  const completed = events.filter(e => ['completed_paid','completed_pending_balance'].includes(e.status));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Welcome, {user?.name?.split(' ')[0]}! </h1>
        <p className="text-white/50 text-sm mt-1">Your upcoming assignments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarDays} color="bg-blue-500/20 text-blue-400" />
        <StatCard label="In Progress" value={inProgress.length} icon={Clock} color="bg-primary/20 text-primary" />
        <StatCard label="Completed" value={completed.length} icon={CheckSquare} color="bg-green-500/20 text-green-400" />
        <StatCard label="Equipment" value={myEquipment.length} icon={Package} color="bg-purple-500/20 text-purple-400" />
      </div>

      {inProgress.length > 0 && (
        <div className="card border-primary/30">
          <h2 className="section-title mb-3 text-primary"> Active Projects</h2>
          <div className="space-y-3">
            {inProgress.map(ev => (
              <div key={ev._id} onClick={() => navigate(`/freelancer/events/${ev._id}`)}
                className="flex items-center justify-between gap-3 p-3 bg-primary/10 rounded-xl cursor-pointer hover:bg-primary/20 transition-colors">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{ev.eventName}</p>
                  <p className="text-white/50 text-xs flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{ev.location}</span></p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {myEquipment.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-3"> My Equipment</h2>
          <div className="space-y-2">
            {myEquipment.map((eq, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{eq.name}</p>
                    <p className="text-white/50 text-xs truncate">{eq.category} · {eq.projects} project{eq.projects > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="text-2xl font-black text-primary flex-shrink-0">{eq.totalQty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title mb-3">Upcoming Projects</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming projects" description="New event assignments will appear here" />
        ) : (
          <div className="space-y-3">
            {upcoming.map(ev => {
              const myRole = ev.assignedFreelancers?.find(af => af.freelancer?._id === user?._id || af.freelancer === user?._id)?.role;
              return (
                <div key={ev._id} onClick={() => navigate(`/freelancer/events/${ev._id}`)}
                  className="flex items-center justify-between gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{ev.eventName}</p>
                      <p className="text-white/40 text-xs mt-0.5 truncate">{formatDate(ev.eventDate)} · {ev.location}</p>
                      {myRole && <span className="badge bg-primary/20 text-primary text-xs mt-1">{myRole}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge status={ev.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}