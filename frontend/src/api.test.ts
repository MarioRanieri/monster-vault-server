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
