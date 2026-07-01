import type { Can } from './types';

export function CanGrid({ cans }: { cans: Can[] }) {
  return (
    <ul className="can-grid">
      {cans.map((can) => (
        <li key={can.id} className="can-card">
          {can.p1 && <img src={can.p1} alt={can.nome} />}
          <span className="can-name">{can.nome}</span>
          <span className="can-badges">
            {can.size && <span className="badge">{can.size}</span>}
            {can.promo && <span className="badge">{can.promo}</span>}
            {can.stato && <span className="badge">{can.stato}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
