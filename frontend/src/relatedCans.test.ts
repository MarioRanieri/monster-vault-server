import { pickRelated, lineupKey, sameLineupPool, rankByRelevance } from './relatedCans';
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

  test('con wordCount 1 prende solo la prima parola', () => {
    expect(lineupKey('OG COD MW3', 1)).toBe('OG');
  });
});

describe('sameLineupPool', () => {
  test('non mischia mai promo e non-promo', () => {
    const target = can({ id: 't', nome: 'OG Nico Hischier', promo: 'YES' });
    const cans = [
      target,
      can({ id: 'p1', nome: 'OG Ken Block', promo: 'YES' }),
      can({ id: 'n1', nome: 'OG Original' }), // stessa linea, ma non promo
      can({ id: 'n2', nome: 'OG Original 2' }),
    ];
    const result = sameLineupPool(cans, target);
    expect(result.every((c) => c.promo === 'YES')).toBe(true);
    expect(result.map((c) => c.id)).not.toContain('n1');
    expect(result.map((c) => c.id)).not.toContain('n2');
  });

  test('allarga a 1 parola se il match a 2 parole ha meno di 4 lattine', () => {
    const target = can({ id: 't', nome: 'OG Nico Hischier' });
    const cans = [
      target,
      can({ id: 'a', nome: 'OG Nico Other' }), // stesse 2 parole: solo 2 nel gruppo, < 4
      can({ id: 'b', nome: 'OG Ken Block' }), // solo 1 parola in comune
      can({ id: 'c', nome: 'OG First' }),
      can({ id: 'd', nome: 'OG Second' }),
    ];
    const result = sameLineupPool(cans, target);
    // Allargato a "OG": tutte le altre 4 lattine OG, non solo "OG Nico Other".
    expect(result.length).toBe(4);
  });

  test('resta sulle 2 parole se il gruppo raggiunge la soglia', () => {
    const target = can({ id: 't', nome: 'Ultra White A' });
    const cans = [
      target,
      can({ id: 'w1', nome: 'Ultra White B' }),
      can({ id: 'w2', nome: 'Ultra White C' }),
      can({ id: 'w3', nome: 'Ultra White D' }),
      can({ id: 'w4', nome: 'Ultra White E' }), // 4 = soglia: resta a 2 parole
      can({ id: 'r1', nome: 'Ultra Red A' }), // 1 parola in comune, ma 2 parole diverse
    ];
    const result = sameLineupPool(cans, target);
    expect(result.length).toBe(4); // solo le altre 4 "Ultra White"
    expect(result.map((c) => c.id)).not.toContain('r1');
  });
});

describe('rankByRelevance', () => {
  const target = can({ id: 't', nome: 'X', lingua: 'ITALY', size: '500ML' });

  test('stessa nazione viene prima di nazione diversa', () => {
    const cans = [can({ id: 'diff', lingua: 'GERMANY' }), can({ id: 'same', lingua: 'ITALY' })];
    const result = rankByRelevance(cans, target);
    expect(result[0].id).toBe('same');
  });

  test('a parità di nazione, stessa size viene prima', () => {
    const cans = [
      can({ id: 'diffSize', lingua: 'ITALY', size: '355ML' }),
      can({ id: 'sameSize', lingua: 'ITALY', size: '500ML' }),
    ];
    const result = rankByRelevance(cans, target);
    expect(result[0].id).toBe('sameSize');
  });

  test('a parità di nazione e size, con foto viene prima', () => {
    const cans = [
      can({ id: 'noPhoto', lingua: 'ITALY', size: '500ML' }),
      can({ id: 'photo', lingua: 'ITALY', size: '500ML', p1: 'https://x/1.jpg' }),
    ];
    const result = rankByRelevance(cans, target);
    expect(result[0].id).toBe('photo');
  });

  test('non perde nessuna lattina, riordina soltanto', () => {
    const cans = Array.from({ length: 6 }, (_, i) => can({ id: `c${i}` }));
    const result = rankByRelevance(cans, target);
    expect(result.length).toBe(6);
    expect(new Set(result.map((c) => c.id))).toEqual(new Set(cans.map((c) => c.id)));
  });
});
