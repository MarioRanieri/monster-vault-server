import { describe, it, expect, beforeEach } from 'vitest';
import { cloudinaryThumb, cloudinaryLqip, migrateStato, state } from '../../src/core';
import { statsFreq } from '../../src/tools';
import type { Can } from '../../src/types';

describe('cloudinaryThumb', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/can.jpg';
  it('injects a c_fit transform into a Cloudinary URL', () => {
    expect(cloudinaryThumb(url)).toContain('/upload/c_fit,w_400,h_400,f_auto,q_auto/');
    expect(cloudinaryThumb(url, 128, 96)).toContain('w_128,h_96');
  });
  it('passes through non-Cloudinary URLs and nullish input untouched', () => {
    expect(cloudinaryThumb('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(cloudinaryThumb(undefined)).toBeUndefined();
  });
});

describe('cloudinaryLqip', () => {
  it('builds a blurred low-quality placeholder for Cloudinary URLs', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/c.jpg';
    expect(cloudinaryLqip(url)).toContain('e_blur:200');
  });
  it('returns an empty string for non-Cloudinary or missing URLs', () => {
    expect(cloudinaryLqip('https://example.com/c.jpg')).toBe('');
    expect(cloudinaryLqip(undefined)).toBe('');
  });
});

describe('migrateStato', () => {
  it('normalises legacy Italian stato values and returns only the changed cans', () => {
    const list = [
      { id: '1', stato: 'danneggiata' },
      { id: '2', stato: 'OK' }, // already canonical → untouched
      { id: '3', stato: 'piccole bozze' },
    ] as Can[];

    const changed = migrateStato(list);

    expect(list[0].stato).toBe('Damaged');
    expect(list[2].stato).toBe('Minor Dents');
    expect(changed.map((c) => c.id)).toEqual(['1', '3']);
  });
});

describe('statsFreq', () => {
  beforeEach(() => {
    state.cans = [];
  });
  it('counts by field, sorts by frequency desc, ignores empty values and respects the limit', () => {
    state.cans = [
      { id: '1', produttore: 'Monster' },
      { id: '2', produttore: 'Monster' },
      { id: '3', produttore: 'Reign' },
      { id: '4', produttore: '' }, // falsy → ignored
    ] as Can[];

    expect(statsFreq('produttore')).toEqual([
      { k: 'Monster', n: 2 },
      { k: 'Reign', n: 1 },
    ]);
    expect(statsFreq('produttore', 1)).toHaveLength(1);
  });
});
