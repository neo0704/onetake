import React from 'react';
import TileFace from './TileFace';

/**
 * Renders tiles in ONE persistent container for "everyone not currently
 * pinned" — whether that container is styled as a grid or a thumbnail
 * strip is just a className change. This is deliberate: it keeps the
 * same DOM node (and therefore the same live <video> element) for any
 * tile that isn't actively changing role, so pinning/unpinning yourself
 * never disturbs anyone else's video.
 *
 * Only the tile that IS changing role (becoming pinned, or being
 * unpinned) moves to/from the separate main-stage container above, so
 * only that one tile's <video> element gets rebuilt — which is expected
 * and harmless (a brief re-attach, not a dropped connection).
 */
export default function VideoGrid({ tiles, mainTileId, onSelectTile, onStopOwnScreen, gridClass }) {
  const mainTile = mainTileId ? tiles.find((t) => t.id === mainTileId) : null;
  const secondaryTiles = mainTile ? tiles.filter((t) => t.id !== mainTile.id) : tiles;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {mainTile && (
        <div className="flex-1 min-h-0 p-2 sm:p-3 pb-0 flex justify-center">
          {/* A camera feed stretched across a very wide container gets
              aggressively cropped by object-cover (you end up zoomed into
              someone's face). Capping the width near the video's own
              aspect ratio keeps the framing natural. Screen shares don't
              have this problem — they want all the width they can get. */}
          <div className={mainTile.kind === 'screen' ? 'w-full h-full' : 'h-full aspect-video max-w-full'}>
            <TileFace
              tile={mainTile}
              active
              onStop={mainTile.isLocal && mainTile.kind === 'screen' ? onStopOwnScreen : undefined}
            />
          </div>
        </div>
      )}

      <div
        className={
          mainTile
            ? 'flex gap-2 h-20 sm:h-28 flex-shrink-0 p-2 sm:p-3 pt-2 overflow-x-auto'
            : secondaryTiles.length === 1
            ? 'flex-1 flex justify-center p-2 sm:p-3 overflow-hidden'
            : `flex-1 grid ${gridClass} gap-2 p-2 sm:p-3 overflow-hidden`
        }
      >
        {secondaryTiles.map((tile) => (
          <div
            key={tile.id}
            className={
              mainTile
                ? 'w-28 sm:w-40 flex-shrink-0'
                : // Solo tile: same aspect-ratio cap as the main stage, so
                  // being alone in the call doesn't zoom into your face.
                secondaryTiles.length === 1 && tile.kind !== 'screen'
                ? 'h-full aspect-video max-w-full'
                : ''
            }
          >
            <TileFace
              tile={tile}
              small={!!mainTile}
              onClick={() => onSelectTile(tile.id)}
              onStop={tile.isLocal && tile.kind === 'screen' ? onStopOwnScreen : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}