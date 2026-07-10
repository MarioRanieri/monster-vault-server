import { COUNTRY_FLAGS } from './flags';
import * as mapData from '../public/map-data.js';

type Iso = { isos: string[]; regions: string[]; unknown: string[] };
const md = mapData as unknown as {
  MAP_COUNTRY: Record<string, string>;
  parseLinguaToIsos: (s: string) => Iso;
  skuKey: (sku: unknown) => number;
  flavourMatch: (name: unknown, words: RegExp[], exclude?: RegExp[]) => boolean;
  listGroups: (c: { lingua: string }) => string[];
};
const MAP_COUNTRY = md.MAP_COUNTRY;

describe('parseLinguaToIsos', () => {
  test('single country by name', () => {
    expect(md.parseLinguaToIsos('ITALY').isos).toEqual(['IT']);
  });
  test('multi-country splits on - / -> and →, deduping', () => {
    expect(md.parseLinguaToIsos('ALBANIA-ROMANIA').isos).toEqual(['AL', 'RO']);
    expect(md.parseLinguaToIsos('USA -> UK').isos).toEqual(['US', 'GB']);
    expect(md.parseLinguaToIsos('USA → USA').isos).toEqual(['US']);
    expect(md.parseLinguaToIsos('USA/USA').isos).toEqual(['US']);
  });
  test('expansion tokens explode to many ISOs', () => {
    expect(md.parseLinguaToIsos('BENELUX').isos).toEqual(['BE', 'NL', 'LU']);
  });
  test('regions and unknown tokens are bucketed, not treated as ISO', () => {
    const r = md.parseLinguaToIsos('EUROPE');
    expect(r.isos).toEqual([]);
    expect(r.regions).toEqual(['EUROPE']);
    expect(md.parseLinguaToIsos('ATLANTIS').unknown).toEqual(['ATLANTIS']);
  });
  test('bare 2-letter code passes through as ISO', () => {
    expect(md.parseLinguaToIsos('ZZ').isos).toEqual(['ZZ']);
  });
  test('empty / nullish is empty', () => {
    expect(md.parseLinguaToIsos('').isos).toEqual([]);
    expect(md.parseLinguaToIsos(null as unknown as string).isos).toEqual([]);
  });
});

describe('skuKey', () => {
  test('MMYY sorts oldest first (month + year)', () => {
    expect(md.skuKey('0610')).toBeLessThan(md.skuKey('0122')); // Jun 2010 < Jan 2022
    expect(md.skuKey('0106')).toBeLessThan(md.skuKey('1206')); // Jan 2006 < Dec 2006
  });
  test('3-digit SKU: the leading two digits are the month (110 = Nov 2000)', () => {
    expect(md.skuKey('110')).toBe(2000 * 100 + 11);
  });
  test('invalid month or non-date sorts to the end (Infinity)', () => {
    expect(md.skuKey('1310')).toBe(Infinity); // month 13
    expect(md.skuKey('0010')).toBe(Infinity); // month 00
    expect(md.skuKey('ABCD')).toBe(Infinity);
    expect(md.skuKey('')).toBe(Infinity);
    expect(md.skuKey(null)).toBe(Infinity);
  });
});

describe('flavourMatch', () => {
  test('matches when every word regex hits', () => {
    expect(md.flavourMatch('Rehab Lemonade', [/\brehab\b/i, /\blemon/i])).toBe(true);
    expect(md.flavourMatch('Rehab Tea', [/\brehab\b/i, /\blemon/i])).toBe(false);
  });
  test('exclude list vetoes a match', () => {
    expect(md.flavourMatch('OG Zero Sugar', [/\bog\b/i], [/zero ?sugar/i])).toBe(false);
    expect(md.flavourMatch('OG', [/\bog\b/i], [/zero ?sugar/i])).toBe(true);
  });
  test('nullish name is a non-match, not a crash', () => {
    expect(md.flavourMatch(null, [/\bog\b/i])).toBe(false);
  });
});

describe('listGroups', () => {
  test('normal can groups by its ISOs', () => {
    expect(md.listGroups({ lingua: 'ITALY-ROMANIA' })).toEqual(['IT', 'RO']);
  });
  test('CARIBBEAN collapses the islands into a single _CARIB group', () => {
    expect(md.listGroups({ lingua: 'CARIBBEAN' })).toEqual(['_CARIB']);
  });
});

// The map keeps its own country dictionary (deliberate copy: map.html is a static
// vanilla page, not part of the React bundle). This guard fails if the two drift
// on any key they share, catching silent divergence without a risky real dedup.
test('MAP_COUNTRY agrees with flags COUNTRY_FLAGS on every shared key', () => {
  const flags = COUNTRY_FLAGS as Record<string, string>;
  const drift: string[] = [];
  for (const key of Object.keys(MAP_COUNTRY)) {
    const inFlags = flags[key];
    if (inFlags !== undefined && inFlags !== MAP_COUNTRY[key]) {
      drift.push(`${key}: map=${MAP_COUNTRY[key]} flags=${inFlags}`);
    }
  }
  expect(drift).toEqual([]);
});
