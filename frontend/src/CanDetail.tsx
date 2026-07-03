import { useState } from 'react';
import type { Can } from './types';
import { colorizeTab } from './colorizeTab';

// Pannello di dettaglio completo (struttura/classi del vecchio): immagine
// principale + miniature, tutti i campi, opening, descrizione. Lightbox locale.
export function CanDetail({
  can,
  onClose,
  isAdmin,
  onEdit,
  onDelete,
}: {
  can: Can;
  onClose: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const photos = [can.p1, can.p2, can.p3, can.p4].filter((url): url is string => Boolean(url));
  const [mainIdx, setMainIdx] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const main = photos[mainIdx] ?? photos[0];

  const fields: { lbl: string; val?: string; isTop?: boolean }[] = [
    { lbl: 'SKU', val: can.sku },
    { lbl: 'Manufacturer', val: can.produttore },
    { lbl: 'Country/Language', val: can.lingua },
    { lbl: 'Size', val: can.size },
    { lbl: 'Top / Tab', val: can.top, isTop: true },
    { lbl: 'Promo', val: can.promo },
    { lbl: 'Est. Value', val: isAdmin && can.valore ? `€${can.valore}` : undefined },
    { lbl: 'Condition', val: can.stato },
  ];
  const shown = fields.filter((f) => f.val);

  const noteVals = (can.note ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return (
    <aside className="detail-panel open">
      <div className="detail-head">
        <div className="detail-title">{can.nome || '—'}</div>
        <button type="button" className="detail-close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="detail-body">
        <div className="detail-photos">
          {main ? (
            <>
              <img
                className="detail-main-img"
                src={main}
                alt={can.nome}
                onClick={() => setLightbox(main)}
              />
              <div className="detail-tap-zoom">tap to zoom</div>
              {photos.length > 1 && (
                <div className="detail-thumbs-row">
                  {photos.map((url, i) => (
                    <img
                      key={url}
                      className={'detail-thumb' + (i === mainIdx ? ' active' : '')}
                      src={url}
                      alt={can.nome}
                      onClick={() => setMainIdx(i)}
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
            {can.stato && <span className="badge badge-stato-ok">{can.stato}</span>}
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
              <button type="button" onClick={onEdit}>
                Edit
              </button>
              <button type="button" onClick={onDelete}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      {lightbox && (
        <div className="lightbox" role="dialog" aria-label="Enlarged photo">
          <button type="button" onClick={() => setLightbox(null)}>
            Close photo
          </button>
          <img src={lightbox} alt={can.nome} />
        </div>
      )}
    </aside>
  );
}
