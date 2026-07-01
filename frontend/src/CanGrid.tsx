import type { Can } from './types';

export function CanGrid({ cans }: { cans: Can[] }) {
  return (
    <ul className="can-grid">
      {cans.map((can) => (
        <li key={can.id}>{can.nome}</li>
      ))}
    </ul>
  );
}
