import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, CheckCircle, XCircle, Send,
  Plus, Trash2, Save, Users, Wrench,
  Calendar, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, StatusBadge, Modal } from '../../components/shared';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import AssessmentTab     from '../../components/AssessmentTab';
import MeetingScheduleCard from '../../components/MeetingScheduleCard';
import ProjectTimeline   from '../../components/ProjectTimeline';
import { formatDate, formatCurrency, STATUS_LABELS } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_ORDER = [
  'inquiry_received', 'inquiry_accepted', 'meeting_scheduled',
  'needs_assessed', 'quotation_sent', 'confirmed', 'downpayment_paid',
  'assigned', 'in_progress', 'completed_pending_balance', 'completed_paid',
];

const COMPLETED = ['completed_paid', 'completed_pending_balance', 'cancelled'];

const ROLES = [
  'Camera Operator', 'Videographer', 'Photographer', 'Livestream Operator',
  'Video Editor', 'Audio Engineer', 'Lighting Technician', 'Technical Director',
  'Drone Pilot', 'Stream Operator', 'Director of Photography',
];

const getTabs = (status) => {
  const tabs = ['overview'];
  if (['inquiry_accepted', 'meeting_scheduled'].includes(status)) tabs.push('meeting');
  if (['needs_assessed', 'quotation_sent', 'confirmed', 'assigned',
       'in_progress', 'completed_pending_balance', 'completed_paid'].includes(status)) {
    tabs.push('assessment');
  }
  if (['confirmed', 'downpayment_paid', 'assigned', 'in_progress',
       'completed_pending_balance', 'completed_paid'].includes(status)) {
    tabs.push('assignment', 'checklist', 'chat');
  }
  return tabs;
};

