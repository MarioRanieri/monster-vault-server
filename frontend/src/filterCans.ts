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
}

const isFull = (can: Can) => (can.note ?? '').toUpperCase().includes('FULL');

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
    if (filters.promo && !can.promo) return false;
    if (filters.full && !isFull(can)) return false;
    if (filters.lingua && can.lingua !== filters.lingua) return false;
    if (filters.size && can.size !== filters.size) return false;
    if (filters.produttore && can.produttore !== filters.produttore) return false;
    if (filters.top && can.top !== filters.top) return false;
    return true;
  });
}

export type SortKey = 'nome-asc' | 'lingua-asc' | 'valore-desc' | 'valore-asc';

const num = (v?: string) => parseFloat(v ?? '') || 0;

// Ordina una copia (non muta l'input).
export function sortCans(cans: Can[], sort: SortKey): Can[] {
  const arr = [...cans];
  switch (sort) {
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
  const distinct = (sel: (c: Can) => string | undefined) =>
    [...new Set(cans.map((c) => sel(c)?.trim()).filter((v): v is string => Boolean(v)))].sort(
      (a, b) => a.localeCompare(b),
    );
  return {
    countries: distinct((c) => c.lingua),
    sizes: distinct((c) => c.size),
    manufacturers: distinct((c) => c.produttore),
    tops: distinct((c) => c.top),
  };
}
