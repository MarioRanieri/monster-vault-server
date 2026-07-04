import type { Can } from './types';
import { cloudinaryThumb } from './cloudinary';
import { Flags } from './flags';

// Vista "wall" (classe .wall-grid del vecchio): mosaico di sole foto, miniature
// Cloudinary leggere. All'hover una caption col nome + flag; il tile apre il dettaglio.
export function CanWall({ cans, onSelect }: { cans: Can[]; onSelect?: (can: Can) => void }) {
  const withPhotos = cans.filter((c) => c.p1);
  if (withPhotos.length === 0) {
    return (
      <div className="empty">
        <p>No photos to show here</p>
      </div>
    );
  }
  return (
    <div className="wall-grid">
      {withPhotos.map((can) => (
        <button
          key={can.id}
          type="button"
          className="wall-tile"
          title={can.nome}
          onClick={() => onSelect?.(can)}
        >
          <img src={cloudinaryThumb(can.p1, 300, 300)} alt={can.nome} loading="lazy" />
          <span className="wall-caption">
            <span className="wall-caption-name">{can.nome || '—'}</span>
            {can.lingua && (
              <span className="wall-caption-flag">
                <Flags lingua={can.lingua} />
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
