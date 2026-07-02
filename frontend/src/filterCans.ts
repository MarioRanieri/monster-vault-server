import type { Can } from './types';

export interface CanFilters {
  query?: string;
  withPhoto?: boolean;
  promo?: boolean;
}

// Applica tutti i criteri insieme (AND); un filtro assente non restringe.
export function filterCans(cans: Can[], filters: CanFilters): Can[] {
  const q = (filters.query ?? '').trim().toLowerCase();
  return cans.filter((can) => {
    if (q && !can.nome.toLowerCase().includes(q)) return false;
    if (filters.withPhoto && !can.p1) return false;
    if (filters.promo && !can.promo) return false;
    return true;
  });
}
