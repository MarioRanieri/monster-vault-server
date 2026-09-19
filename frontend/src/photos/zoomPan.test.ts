import { ZOOM_RESET, zoomAt, panBy } from './zoomPan';

test('zoomAt scala verso il punto: il punto sotto il cursore resta fermo', () => {
  // punto a (100, 50) dal centro, zoom 2x da stato neutro:
  // la posizione resa del punto (q*s + t) deve restare (100, 50)
  const z = zoomAt(ZOOM_RESET, 2, 100, 50);
  expect(z.scale).toBe(2);
  // q = punto immagine sotto il cursore prima dello zoom = (100, 50) con s=1,t=0
  expect(100 * z.scale + z.x).toBe(100 * 2 + z.x); // identità di verifica
  expect(50 * 1 * 2 + z.y).toBeCloseTo(50 * 2 + z.y);
  // formula: t' = p - (p - t) * k → x = 100 - 100*2 = -100
  expect(z.x).toBe(-100);
  expect(z.y).toBe(-50);
});

test('zoomAt clampa tra 1 e 4', () => {
  expect(zoomAt(ZOOM_RESET, 100, 0, 0).scale).toBe(4);
  expect(zoomAt({ scale: 4, x: 0, y: 0 }, 2, 0, 0).scale).toBe(4);
});

test('zoomAt sotto 1.05 aggancia al reset (come il vecchio)', () => {
  expect(zoomAt({ scale: 1.2, x: 30, y: 30 }, 0.8, 0, 0)).toEqual(ZOOM_RESET);
});

test('panBy sposta solo quando si è zoomati', () => {
  expect(panBy({ scale: 2, x: 10, y: 10 }, 5, -5)).toEqual({ scale: 2, x: 15, y: 5 });
  expect(panBy(ZOOM_RESET, 5, 5)).toEqual(ZOOM_RESET);
});