export default function AdminEventDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [event,              setEvent]              = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [saving,             setSaving]             = useState(false);
  const [tab,                setTab]                = useState('overview');
  const [msgInput,           setMsgInput]           = useState('');
  const [equipment,          setEquipment]          = useState([]);
  const [freelancers,        setFreelancers]        = useState([]);
  const [assignedFreelancers,setAssignedFreelancers]= useState([]);
  const [expandedFr,         setExpandedFr]         = useState(null);
  const [newCheckItem,       setNewCheckItem]       = useState('');
  const [paymentSummary,     setPaymentSummary]     = useState(null);
  const [showPayWarn,        setShowPayWarn]        = useState(false);

  const [confirm, setConfirm] = useState({
    open: false, title: '', message: '', type: 'warning',
    confirmLabel: 'Confirm', onConfirm: null, loading: false,
  });
  const askConfirm  = (opts) => setConfirm({ open: true, loading: false, ...opts });
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false, loading: false }));
  const runConfirm  = async () => {
    setConfirm(c => ({ ...c, loading: true }));
    try { await confirm.onConfirm(); } finally { closeConfirm(); }
  };

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${id}`);
      const ev = data.event;
      setEvent(ev);
      setAssignedFreelancers(
        (ev.assignedFreelancers || []).map(af => ({
          freelancer: af.freelancer?._id || af.freelancer,
          role:       af.role || '',
          equipment:  (af.equipment || []).map(eq => ({
            equipment: eq.equipment?._id || eq.equipment,
            quantity:  eq.quantity || 1,
          })),
        }))
      );
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  useEffect(() => {
    api.get('/equipment').then(r => setEquipment(r.data.equipment || []));
    api.get('/users?role=freelancer').then(r => setFreelancers(r.data.users || []));
  }, []);

  // Fetch payment summary when tab changes to assignment
  useEffect(() => {
    if (tab === 'assignment' && event) {
      api.get(`/payments/summary/${event._id}`)
        .then(r => setPaymentSummary(r.data.summary))
        .catch(() => setPaymentSummary(null));
    }
  }, [tab, event]);

  const updateStatus = async (newStatus) => {
    try {
      await api.put(`/events/${id}/status`, { status: newStatus });
      toast.success(`Status updated`);
      fetchEvent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const saveAssessment = async (formData) => {
    setSaving(true);
    try {
      await api.put(`/events/${id}/needs-assessment`, formData);
      toast.success('Assessment saved. Packages will auto-fill the quotation.');
      fetchEvent();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving assessment'); }
    finally { setSaving(false); }
  };

  const doSaveAssignment = async () => {
    setSaving(true);
    try {
      await api.put(`/events/${id}/assign`, { assignedFreelancers });
      toast.success('Team and equipment assigned.');
      fetchEvent();
      setShowPayWarn(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const saveAssignment = async () => {
    // Check for 50% downpayment
    const total    = paymentSummary?.totalAmount || 0;
    const paid     = paymentSummary?.totalPaid   || 0;
    const required = total * 0.5;

    if (total > 0 && paid < required) {
      // Show warning but allow override
      setShowPayWarn(true);
      return;
    }
    doSaveAssignment();
  };

  const toggleEquip = (fId, eqId) => {
    const eqInfo = equipment.find(e => e._id === eqId);
    const dbQty  = eqInfo?.quantity || 1;
    setAssignedFreelancers(prev => prev.map(af => {
      if (af.freelancer !== fId) return af;
      const has = af.equipment.find(e => e.equipment === eqId);
      return has
        ? { ...af, equipment: af.equipment.filter(e => e.equipment !== eqId) }
        : { ...af, equipment: [...af.equipment, { equipment: eqId, quantity: dbQty }] };
    }));
  };

  const addFreelancer = (fr) => {
    if (assignedFreelancers.find(af => af.freelancer === fr._id)) {
      toast.error(`${fr.name} is already in the team`); return;
    }
    setAssignedFreelancers(prev => [...prev, { freelancer: fr._id, role: '', equipment: [] }]);
    setExpandedFr(fr._id);
  };

  const removeFreelancer = (fId) => {
    setAssignedFreelancers(prev => prev.filter(af => af.freelancer !== fId));
    if (expandedFr === fId) setExpandedFr(null);
  };

  const setRole = (fId, role) =>
    setAssignedFreelancers(prev => prev.map(af => af.freelancer === fId ? { ...af, role } : af));

  const addCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    try {
      await api.post(`/events/${id}/checklist`, { item: newCheckItem });
      setNewCheckItem(''); fetchEvent();
    } catch { toast.error('Failed to add'); }
  };

  const toggleCheckItem = async (itemId) => {
    try { await api.put(`/events/${id}/checklist/${itemId}`); fetchEvent(); }
    catch { toast.error('Failed'); }
  };

  const deleteCheckItem = async (itemId) => {
    try { await api.delete(`/events/${id}/checklist/${itemId}`); fetchEvent(); }
    catch { toast.error('Failed'); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    await api.post(`/events/${id}/messages`, { content: msgInput });
    setMsgInput(''); fetchEvent();
  };

  if (loading) return <LoadingSpinner />;
  if (!event)  return <div className="text-white/50 p-8">Event not found</div>;

  const tabs    = getTabs(event.status);
  const isEnded = COMPLETED.includes(event.status);
  const services = event.services || {};

  // Keep tab valid
  const activeTab = tabs.includes(tab) ? tab : 'overview';

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/admin/events')} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{event.eventName}</h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-white/50 text-sm mt-0.5">
            {event.client?.name} · {formatDate(event.eventDate)} · {event.location}
          </p>
        </div>

        {/* Context action buttons */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">

          {event.status === 'inquiry_received' && (<>
            <button onClick={() => askConfirm({
              title: 'Accept Inquiry?',
              message: `Accept the inquiry from ${event.client?.name} for "${event.eventName}"? You will then schedule a needs assessment meeting.`,
              type: 'success', confirmLabel: 'Yes, Accept',
              onConfirm: () => updateStatus('inquiry_accepted'),
            })} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">
              Accept
            </button>
            <button onClick={() => askConfirm({
              title: 'Decline Inquiry?',
              message: `Decline "${event.eventName}" from ${event.client?.name}?`,
              type: 'danger', confirmLabel: 'Yes, Decline',
              onConfirm: () => updateStatus('cancelled'),
            })} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30">
              Decline
            </button>
          </>)}

          {/* Assessment saved — show Create Quotation */}
          {event.status === 'needs_assessed' && event.needsAssessment?.assessedAt && (
            <button onClick={() => navigate(`/admin/quotations/create/${event._id}`)}
              className="btn-primary text-sm">
              <FileText className="w-4 h-4" /> Create Quotation
            </button>
          )}

          {/* Assessment not yet saved */}
          {event.status === 'needs_assessed' && !event.needsAssessment?.assessedAt && (
            <button onClick={() => setTab('assessment')} className="btn-secondary text-sm">
              <FileText className="w-4 h-4" /> Fill Assessment First
            </button>
          )}

          {event.status === 'confirmed' && (
            <button onClick={() => askConfirm({
              title: 'Mark Downpayment as Paid?',
              message: 'Confirm that the 50% downpayment has been received from the client?',
              type: 'success', confirmLabel: 'Yes, Confirm Payment',
              onConfirm: () => updateStatus('downpayment_paid'),
            })} className="btn-primary text-sm">
              <CheckCircle className="w-4 h-4" /> Mark Downpayment Paid
            </button>
          )}

          {event.status === 'downpayment_paid' && (
            <button onClick={() => setTab('assignment')} className="btn-primary text-sm">
              <Users className="w-4 h-4" /> Assign Team
            </button>
          )}

          {event.status === 'assigned' && (
            <button onClick={() => askConfirm({
              title: 'Start Event?',
              message: 'Mark this event as In Progress?',
              type: 'info', confirmLabel: 'Yes, Start',
              onConfirm: () => updateStatus('in_progress'),
            })} className="btn-primary text-sm">
              Start Event
            </button>
          )}

          {event.status === 'in_progress' && (
            <button onClick={() => askConfirm({
              title: 'Complete Event?',
              message: 'Mark as completed pending balance? The client will be notified to pay the remaining amount.',
              type: 'success', confirmLabel: 'Yes, Complete',
              onConfirm: () => updateStatus('completed_pending_balance'),
            })} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">
              Complete Event
            </button>
          )}

          {event.status === 'completed_pending_balance' && (
            <button onClick={() => askConfirm({
              title: 'Mark as Fully Paid?',
              message: 'Confirm that the full balance has been received?',
              type: 'success', confirmLabel: 'Yes, Mark Paid',
              onConfirm: () => updateStatus('completed_paid'),
            })} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">
              Mark Fully Paid
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px
              ${activeTab === t ? 'text-primary border-primary' : 'text-white/50 border-transparent hover:text-white'}`}>
            {t === 'assessment' ? 'Assessment' :
             t === 'meeting'    ? 'Meeting Schedule' :
             t === 'assignment' ? 'Team Assignment' :
             t === 'checklist'  ? 'Checklist' :
             t === 'chat'       ? 'Chat' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title mb-4">Event Details</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Event Name', event.eventName],
                ['Client',     event.client?.name],
                ['Date',       formatDate(event.eventDate)],
                ['Location',   event.location],
                ['Attendees',  event.needsAssessment?.attendees || event.attendees || '—'],
                ['Type',       event.needsAssessment?.videoType || event.videoType || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-white/40 text-xs">{k}</dt>
                  <dd className="text-white font-medium mt-0.5">{v || '—'}</dd>
                </div>
              ))}
            </dl>

            {Object.values(services).some(Boolean) && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Requested Services</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(services).filter(([,v]) => v).map(([k]) => (
                    <span key={k} className="badge bg-blue-500/20 text-blue-300 text-xs">
                      {k === 'liveStreaming'        ? 'Multi-Camera Live Coverage'    :
                       k === 'documentation'        ? 'Digital Documentation'         :
                       k === 'weddingDebut'         ? 'Wedding / Debut / Birthday'    :
                       k === 'virtualLivestreaming' ? 'Remote & Virtual Livestreaming':
                       k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {event.specialRequests && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Special Requests</p>
                <p className="text-white/70 text-sm">{event.specialRequests}</p>
              </div>
            )}

            {event.meetingPreference?.type && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Client Meeting Preference</p>
                <div className="flex flex-wrap gap-3 text-xs text-white/60">
                  <span className="badge bg-white/10 text-white">
                    {event.meetingPreference.type === 'ftf' ? 'Face-to-Face' : 'Online Meeting'}
                  </span>
                  {event.meetingPreference.preferredDate && (
                    <span>{formatDate(event.meetingPreference.preferredDate)}
                      {event.meetingPreference.preferredTime ? ` at ${event.meetingPreference.preferredTime}` : ''}
                    </span>
                  )}
                  {event.meetingPreference.preferredLocation && (
                    <span>{event.meetingPreference.preferredLocation}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {['inquiry_accepted', 'meeting_scheduled'].includes(event.status) && (
            <MeetingScheduleCard event={event} onUpdate={fetchEvent} />
          )}

          {/* Project Timeline */}
          <ProjectTimeline event={event} />

          {(event.assignedFreelancers || []).length > 0 && (
            <div className="card">
              <h3 className="section-title mb-3">Assigned Team</h3>
              <div className="space-y-2">
                {event.assignedFreelancers.map((af, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                      {(af.freelancer?.name || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{af.freelancer?.name}</p>
                      <p className="text-white/40 text-xs">{af.role || 'No role set'}</p>
                    </div>
                    <span className="text-white/30 text-xs">{(af.equipment || []).length} item(s)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MEETING TAB ═══ */}
      {activeTab === 'meeting' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-400 font-semibold text-sm">Schedule the Needs Assessment Meeting</p>
            <p className="text-blue-400/70 text-xs mt-1">
              Review the client's preferred schedule and confirm the meeting details.
              Once confirmed, the client will be notified. After the meeting, click Mark as Done to unlock the Assessment tab.
            </p>
          </div>
          <MeetingScheduleCard event={event} onUpdate={fetchEvent} />
        </div>
      )}

      {/* ═══ ASSESSMENT TAB ═══ */}
      {activeTab === 'assessment' && (
        <div className="space-y-4">
          {event.status === 'needs_assessed' && !event.needsAssessment?.assessedAt && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
              <p className="text-primary font-semibold text-sm">Fill in the Needs Assessment</p>
              <p className="text-white/50 text-xs mt-1">
                Record what was discussed in the meeting — select the exact packages agreed with the client.
                These will automatically fill the quotation. The quotation button only appears after you save this assessment.
              </p>
            </div>
          )}
          {event.needsAssessment?.assessedAt && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between gap-4">
              <div>
                <p className="text-green-400 font-semibold text-sm">Assessment Saved</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {event.needsAssessment.selectedPackages?.length || 0} package(s) selected — will auto-fill the quotation.
                </p>
              </div>
              {event.status === 'needs_assessed' && (
                <button onClick={() => navigate(`/admin/quotations/create/${event._id}`)}
                  className="btn-primary text-sm flex-shrink-0">
                  <FileText className="w-4 h-4" /> Create Quotation
                </button>
              )}
            </div>
          )}
          <AssessmentTab event={event} saving={saving} onSave={saveAssessment} />
        </div>
      )}

      {/* ═══ ASSIGNMENT TAB ═══ */}
      {activeTab === 'assignment' && (
        <div className="space-y-4">

          {/* Payment warning banner */}
          {paymentSummary && paymentSummary.totalAmount > 0 &&
           (paymentSummary.totalPaid || 0) < (paymentSummary.totalAmount * 0.5) && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-semibold text-sm">No Downpayment Received</p>
                <p className="text-yellow-400/70 text-xs mt-1">
                  The 50% downpayment of {formatCurrency((paymentSummary.totalAmount || 0) * 0.5)} has not been received yet.
                  Paid so far: {formatCurrency(paymentSummary.totalPaid || 0)}.
                  You can still assign the team but it is recommended to wait for the downpayment first.
                </p>
              </div>
            </div>
          )}

          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/50 text-xs">
            Click a freelancer to add them, set their role, tick the equipment they will use, then save.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Available freelancers */}
            <div className="card">
              <h3 className="section-title mb-3">Available Freelancers</h3>
              <div className="space-y-2">
                {freelancers.filter(fr => (fr.availability || 'available') === 'available').map(fr => (
                  <button key={fr._id} onClick={() => addFreelancer(fr)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 transition-all text-left">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                      {fr.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{fr.name}</p>
                      <p className="text-white/40 text-xs">{(fr.skills || []).slice(0, 2).join(', ') || 'No skills listed'}</p>
                    </div>
                    <Plus className="w-4 h-4 text-white/30 flex-shrink-0" />
                  </button>
                ))}
                {freelancers.filter(fr => (fr.availability || 'available') === 'available').length === 0 && (
                  <p className="text-white/30 text-sm text-center py-4">No available freelancers</p>
                )}
              </div>
            </div>

            {/* Team being built */}
            <div className="card">
              <h3 className="section-title mb-3">Team ({assignedFreelancers.length})</h3>
              {assignedFreelancers.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">No team members yet</p>
              ) : (
                <div className="space-y-3">
                  {assignedFreelancers.map(af => {
                    const frInfo = freelancers.find(f => f._id === af.freelancer);
                    const isOpen = expandedFr === af.freelancer;
                    return (
                      <div key={af.freelancer} className="border border-white/10 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 p-3 bg-white/5">
                          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                            {(frInfo?.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm">{frInfo?.name}</p>
                            <p className="text-white/40 text-xs">{af.equipment.length} equipment assigned</p>
                          </div>
                          <button onClick={() => setExpandedFr(isOpen ? null : af.freelancer)} className="btn-ghost p-1">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <button onClick={() => removeFreelancer(af.freelancer)} className="text-white/20 hover:text-red-400 p-1">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>

                        {isOpen && (
                          <div className="p-3 border-t border-white/10 space-y-3">
                            <div>
                              <label className="label">Role / Position</label>
                              <select className="input text-sm" value={af.role} onChange={e => setRole(af.freelancer, e.target.value)}>
                                <option value="">Select role...</option>
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label">Equipment Assigned</label>
                              <div className="max-h-48 overflow-y-auto space-y-1 border border-white/10 rounded-xl p-2">
                                {equipment.map(eq => {
                                  const assigned = af.equipment.find(e => e.equipment === eq._id);
                                  return (
                                    <div key={eq._id}
                                      onClick={() => toggleEquip(af.freelancer, eq._id)}
                                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all
                                        ${assigned ? 'bg-primary/20 border border-primary/30' : 'hover:bg-white/5 border border-transparent'}`}>
                                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                                        ${assigned ? 'border-primary bg-primary' : 'border-white/30'}`}>
                                        {assigned && <CheckCircle className="w-3 h-3 text-white" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-medium ${assigned ? 'text-white' : 'text-white/60'}`}>{eq.name}</p>
                                        <p className="text-white/30 text-xs capitalize">{eq.category}</p>
                                      </div>
                                      {assigned && <span className="text-primary text-xs font-bold">x{assigned.quantity}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {assignedFreelancers.length > 0 && (
            <button onClick={saveAssignment} disabled={saving} className="btn-primary w-full justify-center py-3">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : `Save Assignment (${assignedFreelancers.length} member${assignedFreelancers.length !== 1 ? 's' : ''})`}
            </button>
          )}
        </div>
      )}

      {/* ═══ CHECKLIST TAB ═══ */}
      {activeTab === 'checklist' && (
        <div className="card">
          <h3 className="section-title mb-4">Pre-Event Checklist</h3>
          {!isEnded && (
            <div className="flex gap-2 mb-4">
              <input className="input flex-1" placeholder="Add checklist item..."
                value={newCheckItem}
                onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCheckItem()} />
              <button onClick={addCheckItem} className="btn-primary px-4"><Plus className="w-4 h-4" /></button>
            </div>
          )}
          <div className="space-y-2">
            {(event.preEventChecklist || []).length === 0 && (
              <p className="text-white/40 text-sm text-center py-8">No checklist items yet</p>
            )}
            {(event.preEventChecklist || []).map(item => (
              <div key={item._id}
                className={`flex items-center gap-3 p-3 rounded-xl border
                  ${item.completed ? 'border-green-500/20 bg-green-500/5' : 'border-white/10 bg-white/5'}`}>
                <input type="checkbox" checked={item.completed}
                  onChange={() => toggleCheckItem(item._id)}
                  className="w-4 h-4 accent-primary flex-shrink-0" />
                <span className={`flex-1 text-sm ${item.completed ? 'line-through text-white/40' : 'text-white'}`}>
                  {item.item}
                </span>
                {!isEnded && (
                  <button onClick={() => deleteCheckItem(item._id)}
                    className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {(event.preEventChecklist || []).length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between text-xs text-white/50 mb-1.5">
                <span>Progress</span>
                <span>{event.preEventChecklist.filter(i => i.completed).length} / {event.preEventChecklist.length} completed</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(event.preEventChecklist.filter(i => i.completed).length / event.preEventChecklist.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ CHAT TAB ═══ */}
      {activeTab === 'chat' && (
        <div className="card flex flex-col" style={{ height: '500px' }}>
          <h3 className="section-title mb-4">Project Chat</h3>
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {(event.messages || []).length === 0 && (
              <p className="text-white/40 text-sm text-center py-10">No messages yet</p>
            )}
            {(event.messages || []).map((msg, i) => {
              const isAdmin = msg.senderRole === 'admin';
              return (
                <div key={i} className={`flex gap-2 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {(msg.senderName || '?')[0].toUpperCase()}
                  </div>
                  <div className={`max-w-[75%] flex flex-col gap-0.5 ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-white/40">{msg.senderName}</span>
                    <div className={`rounded-2xl px-4 py-2 text-sm
                      ${isAdmin ? 'bg-primary text-white rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t border-white/10">
            <input className="input flex-1" value={msgInput}
              onChange={e => setMsgInput(e.target.value)} placeholder="Type a message..." />
            <button type="submit" className="btn-primary px-4">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Payment warning modal */}
      <Modal isOpen={showPayWarn} onClose={() => setShowPayWarn(false)} title="No Downpayment Received">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-semibold text-sm">50% Downpayment Not Yet Received</p>
              <p className="text-yellow-400/70 text-xs mt-1">
                The required downpayment of {formatCurrency((paymentSummary?.totalAmount || 0) * 0.5)} has not been received.
                It is recommended to wait for payment confirmation before assigning the team.
              </p>
              <p className="text-white/50 text-xs mt-2">
                Paid so far: {formatCurrency(paymentSummary?.totalPaid || 0)} of {formatCurrency(paymentSummary?.totalAmount || 0)}
              </p>
            </div>
          </div>
          <p className="text-white/60 text-sm">Would you still like to proceed with the assignment?</p>
          <div className="flex gap-3">
            <button onClick={() => setShowPayWarn(false)} className="btn-secondary flex-1 justify-center">
              Cancel — Wait for Payment
            </button>
            <button onClick={doSaveAssignment} disabled={saving}
              className="flex-1 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              {saving ? 'Saving...' : 'Proceed Anyway'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirm.open} onClose={closeConfirm} onConfirm={runConfirm}
        title={confirm.title} message={confirm.message} type={confirm.type}
        confirmLabel={confirm.confirmLabel} loading={confirm.loading}
      />
    </div>
  );
}
