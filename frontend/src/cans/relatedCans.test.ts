import {
  pickRelated,
  lineupKey,
  sameLineupPool,
  rankByRelevance,
  sameLineupGroups,
} from './relatedCans';
import type { Can } from '../types';

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

const byId = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b));
// Genera N varianti con lo stesso nome (stesso prodotto, id diversi) — evita
// di ripetere N oggetti letterali quasi identici nelle tabelle di test qui sotto.
const named = (nome: string, ids: string[], extra: Partial<Can> = {}) =>
  ids.map((id) => ({ id, nome, ...extra }));
// Come `named`, ma con nomi diversi per variante (es. "OG Ken Block", "OG First"...).
const variants = (specs: [id: string, nome: string][], extra: Partial<Can> = {}) =>
  specs.map(([id, nome]) => ({ id, nome, ...extra }));

describe('sameLineupPool', () => {
  test.each([
    {
      desc: 'non mischia mai promo e non-promo',
      target: { id: 't', nome: 'OG Nico Hischier', promo: 'YES' },
      others: [
        { id: 'p1', nome: 'OG Ken Block', promo: 'YES' },
        { id: 'n1', nome: 'OG Original' }, // stessa linea, ma non promo → escluso
        { id: 'n2', nome: 'OG Original 2' },
      ],
      expectedIds: ['p1'],
    },
    {
      desc: 'allarga a 1 parola se il match a 2 parole ha meno di 4 lattine',
      target: { id: 't', nome: 'OG Nico Hischier' },
      others: [
        { id: 'a', nome: 'OG Nico Other' }, // stesse 2 parole: solo 2 nel gruppo, < 4
        { id: 'b', nome: 'OG Ken Block' }, // solo 1 parola in comune
        { id: 'c', nome: 'OG First' },
        { id: 'd', nome: 'OG Second' },
      ],
      // Allargato a "OG": tutte le altre 4, non solo "OG Nico Other".
      expectedIds: ['a', 'b', 'c', 'd'],
    },
    {
      desc: 'resta sulle 2 parole se il gruppo raggiunge la soglia',
      target: { id: 't', nome: 'Ultra White A' },
      others: [
        // 4 = soglia: resta a 2 parole.
        ...variants([
          ['w1', 'Ultra White B'],
          ['w2', 'Ultra White C'],
          ['w3', 'Ultra White D'],
          ['w4', 'Ultra White E'],
        ]),
        { id: 'r1', nome: 'Ultra Red A' }, // 1 parola in comune, 2 parole diverse → escluso
      ],
      expectedIds: ['w1', 'w2', 'w3', 'w4'],
    },
    {
      desc: 'preferisce nome a 2 parole + stessa nazione quando basta',
      target: { id: 't', nome: 'Hydro Mean Green', lingua: 'USA' },
      others: [
        ...named('Hydro Mean Green', ['us1', 'us2', 'us3', 'us4'], { lingua: 'USA' }), // 4 = soglia
        { id: 'uk1', nome: 'Hydro Mean Green', lingua: 'UK' }, // stesso nome, altra nazione → escluso
      ],
      expectedIds: ['us1', 'us2', 'us3', 'us4'],
    },
    {
      // 2 parole + nazione: troppo poche. 1 parola + nazione: raggiunge la soglia
      // → NON deve rilassare la nazione, anche se ce ne sarebbero altre a 2
      // parole in altre nazioni.
      desc: 'rilassa la nazione solo dopo aver provato entrambe le larghezze di nome',
      target: { id: 't', nome: 'OG Nico Hischier', promo: 'YES', lingua: 'SWISS' },
      others: [
        // 4 = soglia.
        ...variants(
          [
            ['ch1', 'OG Ken Block'],
            ['ch2', 'OG First'],
            ['ch3', 'OG Second'],
            ['ch4', 'OG Third'],
          ],
          { promo: 'YES', lingua: 'SWISS' },
        ),
        { id: 'other', nome: 'OG Nico Other', promo: 'YES', lingua: 'GERMANY' }, // escluso
      ],
      expectedIds: ['ch1', 'ch2', 'ch3', 'ch4'],
    },
    {
      // Nessun tentativo raggiunge 4: usa l'ultimo (1 parola, ogni nazione) → tutte.
      desc: 'rilassa la nazione come ultima spiaggia se anche 1 parola + nazione è troppo poco',
      target: { id: 't', nome: 'Rare Flavor', lingua: 'JAPAN' },
      others: [
        { id: 'jp1', nome: 'Rare Flavor 2', lingua: 'JAPAN' }, // solo 1 in JAPAN
        { id: 'us1', nome: 'Rare Flavor 3', lingua: 'USA' },
        { id: 'us2', nome: 'Rare Flavor 4', lingua: 'USA' },
        { id: 'us3', nome: 'Rare Flavor 5', lingua: 'USA' },
      ],
      expectedIds: ['jp1', 'us1', 'us2', 'us3'],
    },
  ])('$desc', ({ target, others, expectedIds }) => {
    const t = can(target);
    const cans = [t, ...others.map((o) => can(o))];
    const result = sameLineupPool(cans, t);
    expect(byId(result.map((c) => c.id))).toEqual(byId(expectedIds));
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

describe('sameLineupGroups', () => {
  test('lattina normale: un solo blocco senza etichetta (nazione-first)', () => {
    const target = can({ id: 't', nome: 'Hydro Mean Green', lingua: 'USA' });
    const cans = [
      target,
      can({ id: 'us1', nome: 'Hydro Mean Green', lingua: 'USA' }),
      can({ id: 'us2', nome: 'Hydro Mean Green', lingua: 'USA' }),
      can({ id: 'us3', nome: 'Hydro Mean Green', lingua: 'USA' }),
      can({ id: 'us4', nome: 'Hydro Mean Green', lingua: 'USA' }),
      can({ id: 'uk1', nome: 'Hydro Mean Green', lingua: 'UK' }),
    ];
    const groups = sameLineupGroups(cans, target);
    expect(groups.length).toBe(1);
    expect(groups[0].label).toBeNull();
    expect(groups[0].cans.every((c) => c.lingua === 'USA')).toBe(true);
  });

  test('promo con gemella in un’altra nazione: fascia A senza etichetta la cattura', () => {
    const target = can({ id: 'india', nome: 'OG Hardik Pandya', promo: 'YES', lingua: 'INDIA' });
    const trinidad = can({
      id: 'trin',
      nome: 'OG Hardik Pandya Trinidad',
      promo: 'YES',
      lingua: 'TRINIDAD',
    });
    const groups = sameLineupGroups([target, trinidad], target);
    expect(groups[0].label).toBeNull();
    expect(groups[0].cans.map((c) => c.id)).toEqual(['trin']);
  });

  test('promo unica al mondo: fascia A vuota, fascia B con le altre promo della stessa nazione', () => {
    const target = can({ id: 't', nome: 'OG Nico Hischier', promo: 'YES', lingua: 'SWISS' });
    const cans = [
      target,
      can({ id: 'ch1', nome: 'OG Ken Block', promo: 'YES', lingua: 'SWISS' }),
      can({ id: 'ch2', nome: 'OG First', promo: 'YES', lingua: 'SWISS' }),
      can({ id: 'de1', nome: 'OG Ken Block', promo: 'YES', lingua: 'GERMANY' }), // altra nazione
    ];
    const groups = sameLineupGroups(cans, target);
    // Fascia A vuota (nessuna gemella "OG Nico" altrove): non entra in groups.
    // Fascia B: le due promo svizzere. Fascia C: quella tedesca, come riempimento.
    expect(groups[0].label).toBe('Other SWISS promos');
    expect(groups[0].cans.map((c) => c.id).sort((a, b) => a.localeCompare(b))).toEqual([
      'ch1',
      'ch2',
    ]);
    expect(groups[1].label).toBe('Other rare promos');
    expect(groups[1].cans.map((c) => c.id)).toEqual(['de1']);
  });

  test('fascia C fa da riempimento finale con promo rare da ovunque', () => {
    const target = can({ id: 't', nome: 'OG Nico Hischier', promo: 'YES', lingua: 'SWISS' });
    const cans = [
      target,
      can({ id: 'other', nome: 'ULTRA WHITE THAR', promo: 'YES', lingua: 'INDIA' }),
    ];
    const groups = sameLineupGroups(cans, target);
    const last = groups.at(-1)!;
    expect(last.label).toBe('Other rare promos');
    expect(last.cans.map((c) => c.id)).toEqual(['other']);
  });

  test('non supera il limite totale sommando le fasce', () => {
    const target = can({ id: 't', nome: 'OG X', promo: 'YES', lingua: 'SWISS' });
    const cans = [
      target,
      ...Array.from({ length: 10 }, (_, i) =>
        can({ id: `c${i}`, nome: `OG Y${i}`, promo: 'YES', lingua: 'SWISS' }),
      ),
    ];
    const groups = sameLineupGroups(cans, target, 8);
    const total = groups.reduce((sum, g) => sum + g.cans.length, 0);
    expect(total).toBe(8);
  });
});
