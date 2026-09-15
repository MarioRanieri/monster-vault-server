import { pickRelated, lineupKey } from './relatedCans';
import type { Can } from './types';

const can = (over: Partial<Can>): Can => ({ id: 'x', nome: 'X', ...over });

describe('pickRelated', () => {
  test('preferisce le lattine con foto quando ce ne sono almeno "limit"', () => {
    const withPhoto = Array.from({ length: 5 }, (_, i) =>
      can({ id: `p${i}`, p1: `https://x/${i}.jpg` }),
    );
    const withoutPhoto = Array.from({ length: 5 }, (_, i) => can({ id: `n${i}` }));
    const result = pickRelated([...withPhoto, ...withoutPhoto], 3);

    expect(result.length).toBe(3);
    expect(result.every((c) => c.p1)).toBe(true);
  });

  test('completa con quelle senza foto se non ce ne sono abbastanza con foto', () => {
    const withPhoto = [can({ id: 'p1', p1: 'https://x/1.jpg' })];
    const withoutPhoto = Array.from({ length: 4 }, (_, i) => can({ id: `n${i}` }));
    const result = pickRelated([...withPhoto, ...withoutPhoto], 3);

    expect(result.length).toBe(3);
    expect(result.some((c) => c.p1)).toBe(true);
    expect(result.filter((c) => !c.p1).length).toBe(2);
  });

  test('ritorna tutte le lattine se sono meno del limite', () => {
    const cans = [can({ id: 'a' }), can({ id: 'b' })];
    expect(pickRelated(cans, 8).length).toBe(2);
  });

  test("non inventa lattine: il risultato pesca solo dall'input", () => {
    const cans = Array.from({ length: 6 }, (_, i) => can({ id: `c${i}` }));
    const result = pickRelated(cans, 4);
    const inputIds = new Set(cans.map((c) => c.id));
    expect(result.every((c) => inputIds.has(c.id))).toBe(true);
    expect(new Set(result.map((c) => c.id)).size).toBe(4); // niente duplicati
  });
});

describe('lineupKey', () => {
  test('prende le prime due parole, maiuscole', () => {
    expect(lineupKey('Absolutely Zero Dark BF1')).toBe('ABSOLUTELY ZERO');
    expect(lineupKey('absolutely zero blue text 355')).toBe('ABSOLUTELY ZERO');
  });

  test('gestisce nomi di una sola parola', () => {
    expect(lineupKey('Nitro')).toBe('NITRO');
  });

  test('normalizza spazi multipli', () => {
    expect(lineupKey('OG   COD   MW3')).toBe('OG COD');
  });
});
