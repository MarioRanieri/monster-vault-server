import {
  computeStats,
  statsBreakdown,
  sumValue,
  buildTimelineData,
  buildYearlyData,
  buildTopValue,
  addedThisMonth,
  latestAdditions,
} from './computeStats';
import type { Can } from '../app/types';

test('addedThisMonth conta max(createdAt, photoAt) nel mese corrente, ignora chi non ha nessuna data o è di un altro mese', () => {
  const now = new Date('2026-07-10T12:00:00Z');
  const inMonth = new Date('2026-07-02T08:00:00Z').getTime();
  const lastMonth = new Date('2026-06-28T08:00:00Z').getTime();
  const cans: Can[] = [
    { id: '1', nome: 'A', createdAt: inMonth }, // createdAt nel mese
    { id: '2', nome: 'B', photoAt: inMonth }, // legacy: solo photoAt, ma nel mese → conta
    { id: '3', nome: 'C', createdAt: lastMonth, photoAt: inMonth }, // createdAt vecchio, foto nuova → conta
    { id: '4', nome: 'D', createdAt: lastMonth }, // mese scorso → escluso
    { id: '5', nome: 'E' }, // nessuna data → escluso
  ];
  expect(addedThisMonth(cans, now)).toBe(3);
  expect(addedThisMonth([], now)).toBe(0);
});

test('latestAdditions: solo lattine con foto, ordinate per max(createdAt, photoAt) desc, troncate a limit', () => {
  const t1 = new Date('2026-01-01').getTime();
  const t2 = new Date('2026-02-01').getTime();
  const t3 = new Date('2026-03-01').getTime();
  const cans: Can[] = [
    { id: '1', nome: 'A', p1: 'a.jpg', createdAt: t1 },
    { id: '2', nome: 'B', p1: 'b.jpg', photoAt: t3 }, // photoAt più recente di createdAt di A
    { id: '3', nome: 'C', p1: 'c.jpg', createdAt: t2, photoAt: t1 }, // max = t2
    { id: '4', nome: 'D', createdAt: t3 }, // senza foto → escluso
    { id: '5', nome: 'E', p1: 'e.jpg' }, // senza nessuna data → escluso
  ];
  expect(latestAdditions(cans, 10).map((c) => c.id)).toEqual(['2', '3', '1']);
  expect(latestAdditions(cans, 2)).toHaveLength(2);
  expect(latestAdditions([], 8)).toEqual([]);
});

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
