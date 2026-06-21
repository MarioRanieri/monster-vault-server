import { describe, it, expect, beforeEach } from 'vitest';
import { simpleHash, esc, state } from '../../src/core';
import { buildStatsData } from '../../src/tools';
import type { Can } from '../../src/types';

describe('simpleHash', () => {
  it('matches the documented algorithm (must stay in sync with the Sheet sync script)', () => {
    // imul(31, h) + charCode, then (h >>> 0).toString(36)
    expect(simpleHash('')).toBe('0');
    expect(simpleHash('a')).toBe('2p');
  });

  it('is deterministic and collision-distinct for different inputs', () => {
    expect(simpleHash('monster')).toBe(simpleHash('monster'));
    expect(simpleHash('a')).not.toBe(simpleHash('b'));
  });
});

describe('esc', () => {
  it('escapes HTML-significant characters', () => {
    expect(esc('<b>')).toBe('&lt;b&gt;');
    expect(esc('a & "b"')).toBe('a &amp; &quot;b&quot;');
  });

  it('coerces nullish to empty string', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('buildStatsData', () => {
  beforeEach(() => {
    state.cans = [];
  });

  it('counts a can as "with photo" when ANY of the 4 photo slots is set', () => {
    state.cans = [
      { id: '1', p1: 'x' },
      { id: '2', p4: 'y' }, // only the 4th slot → still counts
      { id: '3' }, // no photo
    ] as Can[];

    const s = buildStatsData();
    expect(s.total).toBe(3);
    expect(s.withPhoto).toBe(2);
  });
});
