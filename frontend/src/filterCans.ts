import type { Can } from './types';

// Filtra i cans per nome (case-insensitive). Query vuota → tutti.
export function filterCans(cans: Can[], query: string): Can[] {
  const q = query.trim().toLowerCase();
  if (!q) return cans;
  return cans.filter((can) => can.nome.toLowerCase().includes(q));
}
