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

export type Corner = 'tl' | 'tr' | 'bl' | 'br';
// Maniglia: un angolo, o un lato intero (come in Foto su iPhone, si prende
// ovunque lungo il bordo). Le lettere dicono quali bordi si muovono.
export type Handle = Corner | 't' | 'r' | 'b' | 'l';

const MIN = 24; // lato minimo del ritaglio, in pixel dell'immagine mostrata

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Sposta il rettangolo dentro l'area WxH senza cambiarne le dimensioni: arrivato
// al bordo si ferma (trascinandolo non si deve deformare).
export function moveRect(r: Rect, dx: number, dy: number, w: number, h: number): Rect {
  return {
    ...r,
    x: clamp(r.x + dx, 0, Math.max(0, w - r.w)),
    y: clamp(r.y + dy, 0, Math.max(0, h - r.h)),
  };
}

// Trascina una maniglia verso (px,py): si muovono solo i bordi che nomina (un
// lato ignora l'altra coordinata), l'opposto resta fermo, il lato non scende
// sotto MIN e il rettangolo non esce dall'area.
export function resizeRect(
  r: Rect,
  handle: Handle,
  px: number,
  py: number,
  w: number,
  h: number,
): Rect {
  const x = clamp(px, 0, w);
  const y = clamp(py, 0, h);
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  const left = handle.includes('l') ? Math.min(x, right - MIN) : r.x;
  const top = handle.includes('t') ? Math.min(y, bottom - MIN) : r.y;
  const newRight = handle.includes('r') ? Math.max(x, r.x + MIN) : right;
  const newBottom = handle.includes('b') ? Math.max(y, r.y + MIN) : bottom;
  return { x: left, y: top, w: newRight - left, h: newBottom - top };
}

// Quanto ingrandire un'immagine WxH ruotata di `rad` perché copra ancora tutto
// il suo riquadro: senza, agli angoli comparirebbero triangoli vuoti.
export function coverScale(w: number, h: number, rad: number): number {
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return Math.max((w * c + h * s) / w, (w * s + h * c) / h);
}
