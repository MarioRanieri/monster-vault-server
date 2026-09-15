import { useMemo, useState } from 'react';
import type { Can } from './types';
import { statoBadgeClass } from './statoBadge';
import { hasPromo } from './filterCans';
import { colorizeTab } from './colorizeTab';
import { cloudinaryThumb } from './cloudinary';
import { CanShare } from './CanShare';
import { Lightbox } from './Lightbox';
import { CanGrid } from './CanGrid';
import { pickRelated, lineupKey } from './relatedCans';

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
  allCans,
  onSelect,
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
  allCans?: Can[];
  onSelect?: (can: Can) => void;
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
    { lbl: 'Promo', val: hasPromo(can.promo) ? can.promo : undefined },
    { lbl: 'Est. Value', val: showPrice && can.valore ? `€${can.valore}` : undefined },
    { lbl: 'Condition', val: can.stato },
  ];
  const shown = fields.filter((f) => f.val);

  const noteVals = (can.note ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  // "Other cans from this country": stesso lingua/paese, esclusa se stessa, a
  // caso preferendo quelle con foto — memoizzato sull'id così non rimescola a
  // ogni render (es. cambio foto principale) ma solo aprendo un'altra can.
  const relatedCans = useMemo(() => {
    if (!allCans) return [];
    const sameCountry = allCans.filter(
      (c) => c.id !== can.id && c.lingua && c.lingua === can.lingua,
    );
    return pickRelated(sameCountry, 8);
  }, [can.id, allCans]);

  // "Cans from the same lineup": stesse prime due parole del nome (es.
  // "ABSOLUTELY ZERO ..." → stessa linea, varianti diverse). Stessa logica
  // random + preferenza foto di sopra.
  const lineupCans = useMemo(() => {
    if (!allCans) return [];
    const key = lineupKey(can.nome);
    const sameLineup = allCans.filter((c) => c.id !== can.id && lineupKey(c.nome) === key);
    return pickRelated(sameLineup, 8);
  }, [can.id, allCans]);

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
        {/* Riga 1: foto a sinistra, nome/badge + altre lattine a destra.
            align-items:start (vedi CSS) impedisce alle due colonne di stirarsi
            per matchare l'altezza l'una dell'altra — prima la colonna foto si
            allungava fino all'altezza della lista campi (molto più alta,
            specie con "Other cans" sotto), lasciando nero vuoto sotto la foto. */}
        <div className="detail-top-row">
          <div className="detail-photos">
            {main ? (
              <>
                <div className="detail-main-wrap">
                  {photos.length > 1 && (
                    <button
                      type="button"
                      className="detail-photo-nav detail-photo-nav-prev"
                      aria-label="Previous photo"
                      onClick={() => setMainIdx((i) => (i - 1 + photos.length) % photos.length)}
                    >
                      ‹
                    </button>
                  )}
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
                  {photos.length > 1 && (
                    <button
                      type="button"
                      className="detail-photo-nav detail-photo-nav-next"
                      aria-label="Next photo"
                      onClick={() => setMainIdx((i) => (i + 1) % photos.length)}
                    >
                      ›
                    </button>
                  )}
                </div>
                <div className="detail-tap-zoom">tap to zoom</div>
                {photos.length > 1 && (
                  <div className="detail-photo-counter">
                    {mainIdx + 1} / {photos.length}
                  </div>
                )}
                {photos.length > 1 && (
                  <div className="detail-thumbs-col">
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
              {hasPromo(can.promo) && <span className="badge badge-promo">{can.promo}</span>}
              {can.stato && (
                <span className={`badge ${statoBadgeClass(can.stato)}`}>{can.stato}</span>
              )}
              {photos.length > 0 && (
                <span className="badge badge-photo">{photos.length} photo</span>
              )}
            </div>
          </div>
        </div>
        {/* Riga 2: pannello campi a tutta larghezza, sotto foto/altre lattine. */}
        <div className="detail-fields-row">
          <ul className="detail-fields" aria-label="Can details">
            {shown.map((f) => {
              if (f.isTop) {
                const tab = colorizeTab(f.val);
                return (
                  <li key={f.lbl} className="detail-field detail-field-top" style={tab.style}>
                    <span className="detail-field-lbl">{f.lbl}</span>
                    <span className="detail-field-val">
                      {tab.parts.map((p, i) => (
                        <span key={i}>
                          {i > 0 && '/'}
                          <span style={p.color ? { color: p.color } : undefined}>{p.text}</span>
                        </span>
                      ))}
                    </span>
                  </li>
                );
              }
              return (
                <li key={f.lbl} className="detail-field">
                  <span className="detail-field-lbl">{f.lbl}</span>
                  <span className="detail-field-val">{f.val}</span>
                </li>
              );
            })}
          </ul>
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
        {/* Riga 3: altre lattine per ultime — contenuto secondario, dopo le
            info di questa lattina (prima erano accanto alla foto, in cima:
            l'utente le vede prima delle info della lattina che sta guardando). */}
        {relatedCans.length > 0 && (
          <section className="detail-related" aria-label="Other cans from this country">
            <h3 className="detail-related-title">Other cans from this country</h3>
            <CanGrid cans={relatedCans} showPrice={showPrice} onSelect={onSelect} />
          </section>
        )}
        {lineupCans.length > 0 && (
          <section className="detail-related" aria-label="Cans from the same lineup">
            <h3 className="detail-related-title">Cans from the same lineup</h3>
            <CanGrid cans={lineupCans} showPrice={showPrice} onSelect={onSelect} />
          </section>
        )}
      </div>
      {lbIdx !== null && (
        <Lightbox photos={photos} start={lbIdx} alt={can.nome} onClose={() => setLbIdx(null)} />
      )}
    </aside>
  );
}
