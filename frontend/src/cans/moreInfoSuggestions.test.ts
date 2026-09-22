import type { Can } from '../app/types';
import { suggestMoreInfo } from './moreInfoSuggestions';

const c = (id: string, nome: string, lingua: string, descrizione?: string): Can => ({
  id,
  nome,
  lingua,
  descrizione,
});

const CANS: Can[] = [
  c('1', 'PAPILLON SMALL LOGO', 'MEXICO', 'Small logo 0920 design'),
  c('2', 'KHAOS SMALL LOGO', 'MEXICO', 'Small logo 0920 design'),
  c('3', 'OG SMALL LOGO MEXICO', 'MEXICO', 'Small logo 0920 design'),
  c('4', 'MANGO LOCO SILVER SYMBOLS', 'MEXICO', 'Silver symbols design'),
  c('5', 'KHAOS SILVER SYMBOLS', 'MEXICO', 'Silver symbols design'),
  c('6', 'PIPELINE PUNCH', 'ECUADOR', 'Set Ecuador'),
  c('7', 'ULTRA WHITE', 'ECUADOR', 'Set Ecuador'),
  c('8', 'OG SMALL LOGO', 'USA', 'Other small logo'),
  c('9', 'OG', 'MEXICO'),
];

test('stessa nazione + parole del nome in comune: la variante giusta per prima', () => {
  const r = suggestMoreInfo(CANS, { nome: 'MANGO LOCO SMALL LOGO', lingua: 'MEXICO' });
  expect(r.map((s) => s.text)).toEqual(['Small logo 0920 design', 'Silver symbols design']);
  expect(r[0].count).toBe(3);
});

test('basta la nazione: tutte le Ecuador hanno "Set Ecuador"', () => {
  const r = suggestMoreInfo(CANS, { nome: 'MONSTER ASSAULT', lingua: 'ecuador ' });
  expect(r.map((s) => s.text)).toEqual(['Set Ecuador']);
});

test('senza nazione servono almeno 3 parole in comune', () => {
  expect(suggestMoreInfo(CANS, { nome: 'OG SMALL', lingua: '' })).toEqual([]);
  expect(suggestMoreInfo(CANS, { nome: 'OG SMALL LOGO', lingua: '' }).map((s) => s.text)).toContain(
    'Other small logo',
  );
});

test('bozza vuota: nessun suggerimento; al massimo 3; esclude la lattina stessa', () => {
  expect(suggestMoreInfo(CANS, { nome: '', lingua: '' })).toEqual([]);
  expect(suggestMoreInfo(CANS, { nome: 'X', lingua: 'MEXICO' }).length).toBeLessThanOrEqual(3);
  const own = suggestMoreInfo(CANS, { id: '6', nome: 'PIPELINE PUNCH', lingua: 'ECUADOR' });
  expect(own[0].count).toBe(1);
});
