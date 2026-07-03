import type { Can } from './types';

export interface Stats {
  total: number;
  withPhoto: number;
  promo: number;
  countries: number;
  full: number;
}

export function computeStats(cans: Can[]): Stats {
  return {
    total: cans.length,
    withPhoto: cans.filter((c) => c.p1).length,
    promo: cans.filter((c) => c.promo).length,
    countries: new Set(cans.map((c) => c.lingua?.trim()).filter(Boolean)).size,
    full: cans.filter((c) => (c.note ?? '').toUpperCase().includes('FULL')).length,
  };
}

// Somma del valore stimato (campo `valore`) di una lista di lattine.
export function sumValue(cans: Can[]): number {
  return cans.reduce((s, c) => s + (parseFloat(c.valore ?? '') || 0), 0);
}

export interface Freq {
  k: string;
  n: number;
}

// Frequenza per campo (via selettore), ordinata per conteggio desc (poi
// alfabetico), troncata a `limit`. Valori vuoti ignorati.
export function statsBreakdown(
  cans: Can[],
  sel: (c: Can) => string | undefined,
  limit: number,
): Freq[] {
  const counts = new Map<string, number>();
  for (const c of cans) {
    const v = sel(c)?.trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([k, n]) => ({ k, n }))
    .sort((a, b) => b.n - a.n || a.k.localeCompare(b.k))
    .slice(0, limit);
}
