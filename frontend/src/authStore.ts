import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  isAdmin: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isAdmin: false,
  error: null,
  login: async (username, password) => {
    set({ error: null });
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      set({ error: 'Credenziali non valide', isAdmin: false, accessToken: null });
      return;
    }
    const { accessToken } = (await res.json()) as { accessToken: string };
    set({ accessToken, isAdmin: true, error: null });
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    set({ accessToken: null, isAdmin: false });
  },
  // Ripristina la sessione dal cookie refresh HttpOnly: chiamato al caricamento
  // della pagina, così tornando dal Map (navigazione piena) resto loggato.
  refresh: async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!res.ok) return;
      const data = (await res.json()) as { accessToken?: string };
      // login solo se il server ha davvero restituito un token
      if (typeof data.accessToken === 'string')
        set({ accessToken: data.accessToken, isAdmin: true });
    } catch {
      /* offline o non loggato: resta guest */
    }
  },
}));
