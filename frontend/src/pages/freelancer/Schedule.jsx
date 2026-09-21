import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, Wrench } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner } from '../../components/shared';
import { formatDate } from '../../utils/helpers';
import useAuthStore from '../../store/authStore';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_DOT = {
  confirmed:                 'bg-green-400',
  assigned:                  'bg-teal-400',
  in_progress:               'bg-primary',
  completed_pending_balance: 'bg-orange-400',
  completed_paid:            'bg-gray-400',
};

export default function FreelancerSchedule() {
  const { user }   = useAuthStore();
  const navigate   = useNavigate();
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const today                   = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewDate, setViewDate] = useState(new Date());
  const [selected, setSelected] = useState(null);

  const myId = String(user?._id || '');

  useEffect(() => {
    api.get('/events')
      .then(r => { setEvents(r.data.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map events to calendar date keys
  const byDate = {};
  events.forEach(ev => {
    const d   = new Date(ev.eventDate);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(ev);
  });

  const dateKey   = (d)    => `${year}-${month}-${d}`;
  const isToday   = (d)    => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const selEvents = selected ? (byDate[selected] || []) : [];

  // Helper: get MY assignment from an event
  const getMyAF = (ev) => (ev.assignedFreelancers || []).find(af => {
    const fId = String(af.freelancer?._id || af.freelancer || '');
    return fId === myId;
  });

  // Upcoming: all statuses that mean work is expected
  const upcoming = events
    .filter(e => {
      const d = new Date(e.eventDate);
      d.setHours(0, 0, 0, 0);
      return d >= today && ['confirmed', 'assigned', 'in_progress', 'needs_assessed', 'quotation_sent'].includes(e.status);
    })
    .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
    .slice(0, 15);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">My Schedule</h1>
        <p className="text-white/50 text-sm mt-1">Your project calendar and upcoming assignments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Calendar ── */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-white font-bold text-lg">{MONTHS[month]} {year}</h2>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center mb-3">
            <button onClick={() => { setViewDate(new Date()); setSelected(null); }}
              className="px-3 py-1 bg-white/10 hover:bg-white/15 rounded-lg text-white/50 hover:text-white text-xs transition-colors">
              Today
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-white/30 text-xs font-semibold py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day  = i + 1;
              const key  = dateKey(day);
              const evs  = byDate[key] || [];
              const tod  = isToday(day);
              const sel  = selected === key;
              const past = new Date(year, month, day) < today;

              return (
                <button key={day} onClick={() => setSelected(sel ? null : key)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-1 pb-1 transition-all
                    ${tod  ? 'bg-primary text-white font-bold ring-2 ring-primary/50' : ''}
                    ${sel && !tod ? 'bg-white/20 ring-2 ring-white/30' : ''}
                    ${!tod && !sel ? 'hover:bg-white/10 text-white/70 hover:text-white' : ''}
                    ${past && !tod && evs.length === 0 ? 'opacity-40' : ''}`}>
                  <span className="text-xs font-semibold leading-none">{day}</span>
                  {evs.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {evs.slice(0, 3).map((ev, ei) => (
                        <span key={ei} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[ev.status] || 'bg-white/50'}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-3">
            {[['bg-teal-400','Assigned'],['bg-primary','In Progress'],['bg-green-400','Confirmed'],['bg-orange-400','Completed']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${c}`} /><span className="text-white/40 text-xs">{l}</span>
              </div>
            ))}
          </div>

          {/* Selected day panel */}
          {selected && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h3 className="text-white font-semibold text-sm mb-3">
                {MONTHS[month]} {parseInt(selected.split('-')[2])}, {year}
              </h3>
              {selEvents.length === 0 ? (
                <p className="text-white/40 text-sm">No projects on this day</p>
              ) : (
                <div className="space-y-2">
                  {selEvents.map(ev => {
                    const myAF = getMyAF(ev);
                    return (
                      <button key={ev._id} onClick={() => navigate(`/freelancer/events/${ev._id}`)}
                        className="w-full flex items-start gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-colors">
                        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[ev.status] || 'bg-white/30'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{ev.eventName}</p>
                          <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {ev.location}
                          </p>
                          {myAF?.role && <p className="text-primary/70 text-xs mt-0.5">Role: {myAF.role}</p>}
                          {(myAF?.equipment || []).length > 0 && (
                            <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                              <Wrench className="w-3 h-3 text-primary/50" />
                              {(myAF.equipment || []).map(eq => {
                                const name = typeof eq.equipment === 'object' ? eq.equipment?.name : 'Equipment';
                                return name;
                              }).filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0 mt-1" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title mb-4">Upcoming Projects</h3>
            {upcoming.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="w-10 h-10 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-sm">No upcoming projects</p>
                <p className="text-white/30 text-xs mt-1">Projects will appear here when confirmed</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map(ev => {
                  const evDate   = new Date(ev.eventDate);
                  const myAF     = getMyAF(ev);
                  const myEq     = myAF?.equipment || [];
                  const daysAway = Math.ceil((evDate - today) / (1000 * 60 * 60 * 24));

                  return (
                    <button key={ev._id} onClick={() => navigate(`/freelancer/events/${ev._id}`)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 text-center bg-primary/20 border border-primary/30 rounded-xl p-2 min-w-[46px]">
                          <p className="text-primary font-black text-lg leading-none">{evDate.getDate()}</p>
                          <p className="text-primary/70 text-xs">{MONTHS[evDate.getMonth()].slice(0,3)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{ev.eventName}</p>
                          <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {ev.location}
                          </p>
                          {myAF?.role && <p className="text-primary/70 text-xs mt-0.5">Role: {myAF.role}</p>}
                          {myEq.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {myEq.slice(0, 2).map((eq, i) => {
                                const name = typeof eq.equipment === 'object' ? eq.equipment?.name : 'Equipment';
                                return name ? (
                                  <span key={i} className="badge bg-white/10 text-white/50 text-xs flex items-center gap-1">
                                    <Wrench className="w-2.5 h-2.5" /> {name}
                                  </span>
                                ) : null;
                              })}
                              {myEq.length > 2 && (
                                <span className="badge bg-white/10 text-white/50 text-xs">+{myEq.length - 2} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className={`text-xs font-medium ${daysAway === 0 ? 'text-red-400' : daysAway <= 3 ? 'text-orange-400' : daysAway <= 7 ? 'text-yellow-400' : 'text-white/40'}`}>
                          {daysAway === 0 ? ' Today!' : daysAway === 1 ? ' Tomorrow' : ` In ${daysAway} days`}
                        </span>
                        <span className="badge bg-white/10 text-white/40 text-xs capitalize">
                          {ev.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Equipment summary */}
          {upcoming.some(ev => (getMyAF(ev)?.equipment || []).length > 0) && (
            <div className="card">
              <h3 className="section-title mb-3">My Equipment (Upcoming)</h3>
              <div className="space-y-2">
                {upcoming.map(ev => {
                  const myEq = getMyAF(ev)?.equipment || [];
                  if (myEq.length === 0) return null;
                  return (
                    <div key={ev._id} className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-white/50 text-xs font-semibold mb-1.5 truncate">{ev.eventName}</p>
                      <div className="space-y-1">
                        {myEq.map((eq, i) => {
                          const name = typeof eq.equipment === 'object' ? eq.equipment?.name : 'Equipment';
                          return (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-white/60">
                                <Wrench className="w-3 h-3 text-primary/50" /> {name || 'Equipment'}
                              </span>
                              <span className="text-white/30">×{eq.quantity}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
