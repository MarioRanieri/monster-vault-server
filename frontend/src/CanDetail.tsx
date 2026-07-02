import { useState } from 'react';
import type { Can } from './types';

// Pannello di dettaglio: galleria foto con lightbox + badge. Dati via props.
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
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <aside className="can-detail">
      <button type="button" onClick={onClose}>
        Chiudi
      </button>
      <h2>{can.nome}</h2>
      <div className="detail-photos">
        {photos.map((url) => (
          <button key={url} type="button" className="photo-thumb" onClick={() => setLightbox(url)}>
            <img src={url} alt={can.nome} />
          </button>
        ))}
      </div>
      {can.sku && <p className="detail-sku">{can.sku}</p>}
      <div className="detail-badges">
        {can.size && <span className="badge">{can.size}</span>}
        {can.promo && <span className="badge">{can.promo}</span>}
        {can.stato && <span className="badge">{can.stato}</span>}
      </div>
      {isAdmin && (
        <div className="admin-actions">
          <button type="button" onClick={onEdit}>
            Modifica
          </button>
          <button type="button" onClick={onDelete}>
            Elimina
          </button>
        </div>
      )}
      {lightbox && (
        <div className="lightbox" role="dialog" aria-label="Foto ingrandita">
          <button type="button" onClick={() => setLightbox(null)}>
            Chiudi foto
          </button>
          <img src={lightbox} alt={can.nome} />
        </div>
      )}
    </aside>
  );
}
