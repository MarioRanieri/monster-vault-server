import { describe, it, expect } from 'vitest';
import { calcVal, calcMatch, calcFilter, calcTotals } from '../../src/tools';
import { extractYearFromCan } from '../../src/core';
import type { Can } from '../../src/types';

describe('calcVal', () => {
  it('parses a numeric valore', () => {
    expect(calcVal({ valore: '3.5' })).toBe(3.5);
    expect(calcVal({ valore: '0' })).toBe(0);
  });
  it('returns null when missing or non-numeric', () => {
    expect(calcVal({})).toBeNull();
    expect(calcVal({ valore: null })).toBeNull();
    expect(calcVal({ valore: 'abc' })).toBeNull();
  });
});

describe('extractYearFromCan', () => {
  it('decodes the MMYY-style SKU (first 2 digits = month, rest = year)', () => {
    expect(extractYearFromCan({ sku: '0123' } as Can)).toBe(2023); // 01 / 23
    expect(extractYearFromCan({ sku: '1212' } as Can)).toBe(2012); // 12 / 12
    expect(extractYearFromCan({ sku: '123' } as Can)).toBe(2003); // 12 / 3
  });
  it('rejects an invalid month or a non 3-4 digit SKU', () => {
    expect(extractYearFromCan({ sku: '1305' } as Can)).toBeNull(); // month 13
    expect(extractYearFromCan({ sku: '0005' } as Can)).toBeNull(); // month 00
    expect(extractYearFromCan({ sku: '12' } as Can)).toBeNull(); // too short
    expect(extractYearFromCan({ sku: 'MO-1' } as Can)).toBeNull(); // not numeric
    expect(extractYearFromCan({} as Can)).toBeNull();
  });
});

describe('calcMatch', () => {
  // a fully-populated can; each test sets ONE criterion and checks it in isolation
  const can = {
    nome: 'Monster Ultra Paradise',
    lingua: 'ITALY',
    size: '500ml',
    produttore: 'Monster',
    top: 'GREEN',
    stato: 'OK',
    note: 'FULL can',
    promo: true,
    p1: 'x',
    sku: 'AB123',
  };

  it('matches when no criteria are set', () => {
    expect(calcMatch(can, {})).toBe(true);
    expect(calcMatch(can)).toBe(true);
  });
  it('gusto/paese are case-insensitive substring matches', () => {
    expect(calcMatch(can, { gusto: 'ultra' })).toBe(true);
    expect(calcMatch(can, { gusto: 'khaos' })).toBe(false);
    expect(calcMatch(can, { paese: 'ital' })).toBe(true);
  });
  it('size/produttore/top/stato are exact matches', () => {
    expect(calcMatch(can, { size: '500ml' })).toBe(true);
    expect(calcMatch(can, { size: '250ml' })).toBe(false);
    expect(calcMatch(can, { produttore: 'Monster' })).toBe(true);
  });
  it('full / promo / foto are tri-state (yes / no)', () => {
    expect(calcMatch(can, { full: 'yes' })).toBe(true);
    expect(calcMatch(can, { full: 'no' })).toBe(false);
    expect(calcMatch(can, { promo: 'yes' })).toBe(true);
    expect(calcMatch(can, { foto: 'yes' })).toBe(true);
    expect(calcMatch({ ...can, p1: '' }, { foto: 'yes' })).toBe(false);
  });
  it('sku op: contains (default) / starts / exact', () => {
    expect(calcMatch(can, { sku: 'b12' })).toBe(true); // contains
    expect(calcMatch(can, { sku: 'ab', skuOp: 'starts' })).toBe(true);
    expect(calcMatch(can, { sku: 'b12', skuOp: 'starts' })).toBe(false);
    expect(calcMatch(can, { sku: 'ab123', skuOp: 'exact' })).toBe(true);
    expect(calcMatch(can, { sku: 'ab12', skuOp: 'exact' })).toBe(false);
  });
  it('year range uses the SKU-decoded year', () => {
    const c2023 = { sku: '0123' }; // → 2023
    expect(calcMatch(c2023, { yearFrom: '2020' })).toBe(true);
    expect(calcMatch(c2023, { yearTo: '2022' })).toBe(false);
    expect(calcMatch({ sku: 'no-year' }, { yearFrom: '2000' })).toBe(false);
  });
});

describe('calcFilter + calcTotals', () => {
  it('calcTotals sums values, averages and counts cans without a value', () => {
    const t = calcTotals([{ valore: '3' }, { valore: '4' }, { valore: '5' }, { valore: '' }]);
    expect(t.count).toBe(4);
    expect(t.total).toBe(12);
    expect(t.valued).toBe(3);
    expect(t.noValue).toBe(1);
    expect(t.avg).toBe(4);
    expect(t.min).toBe(3);
    expect(t.max).toBe(5);
  });
  it('calcFilter keeps only the cans that match the query', () => {
    const cans = [
      { nome: 'Ultra', valore: '4' },
      { nome: 'Khaos', valore: '5' },
    ];
    expect(calcFilter(cans, { gusto: 'ultra' })).toHaveLength(1);
    expect(calcFilter(cans, {})).toHaveLength(2);
  });
});
