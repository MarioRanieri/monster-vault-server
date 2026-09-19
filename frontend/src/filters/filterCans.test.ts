import { filterCans, sortCans, filterOptions, extractYearFromCan, hasPromo } from './filterCans';
import type { Can } from '../app/types';

test('hasPromo: valorizzato = promo, vuoto o "no" (legacy) = non promo', () => {
  expect(hasPromo('Yes')).toBe(true);
  expect(hasPromo('Christmas')).toBe(true);
  expect(hasPromo('')).toBe(false);
  expect(hasPromo()).toBe(false);
  expect(hasPromo('NO')).toBe(false);
  expect(hasPromo('  No ')).toBe(false);
});

test('filtro promo esclude i valori legacy "NO"', () => {
  const list: Can[] = [
    { id: '1', nome: 'A', promo: 'Yes' },
    { id: '2', nome: 'B', promo: 'NO' },
    { id: '3', nome: 'C' },
  ];
  expect(filterCans(list, { promo: true }).map((c) => c.nome)).toEqual(['A']);
});

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

test('noValue tiene solo i cans senza valore stimato', () => {
  const withVal: Can[] = [
    { id: '1', nome: 'Alpha', valore: '10' },
    { id: '2', nome: 'Beta', valore: '' },
    { id: '3', nome: 'Gamma' },
  ];
  expect(filterCans(withVal, { noValue: true }).map((c) => c.nome)).toEqual(['Beta', 'Gamma']);
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

test('range prezzo (vmin/vmax) filtra su valore', () => {
  const list: Can[] = [
    { id: '1', nome: 'A', valore: '5' },
    { id: '2', nome: 'B', valore: '20' },
    { id: '3', nome: 'C', valore: '50' },
  ];
  expect(filterCans(list, { vmin: 10 }).map((c) => c.nome)).toEqual(['B', 'C']);
  expect(filterCans(list, { vmax: 20 }).map((c) => c.nome)).toEqual(['A', 'B']);
  expect(filterCans(list, { vmin: 10, vmax: 30 }).map((c) => c.nome)).toEqual(['B']);
});

test('extractYearFromCan legge l’anno dallo SKU', () => {
  expect(extractYearFromCan({ id: '1', nome: 'A', sku: '0610' })).toBe(2010);
  expect(extractYearFromCan({ id: '2', nome: 'B', sku: '093' })).toBe(2003);
  expect(extractYearFromCan({ id: '3', nome: 'C', sku: '1117 N' })).toBeNull();
  expect(extractYearFromCan({ id: '4', nome: 'D', sku: '9910' })).toBeNull(); // mese 99
});

test('range anno (ymin/ymax) filtra per anno da SKU', () => {
  const list: Can[] = [
    { id: '1', nome: 'A', sku: '0610' }, // 2010
    { id: '2', nome: 'B', sku: '0615' }, // 2015
    { id: '3', nome: 'C', sku: 'ABCD' }, // nessun anno
  ];
  expect(filterCans(list, { ymin: 2012 }).map((c) => c.nome)).toEqual(['B']);
  expect(filterCans(list, { ymax: 2012 }).map((c) => c.nome)).toEqual(['A']);
});

test('i filtri si combinano in AND', () => {
  expect(filterCans(cans, { query: 'a', withPhoto: true }).map((c) => c.nome)).toEqual(['Alpha']);
});

test('filtra per lingua/size/produttore/top (match esatto)', () => {
  const list: Can[] = [
    { id: '1', nome: 'A', lingua: 'USA', size: '500ml', produttore: 'X', top: 'gold' },
    { id: '2', nome: 'B', lingua: 'Italy', size: '250ml', produttore: 'Y', top: 'red' },
  ];
  expect(filterCans(list, { lingua: 'USA' }).map((c) => c.nome)).toEqual(['A']);
  expect(filterCans(list, { size: '250ml' }).map((c) => c.nome)).toEqual(['B']);
  expect(filterCans(list, { produttore: 'X' }).map((c) => c.nome)).toEqual(['A']);
  expect(filterCans(list, { top: 'red' }).map((c) => c.nome)).toEqual(['B']);
});

test('sortCans added-desc = recently photographed (photoAt desc)', () => {
  const list: Can[] = [
    { id: '1', nome: 'Old', photoAt: 100 },
    { id: '2', nome: 'New', photoAt: 200 },
    { id: '3', nome: 'None' },
  ];
  expect(sortCans(list, 'added-desc').map((c) => c.nome)).toEqual(['New', 'Old', 'None']);
});

test('sortCans added-desc leads with photographed cans even without photoAt', () => {
  // Molte lattine fotografate hanno photoAt=0 (import vecchi): la presenza di p1
  // deve comunque farle precedere le lattine senza foto (prima impressione guest).
  const list: Can[] = [
    { id: '1', nome: 'NoPhoto' },
    { id: '2', nome: 'Photographed', p1: 'x.jpg' },
  ];
  expect(sortCans(list, 'added-desc').map((c) => c.nome)).toEqual(['Photographed', 'NoPhoto']);
});

test('sortCans ordina per nome, lingua e valore senza mutare', () => {
  const list: Can[] = [
    { id: '1', nome: 'Beta', lingua: 'Zed', valore: '10' },
    { id: '2', nome: 'Alpha', lingua: 'Abc', valore: '30' },
  ];
  expect(sortCans(list, 'nome-asc').map((c) => c.nome)).toEqual(['Alpha', 'Beta']);
  expect(sortCans(list, 'lingua-asc').map((c) => c.lingua)).toEqual(['Abc', 'Zed']);
  expect(sortCans(list, 'valore-desc').map((c) => c.valore)).toEqual(['30', '10']);
  expect(sortCans(list, 'valore-asc').map((c) => c.valore)).toEqual(['10', '30']);
  expect(list[0].nome).toBe('Beta'); // input intatto
});

test('filterOptions estrae i valori distinti ordinati', () => {
  const list: Can[] = [
    { id: '1', nome: 'A', lingua: 'USA', size: '500ml', produttore: 'X', top: 'gold' },
    { id: '2', nome: 'B', lingua: 'Italy', size: '500ml', produttore: 'Y' },
  ];
  const opts = filterOptions(list);
  expect(opts.countries).toEqual(['Italy', 'USA']);
  expect(opts.sizes).toEqual(['500ml']);
  expect(opts.manufacturers).toEqual(['X', 'Y']);
  expect(opts.tops).toEqual(['gold']);
});

test('filterOptions esclude combinazioni impossibili in base agli altri filtri attivi (simmetrico)', () => {
  // Pattern reale (tools/sheet-sync/Monster Vault Sync.csv): TOP/TAB=BOTTLE
  // esiste solo su size 750ML (e altre bottiglie), mai su 355ML; 355ML ha
  // solo tab da lattina (SILVER, BLACK, ...), mai BOTTLE.
  const list: Can[] = [
    { id: '1', nome: 'Hydro Blue Ice', size: '750ML', top: 'BOTTLE' },
    { id: '2', nome: 'Absolutely Zero', size: '355ML', top: 'SILVER' },
    { id: '3', nome: 'Ultra Black', size: '355ML', top: 'BLACK' },
  ];
  // size=750ML → l'unico top esistente su quella size è BOTTLE.
  expect(filterOptions(list, { size: '750ML' }).tops).toEqual(['BOTTLE']);
  // top=SILVER → l'unica size esistente con quel top è 355ML (BOTTLE non c'entra).
  expect(filterOptions(list, { top: 'SILVER' }).sizes).toEqual(['355ML']);
  // il filtro attivo di un facet non deve restringere le opzioni di se stesso.
  expect(filterOptions(list, { size: '750ML' }).sizes).toEqual(['355ML', '750ML']);
});

test('filterOptions tiene visibile il valore attivo anche su una combinazione ormai impossibile (deep-link/saved view stale)', () => {
  const list: Can[] = [
    { id: '1', nome: 'Hydro Blue Ice', size: '750ML', top: 'BOTTLE' },
    { id: '2', nome: 'Absolutely Zero', size: '355ML', top: 'SILVER' },
  ];
  // size=750ML + top=SILVER non esiste in collezione (SILVER è solo su 355ML),
  // ma entrambi i value devono restare tra le rispettive option: altrimenti la
  // <select> risulterebbe deselezionata pur avendo il filtro ancora attivo.
  const opts = filterOptions(list, { size: '750ML', top: 'SILVER' });
  expect(opts.sizes).toContain('750ML');
  expect(opts.tops).toContain('SILVER');
});

test('query "ultra" riduce il risultato alle sole lattine che matchano, non torna tutta la lista', () => {
  // Riproduce il sospetto della segnalazione: un pool con più di 60 lattine dove
  // solo poche contengono "ultra" nel nome. Se il filtro fosse rotto (o applicato
  // dopo l'impaginazione) il risultato resterebbe grande quanto il pool.
  const pool: Can[] = [
    ...Array.from({ length: 58 }, (_, i) => ({ id: `p${i}`, nome: `Piraña ${i}` })),
    { id: 'u1', nome: 'Ultra Violet' },
    { id: 'u2', nome: 'Ultra Sunrise' },
  ];
  const result = filterCans(pool, { query: 'ultra' });
  expect(result.map((c) => c.nome)).toEqual(['Ultra Violet', 'Ultra Sunrise']);
  expect(result.length).toBeLessThan(pool.length);
});

test('query senza corrispondenze ritorna lista vuota', () => {
  const pool: Can[] = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, nome: `Piraña ${i}` }));
  expect(filterCans(pool, { query: 'zzz-non-esiste-zzz' })).toEqual([]);
});

test('filtra per stato (match esatto, dalle stats)', () => {
  const cans = [
    { id: '1', nome: 'A', stato: 'Damaged' },
    { id: '2', nome: 'B', stato: 'OK' },
    { id: '3', nome: 'C' },
  ];
  expect(filterCans(cans, { stato: 'Damaged' }).map((c) => c.id)).toEqual(['1']);
  expect(filterCans(cans, {}).map((c) => c.id)).toEqual(['1', '2', '3']);
});

test('range anno con entrambi i limiti e vmin (caratterizzazione)', () => {
  const list: Can[] = [
    { id: '1', nome: 'A', sku: '0610', valore: '5' }, // 2010
    { id: '2', nome: 'B', sku: '0613', valore: '15' }, // 2013
    { id: '3', nome: 'C', sku: '0618', valore: '25' }, // 2018
  ];
  expect(filterCans(list, { ymin: 2012, ymax: 2014 }).map((c) => c.nome)).toEqual(['B']);
  expect(filterCans(list, { vmin: 10 }).map((c) => c.nome)).toEqual(['B', 'C']);
});
