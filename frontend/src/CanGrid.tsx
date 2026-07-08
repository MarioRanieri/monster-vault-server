import type { Can } from './types';
import { cloudinaryThumb, cloudinaryLqip } from './cloudinary';
import { Flags } from './flags';

// Griglia di card (struttura/classi del vecchio): foto con LQIP progressivo,
// SKU, badge, nome, produttore, bandiere del paese e prezzo (solo admin).
// Overlay al hover (come il vecchio): "Details" apre il dettaglio, "Edit" apre
// direttamente la modifica (solo admin: onEdit passato solo quando isAdmin).
export function CanGrid({
  cans,
  showPrice,
  onSelect,
  onEdit,
}: Readonly<{
  cans: Can[];
  showPrice?: boolean;
  onSelect?: (can: Can) => void;
  onEdit?: (can: Can) => void;
}>) {
  return (
    <div className="grid" id="grid">
      {cans.map((can) => {
        const pv = can.valore ? Number.parseFloat(can.valore).toLocaleString('en-US') : '';
        const isFull = (can.note ?? '').toUpperCase().includes('FULL');
        return (
          <div
            key={can.id}
            className="card"
            role="button"
            tabIndex={0}
            aria-label={can.nome || 'Can'}
            onClick={() => onSelect?.(can)}
            onKeyDown={(e) => {
              // Solo se il focus è sulla card stessa (non su un bottone dell'overlay),
              // così Enter sull'overlay non apre anche il dettaglio.
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelect?.(can);
              }
            }}
          >
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
              <div className="card-overlay">
                <button
                  type="button"
                  className="card-overlay-btn view"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(can);
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  Details
                </button>
                {onEdit && (
                  <button
                    type="button"
                    className="card-overlay-btn edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(can);
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>
            </div>
            <div className="card-body">
              <div className="card-name">{can.nome || '—'}</div>
              {can.produttore && <div className="card-produttore">{can.produttore}</div>}
              <div className="card-meta">
                <Flags lingua={can.lingua} />
              </div>
              {showPrice && pv && <div className="card-price">€{pv}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
