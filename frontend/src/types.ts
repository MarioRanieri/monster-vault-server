// Modello minimo di una lattina, per ora solo i campi che servono alla griglia
// read-only. Si estende quando le fasi successive introducono editing/dettaglio.
export interface Can {
  id: string;
  nome: string;
  sku?: string;
  size?: string;
  promo?: string;
  stato?: string;
  p1?: string; // URL prima foto
}
