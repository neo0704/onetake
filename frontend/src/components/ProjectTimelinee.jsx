/**
 * ProjectTimeline.jsx
 *
 * Shows every step of the project workflow with:
 *   - Whether it's done (green checkmark + date/time + who did it)
 *   - Current step (pulsing indicator)
 *   - Upcoming steps (grayed out with expected actions)
 *   - Any notes recorded at each step
 *
 * Usage in admin EventDetail overview tab:
 *   import ProjectTimeline from '../../components/ProjectTimeline';
 *   <ProjectTimeline event={event} />
 */

import React, { useState } from 'react';
import { CheckCircle, Clock, Circle, ChevronDown, ChevronUp, User } from 'lucide-react';

const fmtDateTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

// All steps in order with descriptions of what happens at each
const ALL_STEPS = [
  {
    status:      'inquiry_received',
    label:       'Inquiry Received',
    description: 'Client submitted their project inquiry with event details and service preferences.',
    role:        'Client',
    icon:        '📋',
  },
  {
    status:      'inquiry_accepted',
    label:       'Inquiry Accepted',
    description: 'Admin reviewed and accepted the inquiry. Client was notified.',
    role:        'Admin',
    icon:        '✅',
  },
  {
    status:      'meeting_scheduled',
    label:       'Meeting Scheduled',
    description: 'Needs assessment meeting scheduled with the client to discuss requirements and packages.',
    role:        'Admin',
    icon:        '📅',
  },
  {
    status:      'needs_assessed',
    label:       'Needs Assessment Completed',
    description: 'Requirements confirmed. Packages agreed with client. Ready to create quotation.',
    role:        'Admin',
    icon:        '📝',
  },
  {
    status:      'quotation_sent',
    label:       'Quotation Sent',
    description: 'Custom quotation prepared based on assessment and sent to client for approval.',
    role:        'Admin',
    icon:        '📄',
  },
  {
    status:      'confirmed',
    label:       'Quotation Approved',
    description: 'Client approved the quotation. 50% downpayment required to confirm booking.',
    role:        'Client',
    icon:        '👍',
  },
  {
    status:      'assigned',
    label:       'Team Assigned',
    description: 'Freelancers and equipment assigned to the project. Team has been notified.',
    role:        'Admin',
    icon:        '👥',
  },
  {
    status:      'in_progress',
    label:       'Event In Progress',
    description: 'Event is currently happening. Team is on-site and executing the project.',
    role:        'Admin',
    icon:        '🔴',
  },
  {
    status:      'completed_pending_balance',
    label:       'Event Completed',
    description: 'Event successfully completed. Client needs to pay the remaining 50% balance.',
    role:        'Admin',
    icon:        '🎬',
  },
  {
    status:      'completed_paid',
    label:       'Fully Paid',
    description: 'Final payment received. Project fully closed.',
    role:        'Client / Admin',
    icon:        '✔',
  },
];

const CANCELLED_STEP = {
  status:      'cancelled',
  label:       'Cancelled',
  description: 'This project was cancelled.',
  role:        'Admin',
  icon:        '✕',
};

