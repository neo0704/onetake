import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';
import { LoadingSpinner, PageHeader } from '../../components/shared';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function AdminReports() {
  const [financial, setFinancial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  if (loading) return <LoadingSpinner />;
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
        <div className="flex-1 sm:flex-none"><label className="label">Start Date</label><input type="date" className="input w-full" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div className="flex-1 sm:flex-none"><label className="label">End Date</label><input type="date" className="input w-full" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <div className="flex items-end"><button onClick={fetch} className="btn-primary w-full sm:w-auto justify-center">Apply</button></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(s.totalRevenue || 0), color: 'text-emerald-400' },
          { label: 'Downpayments', value: formatCurrency(s.downpayments || 0), color: 'text-blue-400' },
          { label: 'Balances Collected', value: formatCurrency(s.balances || 0), color: 'text-purple-400' },
          { label: 'Pending', value: formatCurrency(s.pendingAmount || 0), color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <p className="text-white/50 text-xs sm:text-sm">{label}</p>
            <p className={`text-lg sm:text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="section-title mb-4">Revenue Breakdown</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
            <Bar dataKey="value" fill="#e94560" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
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