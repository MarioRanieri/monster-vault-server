import type { Can } from './types';

export interface CanFilters {
  query?: string;
  withPhoto?: boolean;
  noPhoto?: boolean;
  promo?: boolean;
  full?: boolean;
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
    return true;
  });
}