export default function ProjectTimeline({ event }) {
  const [expanded, setExpanded] = useState(false);

  if (!event) return null;

  const isCancelled = event.status === 'cancelled';
  const steps       = isCancelled ? [...ALL_STEPS, CANCELLED_STEP] : ALL_STEPS;

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

  const currentIdx = steps.findIndex(s => s.status === event.status);

  // Count completed steps
  const completedCount = steps.filter(s => timelineMap[s.status]).length;
  const percent        = Math.round((completedCount / steps.length) * 100);

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
        <button onClick={() => setExpanded(v => !v)}
          className="btn-ghost text-xs py-1.5 flex items-center gap-1">
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Collapse</> : <><ChevronDown className="w-3.5 h-3.5" /> Expand all</>}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
          <span>Progress</span>
          <span className="text-primary font-semibold">{percent}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const entry     = timelineMap[step.status];
          const isDone    = !!entry;
          const isCurrent = !isDone && idx === currentIdx + (isCancelled ? 0 : 0) && !isCancelled;
          const isLast    = idx === steps.length - 1;

          return (
            <div key={step.status} className="flex gap-3">
              {/* Left: connector line + icon */}
              <div className="flex flex-col items-center flex-shrink-0">
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all
                  ${isDone
                    ? 'bg-green-500 border-green-500'
                    : isCurrent
                      ? 'bg-primary/20 border-primary animate-pulse'
                      : isCancelled && step.status === 'cancelled'
                        ? 'bg-red-500/20 border-red-500'
                        : 'bg-white/5 border-white/20'}`}>
                  {isDone ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : isCurrent ? (
                    <Clock className="w-4 h-4 text-primary" />
                  ) : isCancelled && step.status === 'cancelled' ? (
                    <span className="text-red-400 text-xs font-bold">X</span>
                  ) : (
                    <Circle className="w-4 h-4 text-white/20" />
                  )}
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 min-h-[16px] ${isDone ? 'bg-green-500/40' : 'bg-white/10'}`} />
                )}
              </div>

              {/* Right: content */}
              <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
                <div className={`p-3 rounded-xl border transition-all
                  ${isDone
                    ? 'border-green-500/20 bg-green-500/5'
                    : isCurrent
                      ? 'border-primary/30 bg-primary/5'
                      : isCancelled && step.status === 'cancelled'
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-white/5 bg-white/2 opacity-50'}`}>

                  {/* Step header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold
                          ${isDone ? 'text-white' : isCurrent ? 'text-primary' : 'text-white/40'}`}>
                          {step.label}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                          ${isDone ? 'bg-green-500/20 text-green-400' :
                            isCurrent ? 'bg-primary/20 text-primary' :
                            'bg-white/5 text-white/30'}`}>
                          {isDone ? 'Done' : isCurrent ? 'Current' : 'Pending'}
                        </span>
                      </div>

                      {/* Completed timestamp + who */}
                      {isDone && entry.completedAt && (
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-green-400/70 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmtDateTime(entry.completedAt)}
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
                      {isDone && entry.note && (
                        <p className="text-white/50 text-xs mt-1.5 italic bg-white/5 rounded px-2 py-1">
                          "{entry.note}"
                        </p>
                      )}
                    </div>

                    {/* Role badge */}
                    <span className="text-white/20 text-xs flex-shrink-0 bg-white/5 px-2 py-0.5 rounded">
                      {step.role}
                    </span>
                  </div>

                  {/* Description — shown when expanded or current/done */}
                  {(expanded || isDone || isCurrent) && (
                    <p className={`text-xs mt-2 leading-relaxed
                      ${isDone ? 'text-white/40' : isCurrent ? 'text-white/60' : 'text-white/30'}`}>
                      {step.description}
                    </p>
                  )}

                  {/* Extra details for specific steps */}
                  {isDone && step.status === 'meeting_scheduled' && event.scheduledMeeting?.confirmedDate && (
                    <div className="mt-2 text-xs text-white/40 bg-white/5 rounded px-2 py-1.5 space-y-0.5">
                      <p>
                        {event.scheduledMeeting.meetingType === 'ftf' ? 'Face-to-Face' : 'Online'} meeting on{' '}
                        {new Date(event.scheduledMeeting.confirmedDate).toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
                        {event.scheduledMeeting.confirmedTime ? ` at ${event.scheduledMeeting.confirmedTime}` : ''}
                      </p>
                      {event.scheduledMeeting.location && event.scheduledMeeting.meetingType === 'ftf' && (
                        <p>Location: {event.scheduledMeeting.location}</p>
                      )}
                    </div>
                  )}

                  {isDone && step.status === 'needs_assessed' && event.needsAssessment?.selectedPackages?.length > 0 && (
                    <div className="mt-2 text-xs text-white/40 bg-white/5 rounded px-2 py-1">
                      {event.needsAssessment.selectedPackages.length} package(s) agreed.
                      {event.needsAssessment.attendees && ` Attendees: ${event.needsAssessment.attendees}.`}
                    </div>
                  )}

                  {isDone && step.status === 'assigned' && (event.assignedFreelancers || []).length > 0 && (
                    <div className="mt-2 text-xs text-white/40 bg-white/5 rounded px-2 py-1">
                      Team: {event.assignedFreelancers.map(af => af.freelancer?.name || 'Freelancer').join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      {(event.status === 'completed_paid' || event.status === 'cancelled') && (
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
