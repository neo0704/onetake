import React from 'react';
import { Monitor, X } from 'lucide-react';

/**
 * Renders a screen-share stream — used both as the big main-stage view
 * and as a small clickable thumbnail. `stream` here is always a SEPARATE
 * MediaStream from the sharer's camera, so both can render at once.
 */
export default function ScreenTile({ stream, name, isLocal, onClick, onStop, active = false, small = false }) {
  return (
    <div
      onClick={onClick}
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#0a0a1a] border transition-colors
        ${active ? 'border-primary' : 'border-white/10'} ${onClick ? 'cursor-pointer hover:border-white/30' : ''}`}
    >
      {stream && (
        <video
          autoPlay
          muted={isLocal}
          playsInline
          className={small ? 'w-full h-full object-cover' : 'w-full h-full object-contain'}
          ref={(el) => {
            if (el && el.srcObject !== stream) el.srcObject = stream;
          }}
        />
      )}

      <div className={`absolute ${small ? 'bottom-2 left-2 gap-1.5' : 'bottom-3 left-3 gap-2'} flex items-center`}>
        <span
          className={`bg-primary/80 text-white text-xs ${small ? 'px-2 py-0.5' : 'px-2.5 py-1'} rounded-full flex items-center gap-1.5`}
        >
          <Monitor className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          {isLocal ? 'Your screen' : `${name}'s screen`}
        </span>
      </div>

      {onStop && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
          className="absolute top-3 right-3 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1.5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}