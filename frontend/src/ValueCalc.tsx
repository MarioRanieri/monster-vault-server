import type { Can } from './types';
import { sumValue } from './computeStats';

// Calcolatore di valore (modal, classi come StatsModal): somma/media del valore
// stimato delle lattine attualmente filtrate. Admin-only (i prezzi lo sono).
export function ValueCalc({ cans, onClose }: Readonly<{ cans: Can[]; onClose: () => void }>) {
  const withValue = cans.filter((c) => c.valore);
  const total = sumValue(cans);
  const avg = withValue.length ? total / withValue.length : 0;
  const fmt = (n: number) => `€${Math.round(n).toLocaleString('en-US')}`;

  return (
    <div
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-label="Value calculator"
    >
      <div className="stats-modal">
        <div className="modal-header">
          <div className="modal-title">Value calculator</div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="stats-tiles">
            <div className="stats-tile">
              <div className="stats-tile-num">{cans.length}</div>
              <div className="stats-tile-lbl">Cans</div>
            </div>
            <div className="stats-tile">
              <div className="stats-tile-num">{fmt(total)}</div>
              <div className="stats-tile-lbl">Total value</div>
            </div>
            <div className="stats-tile">
              <div className="stats-tile-num">€{avg.toFixed(2)}</div>
              <div className="stats-tile-lbl">Average</div>
            </div>
            <div className="stats-tile">
              <div className="stats-tile-num">{withValue.length}</div>
              <div className="stats-tile-lbl">With value</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            Based on the {cans.length} currently filtered cans.
          </p>
        </div>
      </div>
    </div>
  );
}
