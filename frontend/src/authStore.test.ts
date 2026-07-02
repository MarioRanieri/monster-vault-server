import { useAuthStore } from './authStore';

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, isAdmin: false, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('login riuscito salva il token e imposta isAdmin', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'tok-123' }),
    }),
  );

  await useAuthStore.getState().login('admin', 'pw');

  const s = useAuthStore.getState();
  expect(s.accessToken).toBe('tok-123');
  expect(s.isAdmin).toBe(true);
  expect(s.error).toBeNull();
});

test('login fallito imposta un errore e non autentica', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

  await useAuthStore.getState().login('admin', 'wrong');

  const s = useAuthStore.getState();
  expect(s.isAdmin).toBe(false);
  expect(s.accessToken).toBeNull();
  expect(s.error).toBeTruthy();
});

test('logout azzera token e isAdmin', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  useAuthStore.setState({ accessToken: 'tok', isAdmin: true, error: null });

  await useAuthStore.getState().logout();

  const s = useAuthStore.getState();
  expect(s.accessToken).toBeNull();
  expect(s.isAdmin).toBe(false);
});
