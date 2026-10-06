import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Users, TrendingUp, Clock, CheckCircle, AlertCircle, CreditCard, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../services/api';
import { StatCard, StatusBadge } from '../../components/shared';
import { formatDate, formatCurrency } from '../../utils/helpers';

const COLORS = ['#e94560', '#3b82f6', '#f59e0b', '#8b5cf6', '#22c55e'];

// Tooltip styled with the app's own themed classes so it follows light/dark mode
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="card !p-2.5 text-sm shadow-lg">
      <p className="text-white font-medium">{label || p.name}</p>
      <p className="text-white/60 text-xs mt-0.5">{p.value}</p>
    </div>
  );
}

// ---- Skeleton helpers (same grid/card layout as the real dashboard) ----
function Bone({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.16] ${className}`} />;
}

function StatCardSkeleton() {
  return (
    <div className="card flex items-center gap-3">
      <Bone className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Bone className="h-3 w-24" />
        <Bone className="h-6 w-16" />
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="flex-1 space-y-2">
        <Bone className="h-4 w-2/3" />
        <Bone className="h-3 w-1/2" />
      </div>
      <Bone className="h-6 w-16 rounded-full" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Bone className="h-8 w-48" />
        <Bone className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[...Array(3)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card lg:col-span-2 min-w-0">
          <Bone className="h-5 w-36 mb-4" />
          <Bone className="h-[200px] sm:h-[220px] w-full" />
        </div>
        <div className="card min-w-0">
          <Bone className="h-5 w-40 mb-4" />
          <div className="flex justify-center">
            <Bone className="h-[156px] w-[156px] rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            {[...Array(3)].map((_, i) => <Bone key={i} className="h-3 w-full" />)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {[0, 1].map(i => (
          <div key={i} className="card">
            <Bone className="h-5 w-36 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => <ListRowSkeleton key={j} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(null); // hovered bar / slice
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reports/dashboard').then(({ data }) => { setData(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

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
        <StatCard label="Active Events" value={s.activeEvents || 0} icon={Clock} color="bg-blue-500/20 text-blue-500" />
        <StatCard label="Completed" value={s.completedEvents || 0} icon={CheckCircle} color="bg-green-500/20 text-green-600" />
        <StatCard label="Pending Inquiries" value={s.pendingInquiries || 0} icon={AlertCircle} color="bg-yellow-500/20 text-yellow-600" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total Clients" value={s.totalClients || 0} icon={Users} color="bg-purple-500/20 text-purple-500" />
        <StatCard label="Freelancers" value={s.totalFreelancers || 0} icon={UserCheck} color="bg-teal-500/20 text-teal-600" />
        <StatCard label="Total Revenue" value={formatCurrency(s.totalRevenue || 0)} icon={CreditCard} color="bg-emerald-500/20 text-emerald-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card lg:col-span-2 min-w-0">
          <h2 className="section-title mb-4">Event Overview</h2>
          {eventStatusData.length > 0 ? (
            <div className="text-white">
              <ResponsiveContainer width="100%" height={200} className="sm:!h-[220px]">
                <BarChart data={eventStatusData} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="name" tick={{ fill: 'currentColor', fillOpacity: 0.6, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'currentColor', fillOpacity: 0.6, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<ChartTooltip />} cursor={false} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}
                    onMouseEnter={(_, i) => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}>
                    {eventStatusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]}
                        fillOpacity={activeIdx === null || activeIdx === i ? 1 : 0.35} style={{ transition: 'fill-opacity 150ms' }} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-white/40 text-center py-10">No event data yet</p>}
        </div>
        <div className="card min-w-0">
          <h2 className="section-title mb-4">Event Distribution</h2>
          {eventStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200} className="sm:!h-[220px]">
              <PieChart>
                <Pie data={eventStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3} stroke="none"
                  onMouseEnter={(_, i) => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}>
                  {eventStatusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]}
                      fillOpacity={activeIdx === null || activeIdx === i ? 1 : 0.35} style={{ transition: 'fill-opacity 150ms' }} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-white/40 text-center py-10">No data</p>}
          <div className="mt-2 space-y-1.5">
            {eventStatusData.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
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
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer">
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
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer">
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">{p.event?.eventName || '—'}</p>
                  <p className="text-white/40 text-xs truncate">{p.client?.name} · {p.type}</p>
                </div>
                <span className="text-yellow-600 font-mono text-sm shrink-0">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}