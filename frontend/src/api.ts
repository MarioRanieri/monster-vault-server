import { useAuthStore } from './authStore';

// Wrapper di fetch che aggiunge Authorization: Bearer <token> quando autenticato.
export function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  return fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
