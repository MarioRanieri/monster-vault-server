import { computeStats } from './computeStats';
import type { Can } from './types';

test('conta totale, con foto, promo, countries e full', () => {
  const cans: Can[] = [
    { id: '1', nome: 'A', p1: 'a.jpg', promo: 'Zero', lingua: 'USA', note: 'FULL' },
    { id: '2', nome: 'B', p1: 'b.jpg', lingua: 'Italy' },
    { id: '3', nome: 'C', lingua: 'USA' },
  ];
  expect(computeStats(cans)).toEqual({
    total: 3,
    withPhoto: 2,
    promo: 1,
    countries: 2, // USA, Italy (distinti)
    full: 1,
  });
});

test('su lista vuota è tutto zero', () => {
  expect(computeStats([])).toEqual({
    total: 0,
    withPhoto: 0,
    promo: 0,
    countries: 0,
    full: 0,
  });
});
