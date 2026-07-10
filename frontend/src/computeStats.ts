import type { Can } from './types';
import { hasPromo } from './filterCans';

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
    promo: cans.filter((c) => hasPromo(c.promo)).length,
    countries: new Set(cans.map((c) => c.lingua?.trim()).filter(Boolean)).size,
    full: cans.filter((c) => (c.note ?? '').toUpperCase().includes('FULL')).length,
  };
}

// Somma del valore stimato (campo `valore`) di una lista di lattine.
export function sumValue(cans: Can[]): number {
  return cans.reduce((s, c) => s + (Number.parseFloat(c.valore ?? '') || 0), 0);
}

export interface Freq {
  k: string;
  n: number;
}

export interface TimelinePoint {
  k: string;
  n: number;
  v: number;
}

const val = (c: Can) => Number.parseFloat(c.valore ?? '') || 0;

// Ultimi 12 mesi (chiave 'YYYY-MM'): lattine e valore per mese di updatedAt.
export function buildTimelineData(cans: Can[]): TimelinePoint[] {
  const months: Record<string, { n: number; v: number }> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = { n: 0, v: 0 };
  }
  for (const c of cans) {
    if (!c.updatedAt) continue;
    const key = new Date(c.updatedAt).toISOString().slice(0, 7);
    if (Object.hasOwn(months, key)) {
      months[key].n++;
      months[key].v += val(c);
    }
  }
  return Object.keys(months)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => ({ k, ...months[k] }));
}

// Tutta la storia, aggregata per anno di updatedAt.
export function buildYearlyData(cans: Can[]): TimelinePoint[] {
  const years: Record<string, { n: number; v: number }> = {};
  for (const c of cans) {
    if (!c.updatedAt) continue;
    const y = String(new Date(c.updatedAt).getFullYear());
    years[y] ??= { n: 0, v: 0 };
    years[y].n++;
    years[y].v += val(c);
  }
  return Object.keys(years)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => ({ k, ...years[k] }));
}

// Le n lattine più preziose (solo valore > 0), ordinate per valore desc.
export function buildTopValue(cans: Can[], n = 10): Can[] {
  return cans
    .filter((c) => val(c) > 0)
    .sort((a, b) => val(b) - val(a))
    .slice(0, n);
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
