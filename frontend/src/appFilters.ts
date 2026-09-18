// Tutti i criteri di filtro in un unico oggetto: prima erano 14 useState
// duplicati in 5 punti (dichiarazione, restore, filtro, reset, share). `stato`
// non è condiviso (niente in ShareFilters) e si attiva solo dalle stats.
export interface Filters {
  query: string;
  lingua: string;
  size: string;
  produttore: string;
  top: string;
  stato: string;
  promo: boolean;
  full: boolean;
  withPhoto: boolean;
  noPhoto: boolean;
  // Admin-only (vedi filterCans): trova le lattine con `valore` mancante da
  // compilare — dato che i prezzi non sono condivisibili, resta fuori da
  // ShareFilters come `stato`.
  noValue: boolean;
  vmin: string;
  vmax: string;
  ymin: string;
  ymax: string;
}

export const NO_FILTERS: Filters = {
  query: '',
  lingua: '',
  size: '',
  produttore: '',
  top: '',
  stato: '',
  promo: false,
  full: false,
  withPhoto: false,
  noPhoto: false,
  noValue: false,
  vmin: '',
  vmax: '',
  ymin: '',
  ymax: '',
};
