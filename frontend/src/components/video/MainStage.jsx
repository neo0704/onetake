import React from 'react';
import VideoPlayer from './VideoPlayer';
import ScreenTile from './ScreenTile';

export default function MainStage({ tile, onStopOwnScreen }) {
  if (!tile) return null;

  return (
    <div className="flex-1 min-h-0 p-3 pb-0">
      {tile.kind === 'screen' ? (
        <ScreenTile
          stream={tile.stream}
          name={tile.name}
          isLocal={tile.isLocal}
          onStop={tile.isLocal ? onStopOwnScreen : undefined}
        />
      ) : (
        <VideoPlayer
          isLocal={tile.isLocal}
          localVideoRef={tile.localVideoRef}
          stream={tile.stream}
          name={tile.name}
          camOff={tile.camOff}
          micOff={tile.micOff}
          connecting={!tile.isLocal}
        />
      )}
    </div>
  );
}