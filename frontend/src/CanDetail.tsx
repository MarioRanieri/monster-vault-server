import { useState } from 'react';
import type { Can } from './types';
import { statoBadgeClass } from './statoBadge';
import { colorizeTab } from './colorizeTab';
import { cloudinaryThumb } from './cloudinary';
import { CanShare } from './CanShare';
import { Lightbox } from './Lightbox';

// Pannello di dettaglio completo (struttura/classi del vecchio): immagine
// principale + miniature, tutti i campi, opening, descrizione. Lightbox con
// frecce (scorri le foto) e ESC per uscire.
export function CanDetail({
  can,
  onClose,
  isAdmin,
  showPrice,
  onEdit,
  onDelete,
  inCompare,
  onToggleCompare,
  onToast,
}: Readonly<{
  can: Can;
  onClose: () => void;
  isAdmin?: boolean;
  showPrice?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  inCompare?: boolean;
  onToggleCompare?: () => void;
  onToast?: (msg: string) => void;
}>) {
  const photos = [can.p1, can.p2, can.p3, can.p4].filter((url): url is string => Boolean(url));
  const [mainIdx, setMainIdx] = useState(0);
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const main = photos[mainIdx] ?? photos[0];

  const fields: { lbl: string; val?: string; isTop?: boolean }[] = [
    { lbl: 'SKU', val: can.sku },
    { lbl: 'Manufacturer', val: can.produttore },
    { lbl: 'Country/Language', val: can.lingua },
    { lbl: 'Size', val: can.size },
    { lbl: 'Top / Tab', val: can.top, isTop: true },
    { lbl: 'Promo', val: can.promo },
    { lbl: 'Est. Value', val: showPrice && can.valore ? `€${can.valore}` : undefined },
    { lbl: 'Condition', val: can.stato },
  ];
  const shown = fields.filter((f) => f.val);

  const noteVals = (can.note ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return (
    <aside className="detail-panel open">
      <div className="detail-header">
        <button type="button" className="detail-back" aria-label="Close" onClick={onClose}>
          ←
        </button>
        <div className="detail-title">{can.nome || '—'}</div>
        <CanShare can={can} onToast={onToast} />
        {onToggleCompare && (
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={inCompare}
            onClick={onToggleCompare}
          >
            <span className="btn-label">{inCompare ? '✓ Comparing' : 'Compare'}</span>
          </button>
        )}
      </div>
      <div className="detail-body">
        <div className="detail-photos">
          {main ? (
            <>
              <img
                className="detail-main-img"
                src={cloudinaryThumb(main, 800, 800)}
                alt={can.nome}
                tabIndex={0}
                onClick={() => setLbIdx(mainIdx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setLbIdx(mainIdx);
                  }
                }}
              />
              <div className="detail-tap-zoom">tap to zoom</div>
              {photos.length > 1 && (
                <div className="detail-thumbs-row">
                  {photos.map((url, i) => (
                    <img
                      key={url}
                      className={'detail-thumb' + (i === mainIdx ? ' active' : '')}
                      src={cloudinaryThumb(url, 80, 80)}
                      alt={can.nome}
                      tabIndex={0}
                      onClick={() => setMainIdx(i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setMainIdx(i);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="detail-main-img-ph" />
          )}
        </div>
        <div className="detail-info">
          <h2 className="detail-name">{can.nome || '—'}</h2>
          <div className="detail-sku">SKU {can.sku || '—'}</div>
          <div className="detail-badges">
            {can.size && <span className="badge badge-size">{can.size}</span>}
            {can.promo && <span className="badge badge-promo">{can.promo}</span>}
            {can.stato && (
              <span className={`badge ${statoBadgeClass(can.stato)}`}>{can.stato}</span>
            )}
            {photos.length > 0 && <span className="badge badge-photo">{photos.length} photo</span>}
          </div>
          <div className="detail-fields">
            {shown.map((f) => {
              if (f.isTop) {
                const tab = colorizeTab(f.val);
                return (
                  <div key={f.lbl} className="detail-field detail-field-top" style={tab.style}>
                    <div className="detail-field-lbl">{f.lbl}</div>
                    <div className="detail-field-val">
                      {tab.parts.map((p, i) => (
                        <span key={i}>
                          {i > 0 && '/'}
                          <span style={p.color ? { color: p.color } : undefined}>{p.text}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div key={f.lbl} className="detail-field">
                  <div className="detail-field-lbl">{f.lbl}</div>
                  <div className="detail-field-val">{f.val}</div>
                </div>
              );
            })}
          </div>
          {noteVals.length > 0 && (
            <div className="detail-note">
              <div className="detail-field-lbl">Opening</div>
              <div className="opening-badges">
                {noteVals.map((v) => (
                  <span key={v} className="badge-opening">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
          {can.descrizione && (
            <div className="detail-description">
              <div className="detail-field-lbl">More Info</div>
              <div className="detail-field-val">{can.descrizione}</div>
            </div>
          )}
          {isAdmin && (
            <div className="admin-actions">
              {onEdit && (
                <button type="button" className="btn btn-primary" onClick={onEdit}>
                  Edit
                </button>
              )}
              {onDelete && (
                <button type="button" className="btn btn-ghost" onClick={onDelete}>
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {lbIdx !== null && (
        <Lightbox photos={photos} start={lbIdx} alt={can.nome} onClose={() => setLbIdx(null)} />
      )}
    </aside>
  );
}
