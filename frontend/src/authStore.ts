import { create } from 'zustand';

export interface Result {
  ok: boolean;
  error?: string;
}

interface AuthState {
  accessToken: string | null;
  isAdmin: boolean;
  error: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<Result>;
  generateRecoveryCode: () => Promise<string | null>;
  recover: (username: string, recoveryCode: string, newPassword: string) => Promise<Result>;
}

const authHeader = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

let refreshing: Promise<boolean> | null = null;

function changePwError(status: number): string {
  if (status === 401) return 'Current password is wrong';
  if (status === 400) return 'New password must be at least 8 characters';
  return 'Something went wrong';
}

function recoverError(status: number): string {
  if (status === 429) return 'Too many attempts. Wait a minute.';
  if (status === 400) return 'New password must be at least 8 characters';
  return 'Invalid username or recovery code';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  isAdmin: false,
  error: null,
  loading: false,
  login: async (username, password) => {
    set({ error: null, loading: true });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.status === 429) {
        set({ error: 'Too many attempts. Wait a minute and try again.', loading: false });
        return;
      }
      if (!res.ok) {
        set({ error: 'Invalid credentials', isAdmin: false, accessToken: null, loading: false });
        return;
      }
      const { accessToken } = (await res.json()) as { accessToken: string };
      // Hint (non HttpOnly) che questo browser ha una sessione: al load evita di
      // interrogare /auth/refresh per i guest, che risponde 401 (rumore console).
      localStorage.setItem('mv_auth', '1');
      set({ accessToken, isAdmin: true, error: null, loading: false });
    } catch {
      set({ error: 'Network error. Please try again.', loading: false });
    }
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('mv_auth');
    set({ accessToken: null, isAdmin: false });
  },
  // Ripristina la sessione dal cookie refresh HttpOnly: chiamato al caricamento
  // della pagina, così tornando dal Map (navigazione piena) resto loggato.
  // Single-flight: le richieste concorrenti (più 401 in parallelo) condividono
  // la stessa POST /refresh — il backend ruota il token, refresh paralleli si
  // invaliderebbero a vicenda.
  refresh: () => {
    refreshing ??= (async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken?: string };
        // login solo se il server ha davvero restituito un token
        if (typeof data.accessToken !== 'string') return false;
        set({ accessToken: data.accessToken, isAdmin: true });
        return true;
      } catch {
        /* offline o non loggato: resta guest */
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  },
  changePassword: async (currentPassword, newPassword) => {
    const res = await fetch('/api/account/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader(get().accessToken) },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.ok) return { ok: true };
    return {
      ok: false,
      error: changePwError(res.status),
    };
  },
  generateRecoveryCode: async () => {
    const res = await fetch('/api/account/recovery-code', {
      method: 'POST',
      headers: authHeader(get().accessToken),
    });
    if (!res.ok) return null;
    const { recoveryCode } = (await res.json()) as { recoveryCode: string };
    return recoveryCode;
  },
  recover: async (username, recoveryCode, newPassword) => {
    const res = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, recoveryCode, newPassword }),
    });
    if (res.ok) return { ok: true };
    return {
      ok: false,
      error: recoverError(res.status),
    };
  },
}));
