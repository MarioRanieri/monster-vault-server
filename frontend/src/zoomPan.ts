// Matematica dello zoom/pan del lightbox. Trasformazione dell'immagine:
// translate(x, y) scale(scale), origine al centro. Le coordinate dei punti
// sono relative al centro del contenitore.

export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export const ZOOM_RESET: ZoomState = { scale: 1, x: 0, y: 0 };

const MIN = 1;
const MAX = 4;

// Zoom moltiplicativo verso un punto: il punto dell'immagine sotto (cx, cy)
// resta fermo mentre la scala cambia (t' = p − (p − t)·k). Sotto 1.05 aggancia
// al reset, come il vecchio.
export function zoomAt(z: ZoomState, factor: number, cx: number, cy: number): ZoomState {
  const scale = Math.min(MAX, Math.max(MIN, z.scale * factor));
  if (scale <= 1.05) return ZOOM_RESET;
  const k = scale / z.scale;
  return { scale, x: cx - (cx - z.x) * k, y: cy - (cy - z.y) * k };
}

// Pan attivo solo da zoomati: a scala 1 il trascinamento non deve spostare nulla.
export function panBy(z: ZoomState, dx: number, dy: number): ZoomState {
  return z.scale > 1 ? { ...z, x: z.x + dx, y: z.y + dy } : z;
}
