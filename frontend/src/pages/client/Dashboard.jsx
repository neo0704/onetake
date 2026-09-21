// This file contains the client dashboard - import as default
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, CreditCard, Clock, Plus, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, StatCard, StatusBadge } from '../../components/shared';
import { formatDate, formatCurrency } from '../../utils/helpers';
import useAuthStore from '../../store/authStore';

export default function ClientDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    api.get('/events').then(r => { setEvents(r.data.events); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const active = events.filter(e => ['confirmed','assigned','in_progress'].includes(e.status));
  const completed = events.filter(e => ['completed_paid','completed_pending_balance'].includes(e.status));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Welcome, {user?.name?.split(' ')[0]}! </h1>
        <p className="text-white/50 text-sm mt-1">Here's an overview of your projects</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Projects" value={events.length} icon={CalendarDays} color="bg-primary/20 text-primary" />
        <StatCard label="Active" value={active.length} icon={Clock} color="bg-blue-500/20 text-blue-400" />
        <StatCard label="Completed" value={completed.length} icon={FileText} color="bg-green-500/20 text-green-400" />
        <StatCard label="Inquiries" value={events.filter(e => e.status === 'inquiry_received').length} icon={CreditCard} color="bg-yellow-500/20 text-yellow-400" />
      </div>

      {events.length === 0 ? (
        <div className="card text-center py-12">
          <CalendarDays className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">No projects yet</h3>
          <p className="text-white/40 text-sm mb-5">Submit your first project inquiry to get started</p>
          <button onClick={() => navigate('/client/inquiry')} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" /> Submit Inquiry
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="section-title">My Projects</h2>
            <button onClick={() => navigate('/client/events')} className="text-primary text-sm hover:underline flex items-center gap-1 shrink-0">View all <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>

          {/* Downpayment alert for confirmed projects */}
          {events.filter(e => e.status === 'confirmed').length > 0 && (
            <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
              <p className="text-orange-400 text-sm font-medium">
                💰 {events.filter(e => e.status === 'confirmed').length} project(s) awaiting your 50% downpayment
              </p>
              <button onClick={() => navigate('/client/payments')} className="text-orange-400 text-xs underline whitespace-nowrap shrink-0">Pay Now</button>
            </div>
          )}

          <div className="space-y-3">
            {events.slice(0, 5).map(event => (
              <div key={event._id} onClick={() => navigate(`/client/events/${event._id}`)}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-sm truncate">{event.eventName}</p>
                  <p className="text-white/40 text-xs truncate">{formatDate(event.eventDate)} · {event.location}</p>
                  {event.status === 'confirmed' && (
                    <p className="text-orange-400 text-xs mt-0.5 truncate">⚠ Downpayment required to proceed</p>
                  )}
                </div>
                <StatusBadge status={event.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}