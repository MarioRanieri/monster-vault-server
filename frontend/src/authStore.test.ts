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

test('login mappa 429 a un errore dedicato', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
  await useAuthStore.getState().login('admin', 'pw');
  expect(useAuthStore.getState().error).toMatch(/too many/i);
});

test('refresh ripristina la sessione se il server dà un token', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'r-tok' }) }),
  );
  await useAuthStore.getState().refresh();
  expect(useAuthStore.getState().isAdmin).toBe(true);
});

test('changePassword: ok con token, 401 se la corrente è sbagliata', async () => {
  useAuthStore.setState({ accessToken: 'tok' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  expect(await useAuthStore.getState().changePassword('old', 'newpass12')).toEqual({ ok: true });

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
  const r = await useAuthStore.getState().changePassword('bad', 'newpass12');
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/wrong/i);
});

test('generateRecoveryCode ritorna il codice, null se fallisce', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ recoveryCode: 'MV-AAAA' }) }),
  );
  expect(await useAuthStore.getState().generateRecoveryCode()).toBe('MV-AAAA');

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  expect(await useAuthStore.getState().generateRecoveryCode()).toBeNull();
});

test('recover: ok, e fallimento con codice errato', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  expect((await useAuthStore.getState().recover('u', 'c', 'newpass12')).ok).toBe(true);

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
  expect((await useAuthStore.getState().recover('u', 'bad', 'newpass12')).ok).toBe(false);
});
