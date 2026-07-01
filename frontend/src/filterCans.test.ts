import { filterCans } from './filterCans';
import type { Can } from './types';

const cans: Can[] = [
  { id: '1', nome: 'Alpha' },
  { id: '2', nome: 'Beta' },
  { id: '3', nome: 'Gamma' },
];

test('query vuota ritorna tutti i cans', () => {
  expect(filterCans(cans, '')).toEqual(cans);
});

test('filtra per nome, case-insensitive', () => {
  expect(filterCans(cans, 'alph').map((c) => c.nome)).toEqual(['Alpha']);
  expect(filterCans(cans, 'BET').map((c) => c.nome)).toEqual(['Beta']);
});

test('nessun match ritorna array vuoto', () => {
  expect(filterCans(cans, 'xyz')).toEqual([]);
});
