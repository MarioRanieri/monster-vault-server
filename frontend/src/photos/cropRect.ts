export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Da due punti di un drag a un rettangolo normalizzato: origine in alto-sinistra,
// larghezza/altezza sempre positive (funziona in qualsiasi direzione di trascinamento).
export function normalizeRect(ax: number, ay: number, bx: number, by: number): Rect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  };
}
