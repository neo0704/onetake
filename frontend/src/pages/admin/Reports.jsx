import React, { useEffect, useState } from 'react';
import { TrendingUp, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../services/api';
import { LoadingSpinner, PageHeader, StatCard } from '../../components/shared';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { ReportsSkeleton } from '../../components/shared/Skeletons';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b'];

// Tooltip built from the app's themed classes so it follows light/dark mode
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card !p-2.5 text-sm shadow-lg">
      <p className="text-white font-medium">{label}</p>
      <p className="text-white/60 text-xs mt-0.5">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function AdminReports() {
  const [financial, setFinancial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeIdx, setActiveIdx] = useState(null); // hovered bar

  const fetch = async () => {
    setLoading(true);
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const { data } = await api.get('/reports/financial', { params });
    setFinancial(data);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  if (loading) return <ReportsSkeleton />;
  const s = financial?.summary || {};

  const chartData = [
    { name: 'Downpayments', value: s.downpayments || 0 },
    { name: 'Balances', value: s.balances || 0 },
    { name: 'Pending', value: s.pendingAmount || 0 },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Reports & Analytics" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 sm:flex-none min-w-0"><label className="label">Start Date</label><input type="date" className="input w-full" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div className="flex-1 sm:flex-none min-w-0"><label className="label">End Date</label><input type="date" className="input w-full" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <div className="flex items-end"><button onClick={fetch} className="btn-primary w-full sm:w-auto justify-center">Apply</button></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(s.totalRevenue || 0)} icon={TrendingUp} color="bg-emerald-500/20 text-emerald-600" />
        <StatCard label="Downpayments" value={formatCurrency(s.downpayments || 0)} icon={CreditCard} color="bg-blue-500/20 text-blue-500" />
        <StatCard label="Balances Collected" value={formatCurrency(s.balances || 0)} icon={CheckCircle} color="bg-purple-500/20 text-purple-500" />
        <StatCard label="Pending" value={formatCurrency(s.pendingAmount || 0)} icon={Clock} color="bg-yellow-500/20 text-yellow-600" />
      </div>

      <div className="card min-w-0">
        <h3 className="section-title mb-4">Revenue Breakdown</h3>
        <div className="text-white">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
              <XAxis dataKey="name" tick={{ fill: 'currentColor', fillOpacity: 0.6, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'currentColor', fillOpacity: 0.6, fontSize: 12 }} axisLine={false} tickLine={false} width={48} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} cursor={false} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}
                onMouseEnter={(_, i) => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]}
                    fillOpacity={activeIdx === null || activeIdx === i ? 1 : 0.35} style={{ transition: 'fill-opacity 150ms' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title mb-4">Payment History</h3>

        {/* Mobile: card list */}
        <div className="md:hidden space-y-3">
          {(financial?.payments || []).map(p => (
            <div key={p._id} className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-primary text-xs">{p.paymentNumber}</p>
                  <p className="text-white font-medium truncate">{p.event?.eventName}</p>
                  <p className="text-white/60 text-sm truncate">{p.client?.name}</p>
                </div>
                <span className="text-white font-mono font-medium text-sm flex-shrink-0">{formatCurrency(p.amount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="capitalize text-white/70">{p.type}</span>
                  <span className="capitalize text-white/50">{p.method?.replace('_', ' ')}</span>
                </div>
                <span className="text-white/40">{formatDate(p.createdAt)}</span>
              </div>
            </div>
          ))}
          {(financial?.payments || []).length === 0 && <p className="text-center text-white/40 py-8">No payment data</p>}
        </div>

        {/* Desktop/tablet: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                {['Pay #', 'Event', 'Client', 'Type', 'Amount', 'Method', 'Date'].map(h => (
                  <th key={h} className="text-left py-3 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(financial?.payments || []).map(p => (
                <tr key={p._id} className="table-row">
                  <td className="py-2.5 pr-4 font-mono text-primary text-xs">{p.paymentNumber}</td>
                  <td className="py-2.5 pr-4 text-white">{p.event?.eventName}</td>
                  <td className="py-2.5 pr-4 text-white/60">{p.client?.name}</td>
                  <td className="py-2.5 pr-4 capitalize text-white/70">{p.type}</td>
                  <td className="py-2.5 pr-4 text-white font-medium font-mono">{formatCurrency(p.amount)}</td>
                  <td className="py-2.5 pr-4 capitalize text-white/50">{p.method?.replace('_', ' ')}</td>
                  <td className="py-2.5 pr-4 text-white/40 text-xs">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(financial?.payments || []).length === 0 && <p className="text-center text-white/40 py-8">No payment data</p>}
        </div>
      </div>
    </div>
  );
}