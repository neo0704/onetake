import React from 'react';
import VideoPlayer from './VideoPlayer';
import ScreenTile from './ScreenTile';

export default function ThumbnailStrip({ tiles, activeId, onSelect }) {
  if (tiles.length === 0) return null;

  return (
    <div className="flex gap-2 h-28 flex-shrink-0 p-3 pt-2 overflow-x-auto">
      {tiles.map((tile) => (
        <div key={tile.id} className="w-40 flex-shrink-0">
          {tile.kind === 'screen' ? (
            <ScreenTile
              stream={tile.stream}
              name={tile.name}
              isLocal={tile.isLocal}
              onClick={() => onSelect(tile.id)}
              active={tile.id === activeId}
              small
            />
          ) : (
            <VideoPlayer
              isLocal={tile.isLocal}
              localVideoRef={tile.localVideoRef}
              stream={tile.stream}
              name={tile.name}
              camOff={tile.camOff}
              micOff={tile.micOff}
              active={tile.id === activeId}
              onClick={() => onSelect(tile.id)}
              small
            />
          )}
        </div>
      ))}
    </div>
  );
}