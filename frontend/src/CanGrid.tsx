import type { Can } from './types';

export function CanGrid({ cans, onSelect }: { cans: Can[]; onSelect?: (can: Can) => void }) {
  return (
    <div className="grid" id="grid">
      {cans.map((can) => (
        <button key={can.id} type="button" className="card" onClick={() => onSelect?.(can)}>
          <div className="card-img">
            {can.p1 ? (
              <img src={can.p1} alt={can.nome} />
            ) : (
              <div className="card-img-placeholder">
                <span>—</span>
              </div>
            )}
            {can.sku && <span className="card-sku">{can.sku}</span>}
            <div className="card-badges">
              {can.size && <span className="badge badge-size">{can.size}</span>}
              {can.promo && <span className="badge badge-promo">{can.promo}</span>}
              {can.stato && <span className="badge badge-stato-ok">{can.stato}</span>}
            </div>
          </div>
          <div className="card-body">
            <div className="card-name">{can.nome}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
