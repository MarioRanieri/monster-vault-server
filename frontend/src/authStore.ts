import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  isAdmin: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
}));
