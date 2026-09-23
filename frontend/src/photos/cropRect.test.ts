import { coverScale, moveRect, normalizeRect, resizeRect } from './cropRect';

test('normalizeRect: drag da alto-sx a basso-dx', () => {
  expect(normalizeRect(10, 10, 40, 50)).toEqual({ x: 10, y: 10, w: 30, h: 40 });
});

test('normalizeRect: drag inverso dà lo stesso rettangolo', () => {
  expect(normalizeRect(40, 50, 10, 10)).toEqual({ x: 10, y: 10, w: 30, h: 40 });
});

test('normalizeRect: drag nullo → rettangolo a zero', () => {
  expect(normalizeRect(5, 5, 5, 5)).toEqual({ x: 5, y: 5, w: 0, h: 0 });
});

test('moveRect sposta il rettangolo e lo tiene dentro i bordi', () => {
  const r = { x: 10, y: 10, w: 40, h: 20 };
  expect(moveRect(r, 5, 5, 100, 100)).toEqual({ x: 15, y: 15, w: 40, h: 20 });
  // oltre il bordo: si ferma, non si deforma
  expect(moveRect(r, 999, 999, 100, 100)).toEqual({ x: 60, y: 80, w: 40, h: 20 });
  expect(moveRect(r, -999, -999, 100, 100)).toEqual({ x: 0, y: 0, w: 40, h: 20 });
});

test('resizeRect trascina un angolo, tenendo il lato opposto fermo', () => {
  const r = { x: 20, y: 20, w: 40, h: 40 };
  expect(resizeRect(r, 'br', 80, 70, 100, 100)).toEqual({ x: 20, y: 20, w: 60, h: 50 });
  expect(resizeRect(r, 'tl', 10, 5, 100, 100)).toEqual({ x: 10, y: 5, w: 50, h: 55 });
});

test('resizeRect non scende sotto la dimensione minima né esce dai bordi', () => {
  const r = { x: 20, y: 20, w: 40, h: 40 };
  const tiny = resizeRect(r, 'br', 21, 21, 100, 100);
  expect(tiny.w).toBeGreaterThanOrEqual(24);
  expect(tiny.h).toBeGreaterThanOrEqual(24);
  const out = resizeRect(r, 'br', 500, 500, 100, 100);
  expect(out.x + out.w).toBeLessThanOrEqual(100);
  expect(out.y + out.h).toBeLessThanOrEqual(100);
});

test('coverScale: a 0° non ingrandisce, ruotando sì (niente angoli vuoti)', () => {
  expect(coverScale(100, 100, 0)).toBe(1);
  const s = coverScale(100, 100, (10 * Math.PI) / 180);
  expect(s).toBeGreaterThan(1);
  // il quadrato ruotato di 10° deve coprire: cos+sin
  expect(s).toBeCloseTo(Math.cos(Math.PI / 18) + Math.sin(Math.PI / 18), 5);
});
