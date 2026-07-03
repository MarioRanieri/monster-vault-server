import { normalizeRect } from './cropRect';

test('normalizeRect: drag da alto-sx a basso-dx', () => {
  expect(normalizeRect(10, 10, 40, 50)).toEqual({ x: 10, y: 10, w: 30, h: 40 });
});

test('normalizeRect: drag inverso dà lo stesso rettangolo', () => {
  expect(normalizeRect(40, 50, 10, 10)).toEqual({ x: 10, y: 10, w: 30, h: 40 });
});

test('normalizeRect: drag nullo → rettangolo a zero', () => {
  expect(normalizeRect(5, 5, 5, 5)).toEqual({ x: 5, y: 5, w: 0, h: 0 });
});
