import {
  computeStats,
  statsBreakdown,
  sumValue,
  buildTimelineData,
  buildYearlyData,
  buildTopValue,
} from './computeStats';
import type { Can } from './types';

test('sumValue somma i valori, ignorando quelli vuoti/non numerici', () => {
  const list: Can[] = [
    { id: '1', nome: 'a', valore: '10' },
    { id: '2', nome: 'b', valore: '30.5' },
    { id: '3', nome: 'c' },
    { id: '4', nome: 'd', valore: 'n/a' },
  ];
  expect(sumValue(list)).toBe(40.5);
  expect(sumValue([])).toBe(0);
});

test('statsBreakdown conta, ordina desc e tronca al limite', () => {
  const list: Can[] = [
    { id: '1', nome: 'a', lingua: 'USA' },
    { id: '2', nome: 'b', lingua: 'USA' },
    { id: '3', nome: 'c', lingua: 'Italy' },
    { id: '4', nome: 'd' }, // lingua vuota → ignorata
  ];
  expect(statsBreakdown(list, (c) => c.lingua, 10)).toEqual([
    { k: 'USA', n: 2 },
    { k: 'Italy', n: 1 },
  ]);
  expect(statsBreakdown(list, (c) => c.lingua, 1)).toHaveLength(1);
});

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

test('buildTimelineData: 12 mesi, conteggio e valore per mese di updatedAt', () => {
  const now = Date.now();
  const key = new Date(now).toISOString().slice(0, 7);
  const data = buildTimelineData([
    { id: '1', nome: 'A', updatedAt: now, valore: '10' },
    { id: '2', nome: 'B', updatedAt: now, valore: '5.5' },
    { id: '3', nome: 'C' }, // senza data: ignorata
  ]);
  expect(data).toHaveLength(12);
  const cur = data.find((d) => d.k === key)!;
  expect(cur.n).toBe(2);
  expect(cur.v).toBe(15.5);
});

test('buildYearlyData: aggrega per anno, ordinato', () => {
  const y2020 = new Date('2020-06-01').getTime();
  const y2024 = new Date('2024-06-01').getTime();
  expect(
    buildYearlyData([
      { id: '1', nome: 'A', updatedAt: y2024, valore: '10' },
      { id: '2', nome: 'B', updatedAt: y2020 },
      { id: '3', nome: 'C', updatedAt: y2024 },
      { id: '4', nome: 'D' },
    ]),
  ).toEqual([
    { k: '2020', n: 1, v: 0 },
    { k: '2024', n: 2, v: 10 },
  ]);
});

test('buildTopValue: solo valore > 0, ordinate desc, troncate a n', () => {
  const rows = buildTopValue(
    [
      { id: '1', nome: 'A', valore: '5' },
      { id: '2', nome: 'B', valore: '50' },
      { id: '3', nome: 'C' },
      { id: '4', nome: 'D', valore: '20' },
    ],
    2,
  );
  expect(rows.map((c) => c.nome)).toEqual(['B', 'D']);
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
