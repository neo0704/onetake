import React, { useEffect, useState } from 'react';
import { Package, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, EmptyState, PageHeader, Modal } from '../../components/shared';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function AdminEquipmentRequests() {
  const [requests,     setRequests]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected,     setSelected]     = useState(null);
  const [reviewForm,   setReviewForm]   = useState({ status: 'approved', adminNote: '' });
  const [showModal,    setShowModal]    = useState(false);
  const [reviewing,    setReviewing]    = useState(false);

  // Confirm dialog
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', type: 'info', confirmLabel: 'Confirm', onConfirm: null, loading: false });
  const askConfirm = (opts) => setConfirm({ open: true, loading: false, ...opts });
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false, loading: false }));
  const runConfirm = async () => {
    setConfirm(c => ({ ...c, loading: true }));
    try { await confirm.onConfirm(); }
    finally { closeConfirm(); }
  };

  const fetchRequests = async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const { data } = await api.get('/equipment-requests', { params });
      setRequests(data.requests);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchRequests(); }, [statusFilter]);

  const openReview = (req) => {
    setSelected(req);
    setReviewForm({ status: 'approved', adminNote: '' });
    setShowModal(true);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewing(true);
    try {
      await api.put(`/equipment-requests/${selected._id}/review`, reviewForm);
      toast.success(`Request ${reviewForm.status}!`);
      setShowModal(false);
      fetchRequests();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setReviewing(false); }
  };

  const quickAction = (id, status, req) => {
    askConfirm({
      title: status === 'approved' ? 'Approve Request?' : 'Reject Request?',
      message: status === 'approved'
        ? `Approve ${req.freelancer?.name}'s request for "${req.itemName}" ×${req.quantity} on "${req.event?.eventName}"?`
        : `Reject ${req.freelancer?.name}'s request for "${req.itemName}"? They will be notified.`,
      type: status === 'approved' ? 'success' : 'danger',
      confirmLabel: status === 'approved' ? 'Yes, Approve' : 'Yes, Reject',
      onConfirm: async () => {
        await api.put(`/equipment-requests/${id}/review`, { status, adminNote: '' });
        toast.success(`Request ${status}!`);
        setRequests(prev => prev.map(r => r._id === id ? { ...r, status } : r));
      }
    });
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const statusColors = {
    pending:  'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Equipment Requests"
        subtitle={pendingCount > 0 ? `${pendingCount} pending review` : `${requests.length} total`} />

      {pendingCount > 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-400 font-medium">
            {pendingCount} equipment request{pendingCount > 1 ? 's' : ''} pending review
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors
              ${statusFilter === s ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            {s}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={Package} title="No equipment requests" description="Freelancer requests will appear here" />
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req._id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${req.status === 'approved' ? 'bg-green-500/20' : req.status === 'rejected' ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                    <Package className={`w-5 h-5 ${req.status === 'approved' ? 'text-green-400' : req.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold">{req.itemName}</h3>
                      <span className={`badge ${statusColors[req.status]}`}>{req.status}</span>
                    </div>
                    <p className="text-white/50 text-sm mt-0.5">
                      By <span className="text-white/70">{req.freelancer?.name}</span> · Qty: {req.quantity}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">{req.event?.eventName} · {formatDate(req.event?.eventDate)}</p>
                    {req.reason && <p className="text-white/40 text-xs mt-1 italic">"{req.reason}"</p>}
                    {req.adminNote && (
                      <p className={`text-xs mt-1 ${req.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
                        Note: {req.adminNote}
                      </p>
                    )}
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => quickAction(req._id, 'approved', req)}
                      className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors" title="Approve">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => openReview(req)}
                      className="px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-xs font-medium">
                      Review
                    </button>
                    <button onClick={() => quickAction(req._id, 'rejected', req)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors" title="Reject">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Review Equipment Request">
        {selected && (
          <form onSubmit={submitReview} className="space-y-4">
            <div className="p-3 bg-white/5 rounded-xl">
              <p className="text-white font-semibold">{selected.itemName} <span className="text-white/50 font-normal">×{selected.quantity}</span></p>
              <p className="text-white/50 text-sm">By {selected.freelancer?.name}</p>
              {selected.reason && <p className="text-white/40 text-xs mt-1 italic">"{selected.reason}"</p>}
            </div>
            <div>
              <label className="label">Decision</label>
              <div className="grid grid-cols-2 gap-2">
                {['approved', 'rejected'].map(s => (
                  <button key={s} type="button" onClick={() => setReviewForm(f => ({ ...f, status: s }))}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 capitalize
                      ${reviewForm.status === s
                        ? s === 'approved' ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-white/10 bg-white/5 text-white/50'}`}>
                    {s === 'approved' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Note <span className="text-white/30">(Optional)</span></label>
              <textarea className="input min-h-[80px]" value={reviewForm.adminNote}
                onChange={e => setReviewForm(f => ({ ...f, adminNote: e.target.value }))}
                placeholder={reviewForm.status === 'approved' ? 'e.g. Will be ready at venue by 8AM' : 'e.g. Already included in assignment'} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={reviewing}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2
                  ${reviewForm.status === 'approved' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                {reviewing ? 'Saving...' : reviewForm.status === 'approved' ? '✓ Approve' : '✗ Reject'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog isOpen={confirm.open} onClose={closeConfirm} onConfirm={runConfirm}
        title={confirm.title} message={confirm.message} type={confirm.type}
        confirmLabel={confirm.confirmLabel} loading={confirm.loading} />
    </div>
  );
}
