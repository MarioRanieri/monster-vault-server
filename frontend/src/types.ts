// ── Monster Vault — TypeScript interfaces ──────────────────────────────────

export interface Can {
  id: string;
  nome?: string;
  sku?: string;
  produttore?: string;
  size?: string;
  lingua?: string;
  top?: string;
  stato?: string;
  note?: string;
  promo?: string;
  valore?: string;
  descrizione?: string;
  p1?: string;
  p2?: string;
  p3?: string;
  p4?: string;
  p1Id?: string;
  p2Id?: string;
  p3Id?: string;
  p4Id?: string;
  updatedAt?: string;
  deletedAt?: string;
  photoAt?: number;
  watch?: boolean;
}

export interface ActiveChips {
  promo: boolean;
  full: boolean;
  confoto: boolean;
  nofoto: boolean;
}

export interface FilterState {
  q: string;
  sort: string;
  chips: ActiveChips;
  vmin: string;
  vmax: string;
  ymin?: string;
  ymax?: string;
  lingua?: string;
  size?: string;
  produttore?: string;
  top?: string;
}
