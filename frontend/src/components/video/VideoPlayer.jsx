import React from 'react';
import { MicOff } from 'lucide-react';

/**
 * Renders one participant's camera tile.
 *
 * For the local tile the <video> element is always mounted (hidden via
 * CSS when the camera is off) so `localVideoRef` never goes stale. Remote
 * tiles mount their own <video> only once a stream exists and camera is
 * on, attaching srcObject directly on mount.
 */
/**
 * Renders one participant's camera tile.
 *
 * Both local and remote <video> elements self-heal their srcObject on every
 * mount — this matters because pinning/unpinning a tile moves it to a
 * different container, which forces React to rebuild the <video> element
 * from scratch. Without re-attaching the stream on that rebuild, the tile
 * goes black even though the underlying camera/connection is fine.
 */
export default function VideoPlayer({
  isLocal = false,
  localVideoRef,
  localStream,
  stream,
  name,
  camOff = false,
  micOff = false,
  connecting = false,
  small = false,
  active = false,
  onClick,
  fit = 'cover', // 'cover' for grid/thumbnail tiles, 'contain' for the large main-stage/solo view
}) {
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';
  const initial = name?.[0]?.toUpperCase();
  const showAvatar = isLocal ? camOff : !(stream && !camOff);

  return (
    <div
      onClick={onClick}
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#1a1a2e] border transition-colors
        ${active ? 'border-primary' : 'border-white/10'} ${onClick ? 'cursor-pointer hover:border-white/30' : ''}`}
    >
      {isLocal ? (
        <video
          autoPlay
          muted
          playsInline
          className={`w-full h-full ${fitClass} ${camOff ? 'hidden' : ''}`}
          ref={(el) => {
            if (localVideoRef) localVideoRef.current = el;
            if (el && localStream && el.srcObject !== localStream) el.srcObject = localStream;
          }}
        />
      ) : (
        stream &&
        !camOff && (
          <video
            autoPlay
            playsInline
            className={`w-full h-full ${fitClass}`}
            ref={(el) => {
              if (el && el.srcObject !== stream) el.srcObject = stream;
            }}
          />
        )
      )}

      {showAvatar && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${small ? 'gap-2' : 'gap-3'} bg-[#1a1a2e]`}>
          <div
            className={`${small ? 'w-10 h-10 text-lg' : 'w-20 h-20 text-3xl'} rounded-full flex items-center justify-center font-bold
              ${isLocal ? 'bg-primary/20 border-2 border-primary/40 text-primary' : 'bg-white/10 border-2 border-white/20 text-white'}`}
          >
            {initial}
          </div>
          {connecting && !stream && (
            <>
              <p className="text-white/50 text-sm">{name}</p>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-white/30 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className={`absolute ${small ? 'bottom-2 left-2 gap-1.5' : 'bottom-3 left-3 gap-2'} flex items-center`}>
        <span className={`bg-black/70 text-white text-xs ${small ? 'px-2 py-0.5' : 'px-2.5 py-1'} rounded-full`}>
          {name}
          {isLocal ? ' (You)' : ''}
        </span>
        {micOff && (
          <span className={`bg-red-500/90 ${small ? 'p-0.5' : 'p-1'} rounded-full`}>
            <MicOff className={small ? 'w-2.5 h-2.5 text-white' : 'w-3 h-3 text-white'} />
          </span>
        )}
      </div>
    </div>
  );
}