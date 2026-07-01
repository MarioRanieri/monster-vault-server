import { create } from 'zustand';
import type { Can } from './types';

interface CansState {
  cans: Can[];
  loading: boolean;
  error: string | null;
  loadCans: () => Promise<void>;
}

export const useCansStore = create<CansState>((set) => ({
  cans: [],
  loading: false,
  error: null,
  loadCans: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/cans');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cans = (await res.json()) as Can[];
      set({ cans, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
}));
