import { create } from 'zustand';
import type { Can } from './types';
import { authFetch } from './api';
import { compressImage } from './compressImage';

const CACHE_KEY = 'mv_cache';

// Cache locale {ts, cans} (chiave e formato del vecchio saveCache/loadFromCache):
// apertura istantanea per chi torna e fallback offline.
function readCache(): { ts: number; cans: Can[] } | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && Array.isArray(c.cans) && c.cans.length) return c;
  } catch {
    /* cache corrotta: ignora */
  }
  return null;
}

function writeCache(cans: Can[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), cans }));
  } catch {
    /* quota piena: ignora */
  }
}

// Retry sui 5xx per il cold start di Render (free tier): 3 tentativi, 2s di pausa.
async function fetchWithRetry(attempt = 1): Promise<Can[]> {
  const res = await fetch('/api/cans');
  if (res.status >= 500 && attempt < 3) {
    useCansStore.setState({ warming: true });
    await new Promise((r) => setTimeout(r, 2000));
    return fetchWithRetry(attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Can[];
}

interface CansState {
  cans: Can[];
  loading: boolean;
  error: string | null;
  warming: boolean;
  updatedAt: number | null;
  loadCans: () => Promise<void>;
  saveCan: (can: Can) => Promise<Can>;
  deleteCan: (id: string) => Promise<void>;
  restoreCan: (can: Can) => Promise<void>;
  permanentDeleteCan: (id: string) => Promise<void>;
  createCan: (can: Can) => Promise<Can>;
  uploadPhoto: (id: string, slot: number, file: File) => Promise<void>;
  uploadPhotoFromUrl: (id: string, slot: number, url: string) => Promise<void>;
  importCans: (cans: Can[]) => Promise<void>;
}

export const useCansStore = create<CansState>((set) => ({
  cans: [],
  loading: false,
  error: null,
  warming: false,
  updatedAt: null,
  loadCans: async () => {
    // Stale-while-revalidate: con la cache mostra subito la collezione, poi
    // aggiorna in background; se il server è giù la vista in cache resta valida.
    const cached = readCache();
    if (cached) {
      hydrating = true;
      set({ cans: cached.cans, updatedAt: cached.ts, loading: false, error: null });
      hydrating = false;
      try {
        const fresh = await fetchWithRetry();
        if (JSON.stringify(fresh) !== JSON.stringify(cached.cans)) set({ cans: fresh });
      } catch {
        /* offline o errore: resta la cache */
      } finally {
        set({ warming: false });
      }
      return;
    }
    set({ loading: true, error: null });
    try {
      const cans = await fetchWithRetry();
      set({ cans, loading: false, warming: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false, warming: false });
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
    return saved;
  },
  deleteCan: async (id) => {
    const res = await authFetch(`/api/cans/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    set((s) => ({ cans: s.cans.filter((c) => c.id !== id) }));
  },
  // Annulla un soft-delete: il backend risponde 204, quindi re-inseriamo lo
  // snapshot che avevamo prima della cancellazione.
  restoreCan: async (can) => {
    const res = await authFetch(`/api/cans/${can.id}/restore`, { method: 'PUT' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    set((s) => ({ cans: [...s.cans, can] }));
  },
  // Purge definitivo (DB + foto Cloudinary) allo scadere della finestra di undo.
  permanentDeleteCan: async (id) => {
    const res = await authFetch(`/api/cans/${id}/permanent`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    return saved;
  },
  uploadPhoto: async (id, slot, file) => {
    // Comprimi prima dell'upload: le foto da telefono superano il limite
    // multipart del backend, quindi vanno rimpicciolite lato client.
    const compressed = await compressImage(file);
    const form = new FormData();
    form.append('file', compressed);
    // Niente header Content-Type: il browser lo imposta con il boundary multipart.
    const res = await authFetch(`/api/cans/${id}/photo/${slot}`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { url } = (await res.json()) as { url: string };
    const key = `p${slot}` as 'p1' | 'p2' | 'p3' | 'p4';
    set((s) => ({
      cans: s.cans.map((c) => (c.id === id ? { ...c, [key]: url } : c)),
    }));
  },
  uploadPhotoFromUrl: async (id, slot, url) => {
    const res = await authFetch(`/api/cans/${id}/photo/${slot}/from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { url: newUrl } = (await res.json()) as { url: string };
    const key = `p${slot}` as 'p1' | 'p2' | 'p3' | 'p4';
    set((s) => ({
      cans: s.cans.map((c) => (c.id === id ? { ...c, [key]: newUrl } : c)),
    }));
  },
  importCans: async (cans) => {
    const res = await authFetch('/api/cans/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cans),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // ricarica dal server per riflettere il merge lato backend
    const list = await fetch('/api/cans');
    if (list.ok) set({ cans: (await list.json()) as Can[] });
  },
}));

// Come il vecchio saveCache() dopo ogni mutazione: ogni cambio di `cans`
// (load, salvataggi, delete, upload, import) finisce in cache — tranne
// l'idratazione iniziale dalla cache stessa, che non è un dato nuovo e non
// deve rinfrescare il timestamp "Updated".
let hydrating = false;
useCansStore.subscribe((s, prev) => {
  if (!hydrating && s.cans !== prev.cans) {
    writeCache(s.cans);
    useCansStore.setState({ updatedAt: Date.now() });
  }
});
