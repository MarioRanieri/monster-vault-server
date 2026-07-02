import { create } from 'zustand';
import type { Can } from './types';
import { authFetch } from './api';

interface CansState {
  cans: Can[];
  loading: boolean;
  error: string | null;
  loadCans: () => Promise<void>;
  saveCan: (can: Can) => Promise<void>;
  deleteCan: (id: string) => Promise<void>;
  createCan: (can: Can) => Promise<void>;
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
  saveCan: async (can) => {
    const res = await authFetch(`/api/cans/${can.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(can),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const saved = (await res.json()) as Can;
    set((s) => ({ cans: s.cans.map((c) => (c.id === saved.id ? saved : c)) }));
  },
  deleteCan: async (id) => {
    const res = await authFetch(`/api/cans/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    set((s) => ({ cans: s.cans.filter((c) => c.id !== id) }));
  },
  createCan: async (can) => {
    const res = await authFetch('/api/cans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(can),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const saved = (await res.json()) as Can;
    set((s) => ({ cans: [...s.cans, saved] }));
  },
}));
