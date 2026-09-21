import React from 'react';
import { SERVICES_LIST } from '../../utils/helpers';

// Legacy service keys mapping (old format → display)
const LEGACY = {
  lights:      { label: 'Lights' },
  sounds:      { label: 'Sounds' },
  video:       { label: 'Video' },
  photography: { label: 'Photography' },
};

export default function ServiceBadges({ services = {}, size = 'sm' }) {
  if (!services) return <p className="text-white/30 text-sm">No services selected</p>;

  // New format services
  const active = SERVICES_LIST.filter(s => services[s.key]);

  // Legacy format services (lights, sounds, video, photography)
  const legacyActive = Object.entries(LEGACY)
    .filter(([key]) => services[key])
    .map(([key, info]) => ({ key, ...info }));

  const allActive = [...active, ...legacyActive];

  if (allActive.length === 0) {
    return <p className="text-white/30 text-sm">No services selected</p>;
  }

  const cls = size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';
  const tagStyle = 'rounded-md bg-white/5 text-white/60 border border-white/10 font-medium';

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map(s => (
        <span key={s.key} className={`${tagStyle} ${cls}`}>
          {size === 'lg' ? s.label : s.shortLabel}
        </span>
      ))}
      {legacyActive.map(s => (
        <span key={s.key} className={`${tagStyle} ${cls}`}>
          {s.label}
        </span>
      ))}
    </div>
  );
}