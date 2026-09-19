import type { Can } from '../app/types';

export interface CanFilters {
  query?: string;
  withPhoto?: boolean;
  noPhoto?: boolean;
  noValue?: boolean;
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

type Criterion = (can: Can, f: CanFilters) => boolean;

// La query cerca in nome + SKU + note (come il vecchio).
const matchesQuery: Criterion = (can, f) => {
  const q = (f.query ?? '').trim().toLowerCase();
  if (!q) return true;
  return `${can.nome} ${can.sku ?? ''} ${can.note ?? ''}`.toLowerCase().includes(q);
};

// Match esatto su un campo stringa: filtro assente (o vuoto) non restringe.
const matchesField =
  (key: 'lingua' | 'size' | 'produttore' | 'top' | 'stato'): Criterion =>
  (can, f) =>
    !f[key] || can[key] === f[key];

const matchesValue: Criterion = (can, f) =>
  (f.vmin == null || num(can.valore) >= f.vmin) && (f.vmax == null || num(can.valore) <= f.vmax);

// Con un limite d'anno attivo, le lattine senza anno interpretabile sono escluse.
const matchesYear: Criterion = (can, f) => {
  if (f.ymin == null && f.ymax == null) return true;
  const y = extractYearFromCan(can);
  if (y == null) return false;
  return (f.ymin == null || y >= f.ymin) && (f.ymax == null || y <= f.ymax);
};

const CRITERIA: Criterion[] = [
  matchesQuery,
  (can, f) => !f.withPhoto || !!can.p1,
  (can, f) => !f.noPhoto || !can.p1,
  (can, f) => !f.noValue || !can.valore,
  (can, f) => !f.promo || hasPromo(can.promo),
  (can, f) => !f.full || isFull(can),
  matchesField('lingua'),
  matchesField('size'),
  matchesField('produttore'),
  matchesField('top'),
  matchesField('stato'),
  matchesValue,
  matchesYear,
];

// Applica tutti i criteri insieme (AND); un filtro assente non restringe.
export function filterCans(cans: Can[], filters: CanFilters): Can[] {
  return cans.filter((can) => CRITERIA.every((criterion) => criterion(can, filters)));
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

// Valori distinti (ordinati) per popolare i dropdown. Ogni facet è calcolato
// sulle lattine ristrette dagli ALTRI filtri già attivi (mai dal proprio, o
// l'utente non potrebbe più deselezionarlo): così una combinazione che non
// esiste in collezione (es. size=750ML + top=SILVER, che in pratica è sempre
// BOTTLE) non compare mai come opzione selezionabile.
export function filterOptions(cans: Can[], filters: CanFilters = {}): FilterOptions {
  const distinct = (
    key: keyof CanFilters,
    sel: (c: Can) => string | undefined,
    cmp?: (a: string, b: string) => number,
  ) => {
    const pool = filterCans(cans, { ...filters, [key]: undefined });
    const values = new Set(pool.map((c) => sel(c)?.trim()).filter((v): v is string => Boolean(v)));
    // Il valore attivo del facet resta in lista anche se le altre lattine che
    // lo hanno non incrociano più gli altri filtri: altrimenti un deep-link o
    // una saved view con una combinazione ormai impossibile lascia la <select>
    // senza l'<option> corrispondente al suo stesso value (appare deselezionata
    // pur restando attiva sui risultati).
    const current = filters[key];
    if (typeof current === 'string' && current) values.add(current);
    return [...values].sort(cmp ?? ((a, b) => a.localeCompare(b)));
  };
  // le taglie vanno per ml crescenti (89ML < 90ML < 250ML < 500ML), non alfabetico
  const sizeMl = (s: string) => Number.parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  return {
    countries: distinct('lingua', (c) => c.lingua),
    sizes: distinct(
      'size',
      (c) => c.size,
      (a, b) => sizeMl(a) - sizeMl(b) || a.localeCompare(b),
    ),
    manufacturers: distinct('produttore', (c) => c.produttore),
    tops: distinct('top', (c) => c.top),
  };
}
