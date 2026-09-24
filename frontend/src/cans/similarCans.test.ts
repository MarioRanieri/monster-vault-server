import type { Can } from '../app/types';
import { findSimilarCans } from './similarCans';

const c = (id: string, nome: string, lingua = '', p1?: string): Can => ({ id, nome, lingua, p1 });

const CANS: Can[] = [
  c('1', 'MANGO LOCO SILVER SYMBOLS', 'MEXICO', 'a.jpg'),
  c('2', 'MANGO LOCO SMALL LOGO', 'MEXICO'),
  c('3', 'MANGO LOCO COD MW3', 'SOUTH AFRICA', 'b.jpg'),
  c('4', 'ULTRA PARADISE', 'MEXICO'),
];

test('ordina per parole del nome in comune, poi stesso paese, poi foto', () => {
  const r = findSimilarCans(CANS, { nome: 'MANGO LOCO', lingua: 'MEXICO' });
  expect(r.map((x) => x.id)).toEqual(['1', '2', '3']);
});

test('serve almeno una parola in comune: il solo paese non basta', () => {
  expect(findSimilarCans(CANS, { nome: 'ASSAULT', lingua: 'MEXICO' })).toEqual([]);
});

test('esclude la lattina che stai modificando e limita a 3', () => {
  const r = findSimilarCans(CANS, { id: '1', nome: 'MANGO LOCO SILVER SYMBOLS', lingua: 'MEXICO' });
  expect(r.map((x) => x.id)).not.toContain('1');
  expect(r.length).toBeLessThanOrEqual(3);
});

test('nome vuoto o di una lettera: nessun suggerimento', () => {
  expect(findSimilarCans(CANS, { nome: '', lingua: 'MEXICO' })).toEqual([]);
  expect(findSimilarCans(CANS, { nome: 'M', lingua: 'MEXICO' })).toEqual([]);
});
