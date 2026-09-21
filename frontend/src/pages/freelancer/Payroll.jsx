import React, { useEffect, useState } from 'react';
import {
  TrendingUp, DollarSign, Clock, CheckCircle,
  Calendar, Briefcase, ChevronDown, ChevronUp, Award
} from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState } from '../../components/shared';
import { formatDate, formatCurrency } from '../../utils/helpers';
import useAuthStore from '../../store/authStore';

const STATUS_CONFIG = {
  draft:   { label: 'Processing',  icon: Clock,         color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   dot: 'bg-gray-400' },
  pending: { label: 'Ready',       icon: Clock,         color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: 'bg-yellow-400' },
  paid:    { label: 'Released',    icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400' },
};

function PayslipCard({ payroll }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[payroll.status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-2xl border ${cfg.border} overflow-hidden transition-all duration-300`}
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)' }}>

      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot} ${payroll.status !== 'paid' ? 'animate-pulse' : ''}`} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-white/40 text-xs">{payroll.payrollNumber}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-white font-bold text-base mt-1">
                {payroll.event?.eventName || 'General Payroll'}
              </p>
              {payroll.role && (
                <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                  <Briefcase className="w-3 h-3" /> {payroll.role}
                </p>
              )}
              <p className="text-white/30 text-xs flex items-center gap-1 mt-1 flex-wrap">
                <Calendar className="w-3 h-3" />
                {formatDate(payroll.period?.from || payroll.period?.to)}
                {payroll.paymentMethod && (
                  <span className="text-white/20">· {payroll.paymentMethod.replace('_', ' ')}</span>
                )}
              </p>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-white/40 text-xs">Net Pay</p>
            <p className={`text-xl sm:text-2xl font-black ${payroll.status === 'paid' ? 'text-green-400' : 'text-white'}`}>
              {formatCurrency(payroll.netPay)}
            </p>
            {payroll.status === 'paid' && payroll.paidAt && (
              <p className="text-green-400/60 text-xs mt-0.5">Released {formatDate(payroll.paidAt)}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-3">
          {[
            { label: 'Days Worked', value: `${payroll.daysWorked}d` },
            { label: 'Rate/Day', value: formatCurrency(payroll.ratePerDay) },
            { label: 'Gross Pay', value: formatCurrency(payroll.grossPay) },
          ].map(item => (
            <div key={item.label} className="bg-white/5 rounded-xl p-2 sm:p-2.5 text-center">
              <p className="text-white/30 text-[10px] sm:text-xs">{item.label}</p>
              <p className="text-white font-semibold text-xs sm:text-sm mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-white/30 hover:text-white/60 text-xs transition-colors border-t border-white/5">
        {open ? <><ChevronUp className="w-3.5 h-3.5" /> Hide Details</> : <><ChevronDown className="w-3.5 h-3.5" /> View Breakdown</>}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5">
          <div className="pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Gross Pay ({payroll.daysWorked}d × {formatCurrency(payroll.ratePerDay)})</span>
              <span className="text-white font-medium">{formatCurrency(payroll.grossPay)}</span>
            </div>

            {(payroll.bonuses || []).map((b, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-green-400/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  {b.label || 'Bonus'}
                </span>
                <span className="text-green-400">+{formatCurrency(b.amount)}</span>
              </div>
            ))}

            {(payroll.deductions || []).map((d, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-red-400/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  {d.label || 'Deduction'}
                </span>
                <span className="text-red-400">−{formatCurrency(d.amount)}</span>
              </div>
            ))}

            <div className="flex justify-between text-base font-black pt-3 border-t border-white/10">
              <span className="text-white">Net Pay</span>
              <span className={payroll.status === 'paid' ? 'text-green-400' : 'text-primary'}>
                {formatCurrency(payroll.netPay)}
              </span>
            </div>
          </div>

          {payroll.status === 'paid' && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-green-400 font-semibold text-sm">Payment Released</p>
                  <p className="text-green-400/60 text-xs">
                    via {payroll.paymentMethod?.replace('_', ' ')}
                    {payroll.referenceNumber && ` · Ref: ${payroll.referenceNumber}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {payroll.notes && (
            <div className="p-3 bg-white/5 rounded-xl">
              <p className="text-white/40 text-xs font-medium mb-0.5">Note from Admin</p>
              <p className="text-white/60 text-sm">{payroll.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FreelancerPayroll() {
  const { user } = useAuthStore();
  const [payrolls, setPayrolls] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');

  useEffect(() => {
    const fetchPayrolls = async () => {
      try {
        // FIXED: Use the correct endpoint that your backend supports
        const res = await api.get('/payroll');
        setPayrolls(res.data.payrolls || []);
      } catch (err) {
        console.error(err);
        // toast.error('Failed to load payrolls');
      } finally {
        setLoading(false);
      }
    };

    fetchPayrolls();
  }, []);

  if (loading) return <LoadingSpinner />;

  const filtered = filter === 'all' 
    ? payrolls 
    : payrolls.filter(p => p.status === filter);

  const totalEarned  = payrolls.filter(p => p.status === 'paid').reduce((s, p) => s + (p.netPay || 0), 0);
  const totalPending = payrolls.filter(p => p.status === 'pending').reduce((s, p) => s + (p.netPay || 0), 0);
  const totalJobs    = payrolls.filter(p => p.status === 'paid').length;

  const counts = {
    all:     payrolls.length,
    pending: payrolls.filter(p => p.status === 'pending').length,
    paid:    payrolls.filter(p => p.status === 'paid').length,
    draft:   payrolls.filter(p => p.status === 'draft').length,
  };

  const methodBreakdown = payrolls
    .filter(p => p.status === 'paid')
    .reduce((acc, p) => {
      const key = p.paymentMethod || 'other';
      acc[key] = (acc[key] || 0) + (p.netPay || 0);
      return acc;
    }, {});

  const filterOptions = [
    { key: 'all',     label: 'All' },
    { key: 'pending', label: 'Ready' },
    { key: 'paid',    label: 'Paid' },
    { key: 'draft',   label: 'Processing' },
  ];

  const filterPanel = (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Filter</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 lg:overflow-visible lg:pb-0 lg:flex-col lg:gap-1 lg:mx-0 lg:px-0">
        {filterOptions.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`flex-shrink-0 flex items-center gap-2 lg:w-full lg:justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors
              ${filter === key ? 'bg-primary text-white' : 'text-white/60 bg-white/5 lg:bg-transparent hover:bg-white/10 hover:text-white'}`}>
            <span>{label}</span>
            <span className={`text-xs ${filter === key ? 'text-white/80' : 'text-white/30'}`}>{counts[key]}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-fade-in grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* Main column */}
      <div className="space-y-6 min-w-0">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl p-6"
          style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
          <div className="absolute inset-0 opacity-30"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(233,69,96,0.3) 0%, transparent 60%)' }} />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/20 border border-primary/30 rounded-2xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-white font-black text-xl">My Payroll</h1>
              <p className="text-white/40 text-sm">Your earnings & compensation</p>
            </div>
          </div>
        </div>

        {/* Filter — shown here on mobile only, right under the header */}
        <div className="lg:hidden">{filterPanel}</div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/50 font-semibold">No payroll records yet</p>
            <p className="text-white/30 text-sm mt-1">
              {filter === 'all' ? 'Your payslips will appear here once processed' : `No ${filter} payrolls`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(p => <PayslipCard key={p._id} payroll={p} />)}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {/* Overview stats */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Overview</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Total Earned</span>
              <span className="text-green-400 font-bold">{formatCurrency(totalEarned)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Incoming</span>
              <span className="text-yellow-400 font-bold">{formatCurrency(totalPending)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Payslips</span>
              <span className="text-white font-bold">{totalJobs}</span>
            </div>
          </div>
        </div>

        {/* Filters — shown here on desktop only (mobile copy is above the card list) */}
        <div className="hidden lg:block">{filterPanel}</div>

        {/* Payment method breakdown */}
        {Object.keys(methodBreakdown).length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Paid Via</p>
            <div className="space-y-2">
              {Object.entries(methodBreakdown).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between text-sm">
                  <span className="text-white/50 capitalize">{method.replace('_', ' ')}</span>
                  <span className="text-white/80 font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}