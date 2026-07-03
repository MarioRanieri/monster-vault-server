// Modello minimo di una lattina, per ora solo i campi che servono alla griglia
// read-only. Si estende quando le fasi successive introducono editing/dettaglio.
export interface Can {
  id: string;
  nome: string;
  sku?: string;
  produttore?: string;
  size?: string;
  lingua?: string;
  top?: string;
  note?: string;
  promo?: string;
  stato?: string;
  valore?: string;
  descrizione?: string;
  watch?: boolean;
  photoAt?: number; // timestamp ultima foto (per "recently photographed")
  updatedAt?: number;
  p1?: string; // URL foto, slot 1-4
  p2?: string;
  p3?: string;
  p4?: string;
}
