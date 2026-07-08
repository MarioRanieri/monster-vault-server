import { authFetch } from './api';
import { useAuthStore } from './authStore';

afterEach(() => vi.restoreAllMocks());

test('aggiunge Authorization quando c’è un token', async () => {
  useAuthStore.setState({ accessToken: 'tok-1', isAdmin: true, error: null });
  const spy = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', spy);

  await authFetch('/api/cans/1', { method: 'DELETE' });

  expect(spy).toHaveBeenCalledWith(
    '/api/cans/1',
    expect.objectContaining({
      method: 'DELETE',
      headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
    }),
  );
});

test('senza token non aggiunge Authorization', async () => {
  useAuthStore.setState({ accessToken: null, isAdmin: false, error: null });
  const spy = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', spy);

  await authFetch('/api/cans');

  const headers = (spy.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
  expect(headers.Authorization).toBeUndefined();
});

const refreshOk = { ok: true, json: async () => ({ accessToken: 'tok-new' }) };

test('401 → refresh → retry con il nuovo token', async () => {
  useAuthStore.setState({ accessToken: 'tok-old', isAdmin: true, error: null });
  const spy = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/refresh') return refreshOk;
    const tok = (init?.headers as Record<string, string>).Authorization;
    return tok === 'Bearer tok-new' ? { ok: true, status: 200 } : { ok: false, status: 401 };
  });
  vi.stubGlobal('fetch', spy);

  const res = await authFetch('/api/cans/1', { method: 'DELETE' });

  expect(res.status).toBe(200);
  expect(spy.mock.calls.map((c) => c[0])).toEqual([
    '/api/cans/1',
    '/api/auth/refresh',
    '/api/cans/1',
  ]);
});

test('401 concorrenti → una sola chiamata a /api/auth/refresh', async () => {
  useAuthStore.setState({ accessToken: 'tok-old', isAdmin: true, error: null });
  const spy = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/refresh') return refreshOk;
    const tok = (init?.headers as Record<string, string>).Authorization;
    return tok === 'Bearer tok-new' ? { ok: true, status: 200 } : { ok: false, status: 401 };
  });
  vi.stubGlobal('fetch', spy);

  const [r1, r2] = await Promise.all([authFetch('/api/cans/1'), authFetch('/api/cans/2')]);

  expect(r1.status).toBe(200);
  expect(r2.status).toBe(200);
  expect(spy.mock.calls.filter((c) => c[0] === '/api/auth/refresh')).toHaveLength(1);
});

test('refresh fallito → stato azzerato, ritorna la 401 originale senza retry', async () => {
  useAuthStore.setState({ accessToken: 'tok-old', isAdmin: true, error: null });
  const original = { ok: false, status: 401 };
  const spy = vi.fn(async (url: string) =>
    url === '/api/auth/refresh' ? { ok: false, status: 401 } : original,
  );
  vi.stubGlobal('fetch', spy);

  const res = await authFetch('/api/cans/1');

  expect(res).toBe(original);
  expect(useAuthStore.getState().accessToken).toBeNull();
  expect(useAuthStore.getState().isAdmin).toBe(false);
  expect(spy.mock.calls.map((c) => c[0])).toEqual(['/api/cans/1', '/api/auth/refresh']);
});
