import type { Can } from './types';
import { cloudinaryThumb, cloudinaryLqip } from './cloudinary';
import { Flags } from './flags';

// Griglia di card (struttura/classi del vecchio): foto con LQIP progressivo,
// SKU, badge, nome, produttore, bandiere del paese e prezzo (solo admin).
export function CanGrid({
  cans,
  isAdmin,
  onSelect,
}: {
  cans: Can[];
  isAdmin?: boolean;
  onSelect?: (can: Can) => void;
}) {
  return (
    <div className="grid" id="grid">
      {cans.map((can) => {
        const pv = can.valore ? parseFloat(can.valore).toLocaleString('en-US') : '';
        const isFull = (can.note ?? '').toUpperCase().includes('FULL');
        return (
          <button key={can.id} type="button" className="card" onClick={() => onSelect?.(can)}>
            <div className="card-img">
              {can.p1 ? (
                <div
                  className="card-img-lqip"
                  style={{ backgroundImage: `url(${cloudinaryLqip(can.p1)})` }}
                >
                  <img
                    src={cloudinaryThumb(can.p1, 400, 400)}
                    alt={can.nome}
                    loading="lazy"
                    width={400}
                    height={400}
                    onLoad={(e) => e.currentTarget.parentElement?.classList.add('lqip-loaded')}
                  />
                </div>
              ) : (
                <div className="card-img-placeholder">
                  <span>—</span>
                </div>
              )}
              {can.sku && (
                <span className="card-sku">
                  {can.sku}
                  {isFull && (
                    <>
                      <br />
                      <span className="badge-full">FULL</span>
                    </>
                  )}
                </span>
              )}
              <div className="card-badges">
                {can.size && <span className="badge badge-size">{can.size}</span>}
                {can.promo && <span className="badge badge-promo">{can.promo}</span>}
                {can.stato && <span className="badge badge-stato-ok">{can.stato}</span>}
              </div>
            </div>
            <div className="card-body">
              <div className="card-name">{can.nome || '—'}</div>
              {can.produttore && <div className="card-produttore">{can.produttore}</div>}
              <div className="card-meta">
                <Flags lingua={can.lingua} />
              </div>
              {isAdmin && pv && <div className="card-price">€{pv}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
