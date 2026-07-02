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

test('withPhoto tiene solo i cans con foto', () => {
  expect(filterCans(cans, { withPhoto: true }).map((c) => c.nome)).toEqual(['Alpha']);
});

test('promo tiene solo i cans in promo', () => {
  expect(filterCans(cans, { promo: true }).map((c) => c.nome)).toEqual(['Beta']);
});

test('i filtri si combinano in AND', () => {
  expect(filterCans(cans, { query: 'a', withPhoto: true }).map((c) => c.nome)).toEqual(['Alpha']);
});
