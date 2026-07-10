import type { Can } from './types';

export interface CanFilters {
  query?: string;
  withPhoto?: boolean;
  noPhoto?: boolean;
  promo?: boolean;
  full?: boolean;
  lingua?: string;
  size?: string;
  produttore?: string;
  top?: string;
  stato?: string; // match esatto; si attiva solo dal click nelle stats

  vmin?: number;
  vmax?: number;
  ymin?: number;
  ymax?: number;
}

const num = (v?: string) => Number.parseFloat(v ?? '') || 0;
const isFull = (can: Can) => (can.note ?? '').toUpperCase().includes('FULL');

// Una lattina è "in promo" se il campo è valorizzato. Il form salva "" quando
// si sceglie No, ma import vecchi hanno lasciato il letterale "NO"/"No": va
// trattato come non-promo (niente badge, escluso dal filtro e dalle stats).
export const hasPromo = (promo?: string): boolean => {
  const p = (promo ?? '').trim().toLowerCase();
  return p !== '' && p !== 'no';
};

// Anno di produzione dallo SKU (es. 0610 = 06/2010, 093 = 09/2003). null se non
// interpretabile (SKU non composto da soli 3-4 cifre o mese fuori range).
export function extractYearFromCan(can: Can): number | null {
  const s = String(can.sku ?? '').trim();
  if (!/^\d{3,4}$/.test(s)) return null;
  const mm = Number.parseInt(s.slice(0, 2), 10);
  if (mm < 1 || mm > 12) return null;
  return 2000 + Number.parseInt(s.slice(2), 10);
}

// Applica tutti i criteri insieme (AND); un filtro assente non restringe.
// La query cerca in nome + SKU + note (come il vecchio).
export function filterCans(cans: Can[], filters: CanFilters): Can[] {
  const q = (filters.query ?? '').trim().toLowerCase();
  return cans.filter((can) => {
    if (q) {
      const hay = `${can.nome} ${can.sku ?? ''} ${can.note ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.withPhoto && !can.p1) return false;
    if (filters.noPhoto && can.p1) return false;
    if (filters.promo && !hasPromo(can.promo)) return false;
    if (filters.full && !isFull(can)) return false;
    if (filters.lingua && can.lingua !== filters.lingua) return false;
    if (filters.size && can.size !== filters.size) return false;
    if (filters.produttore && can.produttore !== filters.produttore) return false;
    if (filters.top && can.top !== filters.top) return false;
    if (filters.stato && can.stato !== filters.stato) return false;
    if (filters.vmin != null && num(can.valore) < filters.vmin) return false;
    if (filters.vmax != null && num(can.valore) > filters.vmax) return false;
    if (filters.ymin != null || filters.ymax != null) {
      const y = extractYearFromCan(can);
      if (y == null) return false;
      if (filters.ymin != null && y < filters.ymin) return false;
      if (filters.ymax != null && y > filters.ymax) return false;
    }
    return true;
  });
}

export type SortKey = 'added-desc' | 'nome-asc' | 'lingua-asc' | 'valore-desc' | 'valore-asc';

// Ordina una copia (non muta l'input).
export function sortCans(cans: Can[], sort: SortKey): Can[] {
  const arr = [...cans];
  switch (sort) {
    case 'added-desc':
      // Le lattine fotografate vengono sempre prima (p1 presente): senza questa
      // chiave i tanti scatti con photoAt=0 si mescolano alle no-foto e il guest
      // apre su un muro di placeholder. Poi: più recenti prima (photoAt, updatedAt).
      return arr.sort((a, b) => {
        const p = (b.p1 ? 1 : 0) - (a.p1 ? 1 : 0);
        if (p !== 0) return p;
        const d = (b.photoAt ?? 0) - (a.photoAt ?? 0);
        return d !== 0 ? d : (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      });
    case 'lingua-asc':
      return arr.sort((a, b) => (a.lingua ?? '').localeCompare(b.lingua ?? ''));
    case 'valore-desc':
      return arr.sort((a, b) => num(b.valore) - num(a.valore));
    case 'valore-asc':
      return arr.sort((a, b) => num(a.valore) - num(b.valore));
    case 'nome-asc':
    default:
      return arr.sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''));
  }
}

export interface FilterOptions {
  countries: string[];
  sizes: string[];
  manufacturers: string[];
  tops: string[];
}

// Valori distinti (ordinati) per popolare i dropdown.
export function filterOptions(cans: Can[]): FilterOptions {
  const distinct = (sel: (c: Can) => string | undefined, cmp?: (a: string, b: string) => number) =>
    [...new Set(cans.map((c) => sel(c)?.trim()).filter((v): v is string => Boolean(v)))].sort(
      cmp ?? ((a, b) => a.localeCompare(b)),
    );
  // le taglie vanno per ml crescenti (89ML < 90ML < 250ML < 500ML), non alfabetico
  const sizeMl = (s: string) => Number.parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  return {
    countries: distinct((c) => c.lingua),
    sizes: distinct(
      (c) => c.size,
      (a, b) => sizeMl(a) - sizeMl(b) || a.localeCompare(b),
    ),
    manufacturers: distinct((c) => c.produttore),
    tops: distinct((c) => c.top),
  };
}
