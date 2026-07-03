import type { Can } from './types';

// Barra in basso (classi .compare-bar/.compare-slot del vecchio): mostra le
// lattine selezionate per il confronto, permette di rimuoverle e aprire il panel.
export function CompareBar({
  cans,
  onRemove,
  onOpen,
  onClear,
}: {
  cans: Can[];
  onRemove: (id: string) => void;
  onOpen: () => void;
  onClear: () => void;
}) {
  if (cans.length === 0) return null;
  return (
    <div className="compare-bar open">
      <div className="compare-slots">
        {cans.map((can) => (
          <div key={can.id} className="compare-slot">
            {can.p1 ? (
              <img src={can.p1} alt={can.nome} />
            ) : (
              <div className="compare-slot-ph">—</div>
            )}
            <button
              type="button"
              className="compare-slot-remove"
              aria-label={`Remove ${can.nome}`}
              onClick={() => onRemove(can.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-primary" disabled={cans.length < 2} onClick={onOpen}>
        Compare ({cans.length})
      </button>
      <button type="button" className="btn btn-ghost" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
