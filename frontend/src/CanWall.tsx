import type { Can } from './types';
import { cloudinaryThumb } from './cloudinary';

// Vista "wall" (classe .wall-grid del vecchio): mosaico di sole foto, miniature
// Cloudinary leggere. Ogni tile è un <button> accessibile che apre il dettaglio.
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
        </button>
      ))}
    </div>
  );
}
