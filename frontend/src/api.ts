import { useAuthStore } from './authStore';

function send(input: string, init: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  return fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// Wrapper di fetch che aggiunge Authorization: Bearer <token> quando autenticato.
// Su 401 con token presente prova un refresh (single-flight nello store) e
// ritenta UNA volta col token nuovo; se il refresh fallisce la sessione è
// scaduta: azzera lo stato auth e ritorna la 401 originale al chiamante.
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const hadToken = Boolean(useAuthStore.getState().accessToken);
  const res = await send(input, init);
  if (res.status !== 401 || !hadToken) return res;
  if (await useAuthStore.getState().refresh()) return send(input, init);
  useAuthStore.setState({ accessToken: null, isAdmin: false });
  return res;
}
