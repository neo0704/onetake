/**
 * ProjectTimeline.jsx
 *
 * Shows every step of the project workflow with:
 *   - Whether it's done (green checkmark + date/time + who did it)
 *   - Current step (pulsing indicator)
 *   - Upcoming steps (grayed out with expected actions, collapsible)
 *   - Any notes recorded at each step
 *
 * Usage in admin AND client EventDetail overview tab:
 *   import ProjectTimeline from '../../components/ProjectTimeline';
 *   <ProjectTimeline event={event} />
 */

import React, { useState } from 'react';
import { Check, Clock, Circle, User, X, ChevronDown, ChevronUp } from 'lucide-react';

const fmtDateTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

const fmtRelative = (d) => {
  if (!d) return '';
  const diffDays = Math.round((Date.now() - new Date(d).getTime()) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const months = Math.round(diffDays / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}yr ago`;
};

// All steps in order with descriptions of what happens at each
const ALL_STEPS = [
  {
    status:      'inquiry_received',
    label:       'Inquiry Received',
    description: 'Client submitted their project inquiry with event details and service preferences.',
    role:        'Client',
  },
  {
    status:      'inquiry_accepted',
    label:       'Inquiry Accepted',
    description: 'Admin reviewed and accepted the inquiry. Client was notified.',
    role:        'Admin',
  },
  {
    status:      'meeting_scheduled',
    label:       'Meeting Scheduled',
    description: 'Needs assessment meeting scheduled with the client to discuss requirements and packages.',
    role:        'Admin',
  },
  {
    status:      'needs_assessed',
    label:       'Needs Assessment Completed',
    description: 'Requirements confirmed. Packages agreed with client. Ready to create quotation.',
    role:        'Admin',
  },
  {
    status:      'quotation_sent',
    label:       'Quotation Sent',
    description: 'Custom quotation prepared based on assessment and sent to client for approval.',
    role:        'Admin',
  },
  {
    status:      'confirmed',
    label:       'Quotation Approved',
    description: 'Client approved the quotation. 50% downpayment required to confirm booking.',
    role:        'Client',
  },
  {
    status:      'downpayment_paid',
    label:       'Downpayment Paid (50%)',
    description: '50% downpayment received and confirmed. Booking is secured and team assignment can proceed.',
    role:        'Client / Admin',
  },
  {
    status:      'assigned',
    label:       'Team Assigned',
    description: 'Freelancers and equipment assigned to the project. Team has been notified.',
    role:        'Admin',
  },
  {
    status:      'in_progress',
    label:       'Event In Progress',
    description: 'Event is currently happening. Team is on-site and executing the project.',
    role:        'Admin',
  },
  {
    status:      'completed_pending_balance',
    label:       'Event Completed',
    description: 'Event successfully completed. Client needs to pay the remaining 50% balance.',
    role:        'Admin',
  },
  {
    status:      'completed_paid',
    label:       'Fully Paid',
    description: 'Final payment received. Project fully closed.',
    role:        'Client / Admin',
  },
];

const CANCELLED_STEP = {
  status:      'cancelled',
  label:       'Cancelled',
  description: 'This project was cancelled.',
  role:        'Admin',
};

const ROLE_STYLES = {
  'Client':        'bg-sky-500/10 text-sky-300',
  'Admin':         'bg-violet-500/10 text-violet-300',
  'Client / Admin': 'bg-amber-500/10 text-amber-300',
};

export default function ProjectTimeline({ event }) {
  const [expanded, setExpanded] = useState(false);

  if (!event) return null;

  const isCancelled = event.status === 'cancelled';

  // Build a map of completed steps from event.timeline
  const timelineMap = {};
  (event.timeline || []).forEach(entry => {
    timelineMap[entry.status] = entry;
  });

  // Also mark inquiry_received as done with createdAt
  if (!timelineMap.inquiry_received && event.createdAt) {
    timelineMap.inquiry_received = {
      status:      'inquiry_received',
      label:       'Inquiry Received',
      completedAt: event.createdAt,
      doneByName:  event.client?.name || 'Client',
      note:        '',
    };
  }

  // When cancelled, only show steps that actually happened, then the
  // cancellation itself — no point graying out a full unreached workflow.
  let steps = ALL_STEPS;
  if (isCancelled) {
    const doneIndices = ALL_STEPS
      .map((s, i) => (timelineMap[s.status] ? i : -1))
      .filter(i => i >= 0);
    const lastDoneIdx = doneIndices.length ? Math.max(...doneIndices) : -1;
    steps = [...ALL_STEPS.slice(0, lastDoneIdx + 1), CANCELLED_STEP];
  }

  const statusOrder      = steps.map(s => s.status);
  const currentStatusIdx = statusOrder.indexOf(event.status);

  // Precompute done/current state once, shared by the progress bar and the list
  const stepStates = steps.map((step, idx) => {
    const entry       = timelineMap[step.status];
    const isCancelStep = isCancelled && step.status === 'cancelled';
    const isDone       = isCancelStep
      ? !!entry
      : !!entry || (!isCancelled && currentStatusIdx >= idx);
    const isCurrent = !isDone && !isCancelled && idx === currentStatusIdx + 1;
    return { step, entry, idx, isDone, isCurrent, isCancelStep };
  });

  const completedCount = stepStates.filter(s => s.isDone).length;
  const percent = Math.round((completedCount / steps.length) * 100);

  // Collapse far-future pending steps by default — show done steps, the
  // current step, and one step ahead; the rest fold behind a toggle.
  const cutoffIdx = isCancelled
    ? steps.length - 1
    : Math.min(currentStatusIdx + 2, steps.length - 1);
  const visibleStates = expanded ? stepStates : stepStates.slice(0, cutoffIdx + 1);
  const hiddenCount = stepStates.length - visibleStates.length;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title">Project Timeline</h3>
          <p className="text-white/40 text-xs mt-0.5">
            {completedCount} of {steps.length} steps completed
          </p>
        </div>
        <span className="text-primary text-lg font-semibold">{percent}%</span>
      </div>

      {/* Segmented progress — one tick per step, so the bar itself reads as the sequence */}
      <div className="flex items-center gap-1 mb-5" role="img" aria-label={`${percent}% complete`}>
        {stepStates.map(({ step, isDone, isCurrent, isCancelStep }) => (
          <div
            key={step.status}
            title={step.label}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500
              ${isCancelStep ? 'bg-red-500'
                : isDone ? 'bg-green-500'
                : isCurrent ? 'bg-primary animate-pulse'
                : 'bg-white/10'}`}
          />
        ))}
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {visibleStates.map(({ step, entry, isDone, isCurrent, isCancelStep }, i) => {
          const isLast = i === visibleStates.length - 1 && hiddenCount === 0;

          return (
            <div key={step.status} className="flex gap-3">
              {/* Left: connector line + icon */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 text-sm transition-all
                  ${isCancelStep
                    ? 'bg-red-500/15 border-red-500/50'
                    : isDone
                      ? 'bg-green-500/15 border-green-500/50'
                      : isCurrent
                        ? 'bg-primary/15 border-primary animate-pulse'
                        : 'bg-white/5 border-white/15 opacity-50'}`}>
                  {isCancelStep ? (
                    <X className="w-4 h-4 text-red-400" />
                  ) : isCurrent ? (
                    <Clock className="w-4 h-4 text-primary" />
                  ) : isDone ? (
                    <Check className="w-4 h-4 text-green-400" strokeWidth={3} />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-white/20" />
                  )}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 min-h-[16px] ${isDone ? 'bg-green-500/40' : 'bg-white/10'}`} />
                )}
              </div>

              {/* Right: content */}
              <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
                <div className={`p-3 rounded-xl border transition-all
                  ${isCancelStep
                    ? 'border-red-500/20 bg-red-500/5'
                    : isDone
                      ? 'border-green-500/20 bg-green-500/5'
                      : isCurrent
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-white/5 bg-white/2 opacity-50'}`}>

                  {/* Step header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold
                          ${isCancelStep ? 'text-red-300' : isDone ? 'text-white' : isCurrent ? 'text-primary' : 'text-white/40'}`}>
                          {step.label}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                          ${isCancelStep ? 'bg-red-500/20 text-red-300'
                            : isDone ? 'bg-green-500/20 text-green-400'
                            : isCurrent ? 'bg-primary/20 text-primary'
                            : 'bg-white/5 text-white/30'}`}>
                          {isCancelStep ? 'Cancelled' : isDone ? 'Done' : isCurrent ? 'Current' : 'Pending'}
                        </span>
                      </div>

                      {/* Completed timestamp + who — only if we have an actual timeline entry */}
                      {isDone && entry?.completedAt && (
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-green-400/70 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmtDateTime(entry.completedAt)}
                            <span className="text-white/25">· {fmtRelative(entry.completedAt)}</span>
                          </span>
                          {entry.doneByName && (
                            <span className="text-white/40 text-xs flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {entry.doneByName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Note recorded at this step */}
                      {isDone && entry?.note && (
                        <div className="mt-2 pl-2.5 border-l-2 border-white/10">
                          <p className="text-white/40 text-xs italic leading-relaxed">{entry.note}</p>
                        </div>
                      )}
                    </div>

                    {/* Role badge */}
                    <span className={`text-xs flex-shrink-0 self-start px-2 py-0.5 rounded font-medium ${ROLE_STYLES[step.role] || 'bg-white/5 text-white/40'}`}>
                      {step.role}
                    </span>
                  </div>

                  {/* Description */}
                  {(isDone || isCurrent) && (
                    <p className={`text-xs mt-2 leading-relaxed
                      ${isDone ? 'text-white/40' : 'text-white/60'}`}>
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Collapsed future steps */}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors pl-11 pt-1 pb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Show {hiddenCount} more step{hiddenCount > 1 ? 's' : ''}
          </button>
        )}
        {expanded && !isCancelled && cutoffIdx < steps.length - 1 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors pl-11 pt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            Show less
          </button>
        )}
      </div>

      {/* Summary footer */}
      {(event.status === 'completed_paid' || isCancelled) && (
        <div className={`mt-4 pt-4 border-t border-white/10 text-center text-sm
          ${event.status === 'completed_paid' ? 'text-green-400' : 'text-red-400'}`}>
          {event.status === 'completed_paid'
            ? 'Project successfully completed and fully paid.'
            : 'This project was cancelled.'}
        </div>
      )}
    </div>
  );
}