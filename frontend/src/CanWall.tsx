import type { Can } from './types';

// Vista "wall" (classi .wall-view/.wall-tile del vecchio): muro di sole foto.
// Ogni tile è un <button> accessibile che apre il dettaglio.
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
    <div className="wall-view">
      {withPhotos.map((can) => (
        <button
          key={can.id}
          type="button"
          className="wall-tile"
          title={can.nome}
          onClick={() => onSelect?.(can)}
        >
          <img src={can.p1} alt={can.nome} loading="lazy" />
        </button>
      ))}
    </div>
  );
}
