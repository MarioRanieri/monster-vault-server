import { filterCans } from './filterCans';
import type { Can } from './types';

const cans: Can[] = [
  { id: '1', nome: 'Alpha', p1: 'a.jpg' },
  { id: '2', nome: 'Beta', promo: 'Zero' },
  { id: '3', nome: 'Gamma' },
];

test('nessun filtro ritorna tutti i cans', () => {
  expect(filterCans(cans, {})).toEqual(cans);
});

test('query filtra per nome, case-insensitive', () => {
  expect(filterCans(cans, { query: 'alph' }).map((c) => c.nome)).toEqual(['Alpha']);
  expect(filterCans(cans, { query: 'BET' }).map((c) => c.nome)).toEqual(['Beta']);
});

test('la query cerca anche in sku e note', () => {
  const list: Can[] = [
    { id: '1', nome: 'A', sku: 'ZX9' },
    { id: '2', nome: 'B', note: 'special edition' },
    { id: '3', nome: 'C' },
  ];
  expect(filterCans(list, { query: 'zx9' }).map((c) => c.nome)).toEqual(['A']);
  expect(filterCans(list, { query: 'special' }).map((c) => c.nome)).toEqual(['B']);
});

test('withPhoto tiene solo i cans con foto', () => {
  expect(filterCans(cans, { withPhoto: true }).map((c) => c.nome)).toEqual(['Alpha']);
});

test('noPhoto tiene solo i cans senza foto', () => {
  expect(filterCans(cans, { noPhoto: true }).map((c) => c.nome)).toEqual(['Beta', 'Gamma']);
});

test('promo tiene solo i cans in promo', () => {
  expect(filterCans(cans, { promo: true }).map((c) => c.nome)).toEqual(['Beta']);
});

test('full tiene solo i cans con note FULL', () => {
  const list: Can[] = [
    { id: '1', nome: 'A', note: 'FULL can' },
    { id: '2', nome: 'B', note: 'empty' },
  ];
  expect(filterCans(list, { full: true }).map((c) => c.nome)).toEqual(['A']);
});

test('i filtri si combinano in AND', () => {
  expect(filterCans(cans, { query: 'a', withPhoto: true }).map((c) => c.nome)).toEqual(['Alpha']);
});
