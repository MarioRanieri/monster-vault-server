import { useEffect, useMemo, useRef, useState } from 'react';
import type { Can } from './types';
import { statoBadgeClass } from './statoBadge';
import { hasPromo } from './filterCans';
import { colorizeTab } from './colorizeTab';
import { TabParts } from './TabParts';
import { cloudinaryThumb } from './cloudinary';
import { CanShare } from './CanShare';
import { Lightbox } from './Lightbox';
import { CanGrid } from './CanGrid';
import { pickRelated, sameLineupGroups } from './relatedCans';
import { useEscapeClose } from './useEscapeClose';

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
  navCans,
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
  navCans?: Can[];
  onSelect?: (can: Can) => void;
}>) {
  const photos = [can.p1, can.p2, can.p3, can.p4].filter((url): url is string => Boolean(url));
  const [mainIdx, setMainIdx] = useState(0);
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const main = photos[mainIdx] ?? photos[0];
  const panelRef = useRef<HTMLElement>(null);

  // ESC chiude il pannello e ripristina il focus a chi l'aveva aperto —
  // se la lightbox è aperta è lei in cima allo stack e chiude prima se stessa
  // (vedi useEscapeClose), il pannello resta.
  useEscapeClose(onClose);

  // All'apertura sposta il focus dentro il pannello (accessibilità tastiera).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

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

  // "Other cans from this country": stesso lingua/paese e stesso stato promo
  // (mai mischiare una promo con una lattina normale), esclusa se stessa, a
  // caso preferendo quelle con foto — memoizzato sull'id così non rimescola a
  // ogni render (es. cambio foto principale) ma solo aprendo un'altra can.
  const relatedCans = useMemo(() => {
    if (!allCans) return [];
    const sameCountry = allCans.filter(
      (c) =>
        c.id !== can.id &&
        c.lingua &&
        c.lingua === can.lingua &&
        hasPromo(c.promo) === hasPromo(can.promo),
    );
    return pickRelated(sameCountry, 8);
  }, [can.id, allCans]);

  // "Cans from the same lineup": per una lattina normale un solo blocco
  // (nazione-first). Per una promo, la "linea" è la campagna/oggetto — tre
  // fasce concatenate (stesso item ovunque, altre promo stessa nazione,
  // altre promo rare), ognuna col suo sottotitolo — vedi sameLineupGroups.
  const lineupGroups = useMemo(() => {
    if (!allCans) return [];
    return sameLineupGroups(allCans, can);
  }, [can.id, allCans]);

  // Frecce ← → scorrono alla lattina precedente/successiva della lista corrente
  // (stesso ordine/filtri della griglia da cui si è aperto il pannello) — non i
  // pulsanti ‹ › della foto, che restano dedicati alle foto della lattina.
  // Disattivate mentre la lightbox è aperta: lì ← → scorrono le sue foto.
  useEffect(() => {
    if (!navCans || navCans.length < 2 || !onSelect || lbIdx !== null) return;
    const idx = navCans.findIndex((c) => c.id === can.id);
    if (idx === -1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onSelect(navCans[(idx - 1 + navCans.length) % navCans.length]);
      else if (e.key === 'ArrowRight') onSelect(navCans[(idx + 1) % navCans.length]);
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [navCans, can.id, onSelect, lbIdx]);

  return (
    <aside className="detail-panel open" ref={panelRef} tabIndex={-1}>
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
                  <button
                    type="button"
                    className="detail-photo-btn"
                    onClick={() => setLbIdx(mainIdx)}
                  >
                    <img
                      className="detail-main-img"
                      src={cloudinaryThumb(main, 800, 800)}
                      alt={can.nome}
                    />
                  </button>
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
                      <button
                        key={url}
                        type="button"
                        className="detail-photo-btn"
                        onClick={() => setMainIdx(i)}
                      >
                        <img
                          className={'detail-thumb' + (i === mainIdx ? ' active' : '')}
                          src={cloudinaryThumb(url, 80, 80)}
                          alt={can.nome}
                        />
                      </button>
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
                      <TabParts parts={tab.parts} />
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
        {lineupGroups.length > 0 && (
          <section className="detail-related" aria-label="Cans from the same lineup">
            <h3 className="detail-related-title">Cans from the same lineup</h3>
            {lineupGroups.map((group, i) => (
              <div
                key={group.label ?? 'main'}
                className={i > 0 ? 'detail-related-subgroup' : undefined}
              >
                {group.label && <h4 className="detail-related-subtitle">{group.label}</h4>}
                <CanGrid cans={group.cans} showPrice={showPrice} onSelect={onSelect} />
              </div>
            ))}
          </section>
        )}
      </div>
      {lbIdx !== null && (
        <Lightbox photos={photos} start={lbIdx} alt={can.nome} onClose={() => setLbIdx(null)} />
      )}
    </aside>
  );
}
