import { format, formatDistanceToNow, parseISO } from 'date-fns';

export const formatDate = (date, fmt = 'MMM dd, yyyy') => {
  if (!date) return '—';
  try { return format(typeof date === 'string' ? parseISO(date) : date, fmt); }
  catch { return '—'; }
};

export const formatDateTime = (date) => formatDate(date, 'MMM dd, yyyy h:mm a');
export const formatTime = (date) => formatDate(date, 'h:mm a');
export const timeAgo = (date) => {
  if (!date) return '';
  try { return formatDistanceToNow(typeof date === 'string' ? parseISO(date) : date, { addSuffix: true }); }
  catch { return ''; }
};

export const formatCurrency = (amount) => {
  if (amount == null) return '₱0';
  return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const STATUS_LABELS = {
  inquiry_received:          'Inquiry Received',
  inquiry_accepted:          'Accepted – Assessment Pending',
    meeting_scheduled:        'Meeting Scheduled',          // ← ADD THIS
  needs_assessed:            'Needs Assessed',
  quotation_sent:            'Quotation Sent',
  confirmed:                 'Confirmed',
  assigned:                  'Assigned',
  in_progress:               'In Progress',
  completed_pending_balance: 'Completed – Pending Balance',
  completed_paid:            'Completed – Paid',
  cancelled:                 'Cancelled'
};

export const STATUS_CLASSES = {
  inquiry_received:          'status-inquiry',
  inquiry_accepted:          'status-assessed',
    meeting_scheduled:         'status-quotation',           // ← ADD THIS (blue/teal badge)
  needs_assessed:            'status-assessed',
  quotation_sent:            'status-quotation',
  confirmed:                 'status-confirmed',
  assigned:                  'status-assigned',
  in_progress:               'status-progress',
  completed_pending_balance: 'status-completed',
  completed_paid:            'status-paid',
  cancelled:                 'status-cancelled'
};

export const getStatusBadge = (status) => {
  const label = STATUS_LABELS[status] || status;
  const cls = STATUS_CLASSES[status] || 'badge bg-gray-500/20 text-gray-400';
  return { label, className: cls };
};

// ── The 4 LiveTake Services ────────────────────────────────────────────────
export const SERVICES_LIST = [
  {
    key: 'liveStreaming',
    label: 'Multi-Camera Live Event Coverage & Live Streaming',
    shortLabel: 'Live Streaming',
    icon: '📡',
    desc: 'Multi-camera setup with real-time live stream broadcast'
  },
  {
    key: 'documentation',
    label: 'Events Digital Documentation',
    shortLabel: 'Documentation',
    icon: '🎞️',
    desc: 'Professional photography and videography coverage'
  },
  {
    key: 'weddingDebut',
    label: 'Wedding, Debut & Birthday Coverage with Livestream',
    shortLabel: 'Wedding / Debut',
    icon: '💍',
    desc: 'Full photo & video coverage with optional livestream'
  },
  {
    key: 'videoProduction',
    label: 'Video Production Services',
    shortLabel: 'Video Production',
    icon: '🎬',
    desc: 'Professional video editing, SDE, commercials & more'
  },
];

// Get service info by key
export const getService = (key) => SERVICES_LIST.find(s => s.key === key);

// Get active services from an event services object
export const getActiveServices = (services = {}) =>
  SERVICES_LIST.filter(s => services[s.key]);

export const PAYMENT_METHODS = [
  { value: 'gcash', label: 'GCash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' }
];

export const clsx = (...args) => args.filter(Boolean).join(' ');
