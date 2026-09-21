import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, Clock, Wrench, Calendar, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import api from '../../services/api';

const DAMAGE_COLOR = {
  minor:     { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  major:     { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  destroyed: { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/30'    },
  lost:      { bg: 'bg-red-900/20',    text: 'text-red-300',    border: 'border-red-700/40'    },
};

const STATUS_COLOR = {
  open:         { bg: 'bg-blue-500/10',  text: 'text-blue-400',  border: 'border-blue-500/30'  },
  under_review: { bg: 'bg-yellow-500/10',text: 'text-yellow-400',border: 'border-yellow-500/30'},
  resolved:     { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
};

const Badge = ({ label, colors }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
    {label}
  </span>
);

const StatusIcon = ({ status }) => {
  if (status === 'resolved')     return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (status === 'under_review') return <Clock className="w-4 h-4 text-yellow-400" />;
  return <AlertTriangle className="w-4 h-4 text-blue-400" />;
};

function ReportCard({ report }) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const dmg    = DAMAGE_COLOR[report.damageType] || DAMAGE_COLOR.minor;
  const status = STATUS_COLOR[report.status]     || STATUS_COLOR.open;

  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  return (
    <div className={`rounded-xl border bg-white/[0.03] backdrop-blur-sm transition-all duration-200 ${
      report.status === 'resolved' ? 'border-white/5 opacity-80' : 'border-white/10 hover:border-white/20'
    }`}>
      {/* Header row */}
      <div
        className="flex items-start gap-4 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Damage icon */}
        <div className={`mt-0.5 p-2 rounded-lg border ${dmg.bg} ${dmg.border} flex-shrink-0`}>
          <ShieldAlert className={`w-5 h-5 ${dmg.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-white font-semibold text-sm truncate">
              {report.equipment?.name || 'Unknown Equipment'}
            </span>
            <Badge label={report.damageType.toUpperCase()} colors={dmg} />
            <Badge label={report.status.replace('_', ' ').toUpperCase()} colors={status} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {report.event?.eventName || '—'}
            </span>
            <span className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              {report.equipment?.category || '—'}
            </span>
            <span>
              Reported {new Date(report.createdAt).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {report.deductFromPayroll && report.deductionAmount > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-white/40">Payroll deduction</p>
              <p className="text-sm font-bold text-red-400">
                −₱{report.deductionAmount.toLocaleString()}
              </p>
            </div>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-white/30" />
            : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-4">

          {/* Description */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-white/80 leading-relaxed">{report.description}</p>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <p className="text-xs text-white/40 mb-0.5">Repair Cost</p>
              <p className="text-sm font-semibold text-white">
                {report.repairCost > 0 ? `₱${report.repairCost.toLocaleString()}` : 'TBD'}
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <p className="text-xs text-white/40 mb-0.5">Payroll Deduction</p>
              <p className={`text-sm font-semibold ${report.deductFromPayroll ? 'text-red-400' : 'text-green-400'}`}>
                {report.deductFromPayroll
                  ? `−₱${report.deductionAmount.toLocaleString()}`
                  : 'None'}
              </p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <p className="text-xs text-white/40 mb-0.5">Reported By</p>
              <p className="text-sm font-semibold text-white">{report.reportedBy?.name || 'Admin'}</p>
            </div>
          </div>

          {/* Resolution note */}
          {report.status === 'resolved' && report.resolution && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-1">Resolution</p>
              <p className="text-sm text-white/70">{report.resolution}</p>
            </div>
          )}

          {/* Photos */}
          {report.photos?.length > 0 && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Photos
              </p>
              <div className="flex flex-wrap gap-2">
                {report.photos.map((src, i) => (
                  <img
                    key={i}
                    src={`${baseUrl}${src}`}
                    alt={`damage-${i}`}
                    className="w-20 h-20 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setLightbox(`${baseUrl}${src}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="damage" className="max-w-full max-h-[90vh] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}

export default function FreelancerDamageReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all'); // all | open | under_review | resolved

  useEffect(() => {
    api.get('/damage-reports/my')
      .then(r => setReports(r.data.reports || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all'
    ? reports
    : reports.filter(r => r.status === filter);

  const counts = {
    open:         reports.filter(r => r.status === 'open').length,
    under_review: reports.filter(r => r.status === 'under_review').length,
    resolved:     reports.filter(r => r.status === 'resolved').length,
  };

  const totalDeduction = reports
    .filter(r => r.deductFromPayroll)
    .reduce((s, r) => s + (r.deductionAmount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          Damage Reports
        </h1>
        <p className="text-sm text-white/40 mt-0.5">Equipment damage reports filed against you</p>
      </div>

      {/* Summary cards */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',        value: reports.length,   color: 'text-white'       },
            { label: 'Open',         value: counts.open,      color: 'text-blue-400'    },
            { label: 'Under Review', value: counts.under_review, color: 'text-yellow-400'},
            { label: 'Resolved',     value: counts.resolved,  color: 'text-green-400'   },
          ].map(c => (
            <div key={c.label} className="bg-white/[0.03] border border-white/8 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-white/40 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Payroll deduction warning */}
      {totalDeduction > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Payroll Deductions Pending</p>
            <p className="text-xs text-white/50 mt-0.5">
              A total of <span className="text-red-400 font-bold">₱{totalDeduction.toLocaleString()}</span> will be deducted from your payroll for damage costs.
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {reports.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {['all', 'open', 'under_review', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              {f !== 'all' && counts[f] > 0 && (
                <span className="ml-1.5 opacity-70">({counts[f]})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Report list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-green-400/30 mx-auto mb-3" />
          <p className="text-white/40 text-sm">
            {filter === 'all' ? 'No damage reports on your record.' : `No ${filter.replace('_', ' ')} reports.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => <ReportCard key={r._id} report={r} />)}
        </div>
      )}
    </div>
  );
}
