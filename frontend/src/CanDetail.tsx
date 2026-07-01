import type { Can } from './types';

// RED: scheletro — mostra solo titolo e bottone chiudi (mancano sku/foto/badge).
export function CanDetail({ can, onClose }: { can: Can; onClose: () => void }) {
  return (
    <aside className="can-detail">
      <button type="button" onClick={onClose}>
        Chiudi
      </button>
      <h2>{can.nome}</h2>
      {can.p1 && <img src={can.p1} alt={can.nome} />}
      {can.sku && <p className="detail-sku">{can.sku}</p>}
      <div className="detail-badges">
        {can.size && <span className="badge">{can.size}</span>}
        {can.promo && <span className="badge">{can.promo}</span>}
        {can.stato && <span className="badge">{can.stato}</span>}
      </div>
    </aside>
  );
}
