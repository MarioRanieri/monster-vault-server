import type { Can } from './types';

export interface Stats {
  total: number;
  withPhoto: number;
  promo: number;
}

export function computeStats(cans: Can[]): Stats {
  return {
    total: cans.length,
    withPhoto: cans.filter((c) => c.p1).length,
    promo: cans.filter((c) => c.promo).length,
  };
}
