import { computeStats } from './computeStats';
import type { Can } from './types';

test('conta totale, con foto e in promo', () => {
  const cans: Can[] = [
    { id: '1', nome: 'A', p1: 'a.jpg', promo: 'Zero' },
    { id: '2', nome: 'B', p1: 'b.jpg' },
    { id: '3', nome: 'C' },
  ];
  expect(computeStats(cans)).toEqual({ total: 3, withPhoto: 2, promo: 1 });
});

test('su lista vuota è tutto zero', () => {
  expect(computeStats([])).toEqual({ total: 0, withPhoto: 0, promo: 0 });
});
