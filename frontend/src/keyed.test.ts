import { keyed } from './keyed';

test('chiavi uniche per testi diversi: testo + occorrenza 0', () => {
  expect(keyed(['a', 'b'], (s) => s).map((x) => x.key)).toEqual(['a#0', 'b#0']);
});

test('testi ripetuti ricevono un numero di occorrenza crescente', () => {
  expect(keyed(['gold', 'gold', 'red', 'gold'], (s) => s).map((x) => x.key)).toEqual([
    'gold#0',
    'gold#1',
    'red#0',
    'gold#2',
  ]);
});

test('restituisce l’elemento originale accanto alla chiave', () => {
  const items = [{ text: 'x' }];
  expect(keyed(items, (i) => i.text)[0].item).toBe(items[0]);
});

test('lista vuota → lista vuota', () => {
  expect(keyed([], () => '')).toEqual([]);
});
