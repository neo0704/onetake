import React from 'react';
import VideoPlayer from './VideoPlayer';
import ScreenTile from './ScreenTile';

/** Renders one tile as either a camera (VideoPlayer) or screen share (ScreenTile), based on tile.kind. */
export default function TileFace({ tile, small = false, active = false, onClick, onStop, fit }) {
  if (tile.kind === 'screen') {
    return (
      <ScreenTile
        stream={tile.stream}
        name={tile.name}
        isLocal={tile.isLocal}
        onClick={onClick}
        onStop={onStop}
        active={active}
        small={small}
      />
    );
  }
  return (
    <VideoPlayer
      isLocal={tile.isLocal}
      tileId={tile.id}
      localVideoRef={tile.localVideoRef}
      localStream={tile.localStream}
      stream={tile.stream}
      name={tile.name}
      camOff={tile.camOff}
      micOff={tile.micOff}
      connecting={!tile.isLocal}
      active={active}
      onClick={onClick}
      small={small}
      {...(fit ? { fit } : {})}
    />
  );
}