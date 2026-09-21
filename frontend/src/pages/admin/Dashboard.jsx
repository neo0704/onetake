import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Users, TrendingUp, Clock, CheckCircle, AlertCircle, CreditCard, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../services/api';
import { LoadingSpinner, StatCard, StatusBadge } from '../../components/shared';
import { formatDate, formatCurrency } from '../../utils/helpers';

const COLORS = ['#e94560', '#0f3460', '#16213e', '#533483', '#4ade80'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reports/dashboard').then(({ data }) => { setData(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" />;

  const s = data?.stats || {};
  const eventStatusData = [
    { name: 'Active', value: s.activeEvents || 0 },
    { name: 'Completed', value: s.completedEvents || 0 },
    { name: 'Inquiries', value: s.pendingInquiries || 0 },
    { name: 'Total', value: Math.max(0, (s.totalEvents || 0) - (s.activeEvents || 0) - (s.completedEvents || 0) - (s.pendingInquiries || 0)) },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-white/50 text-sm mt-1">Welcome back! Here's what's happening.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Events" value={s.totalEvents || 0} icon={CalendarDays} color="bg-primary/20 text-primary" />
        <StatCard label="Active Events" value={s.activeEvents || 0} icon={Clock} color="bg-blue-500/20 text-blue-400" />
        <StatCard label="Completed" value={s.completedEvents || 0} icon={CheckCircle} color="bg-green-500/20 text-green-400" />
        <StatCard label="Pending Inquiries" value={s.pendingInquiries || 0} icon={AlertCircle} color="bg-yellow-500/20 text-yellow-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total Clients" value={s.totalClients || 0} icon={Users} color="bg-purple-500/20 text-purple-400" />
        <StatCard label="Freelancers" value={s.totalFreelancers || 0} icon={UserCheck} color="bg-teal-500/20 text-teal-400" />
        <StatCard label="Total Revenue" value={formatCurrency(s.totalRevenue || 0)} icon={CreditCard} color="bg-emerald-500/20 text-emerald-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card lg:col-span-2">
          <h2 className="section-title mb-4">Event Overview</h2>
          {eventStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200} className="sm:!h-[220px]">
              <BarChart data={eventStatusData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="value" fill="#e94560" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-white/40 text-center py-10">No event data yet</p>}
        </div>
        <div className="card">
          <h2 className="section-title mb-4">Event Distribution</h2>
          {eventStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200} className="sm:!h-[220px]">
              <PieChart>
                <Pie data={eventStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3}>
                  {eventStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-white/40 text-center py-10">No data</p>}
          <div className="mt-2 space-y-1.5">
            {eventStatusData.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-white/60">{item.name}</span>
                <span className="ml-auto text-white font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Events & Pending Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="section-title">Recent Events</h2>
            <button onClick={() => navigate('/admin/events')} className="text-primary text-sm hover:underline shrink-0">View all</button>
          </div>
          <div className="space-y-3">
            {(data?.recentEvents || []).length === 0 && <p className="text-white/40 text-sm">No events yet</p>}
            {(data?.recentEvents || []).map(event => (
              <div key={event._id} onClick={() => navigate(`/admin/events/${event._id}`)}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">{event.eventName}</p>
                  <p className="text-white/40 text-xs truncate">{event.client?.name} · {formatDate(event.eventDate)}</p>
                </div>
                <StatusBadge status={event.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="section-title">Pending Payments</h2>
            <button onClick={() => navigate('/admin/payments')} className="text-primary text-sm hover:underline shrink-0">View all</button>
          </div>
          <div className="space-y-3">
            {(data?.pendingPayments || []).length === 0 && <p className="text-white/40 text-sm">No pending payments</p>}
            {(data?.pendingPayments || []).map(p => (
              <div key={p._id} onClick={() => navigate('/admin/payments')}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">{p.event?.eventName || '—'}</p>
                  <p className="text-white/40 text-xs truncate">{p.client?.name} · {p.type}</p>
                </div>
                <span className="text-yellow-400 font-mono text-sm shrink-0">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}