import { render, screen, within } from '@testing-library/react';
import App from './App';
import userEvent from '@testing-library/user-event';
import { useCansStore } from './store';
import { useAuthStore } from './authStore';

beforeEach(() => {
  useCansStore.setState({ cans: [], loading: false, error: null, warming: false, updatedAt: null });
  useAuthStore.setState({ accessToken: null, isAdmin: false, error: null });
  localStorage.clear(); // la cache offline inquinerebbe i test successivi
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// La app parte dalla landing: per vedere la collection bisogna entrarci.
async function enterCollection() {
  await userEvent.click(screen.getByRole('button', { name: /enter the collection/i }));
}

async function loginAsAdmin() {
  await userEvent.click(screen.getByRole('button', { name: /admin access/i }));
  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await screen.findByRole('button', { name: /sign out/i });
}

test('la landing mostra il wordmark "Monster Vault"', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /monster vault/i })).toBeTruthy();
});

test('la landing mostra "…" (non 0) mentre i dati caricano', () => {
  // solo /api/cans resta appesa: il refresh auth deve risolversi o il suo
  // singleton single-flight resterebbe bloccato anche nei test successivi
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url === '/api/cans' ? new Promise(() => {}) : Promise.resolve({ ok: false }),
    ),
  );
  render(<App />);
  expect(screen.getAllByText('…')).toHaveLength(2); // Cans + With photo
  expect(screen.queryByText('0')).toBeNull();
});

test('carica e mostra i cans dall’API al montaggio', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', nome: 'Alpha' }],
    }),
  );

  render(<App />);
  await enterCollection();

  expect(await screen.findByText('Alpha')).toBeTruthy();
});

test('mostra un messaggio di errore se la fetch fallisce', async () => {
  // 404 e non 500: sui 5xx ora scatta il retry del cold start
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

  render(<App />);
  await enterCollection();

  expect(await screen.findByRole('alert')).toBeTruthy();
});

test('la ricerca filtra la griglia per nome', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', nome: 'Alpha' },
        { id: '2', nome: 'Beta' },
      ],
    }),
  );

  render(<App />);
  await enterCollection();
  await screen.findByText('Alpha');

  await userEvent.type(screen.getByRole('searchbox'), 'alph');

  expect(screen.queryByText('Beta')).toBeNull();
  expect(screen.getByText('Alpha')).toBeTruthy();
});

test('cliccando una card si apre il dettaglio; Chiudi lo richiude', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', nome: 'Alpha', sku: 'SKU-1' }],
    }),
  );

  render(<App />);
  await enterCollection();

  await userEvent.click(await screen.findByRole('button', { name: /alpha/i }));
  const chiudi = await screen.findByRole('button', { name: /^close$/i });
  expect(chiudi).toBeTruthy();

  await userEvent.click(chiudi);
  expect(screen.queryByRole('button', { name: /^close$/i })).toBeNull();
});

test('il chip "Con foto" mostra solo i cans con foto', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', nome: 'Alpha', p1: 'a.jpg' },
        { id: '2', nome: 'Beta' },
      ],
    }),
  );

  render(<App />);
  await enterCollection();
  await screen.findByText('Alpha');

  await userEvent.click(screen.getByRole('button', { name: /with photo/i }));

  expect(screen.queryByText('Beta')).toBeNull();
  expect(screen.getByText('Alpha')).toBeTruthy();
});

test('il chip "Promo" mostra solo i cans in promo', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', nome: 'Alpha', promo: 'Zero' },
        { id: '2', nome: 'Beta' },
      ],
    }),
  );

  render(<App />);
  await enterCollection();
  await screen.findByText('Alpha');

  await userEvent.click(screen.getByRole('button', { name: /promo/i }));

  expect(screen.queryByText('Beta')).toBeNull();
  expect(screen.getByText('Alpha')).toBeTruthy();
});

test('login, poi "Esci" riporta alla landing', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // loadCans
      .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'tok' }),
      }) // login
      .mockResolvedValueOnce({ ok: true }), // logout
  );

  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /admin access/i }));

  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  await userEvent.click(await screen.findByRole('button', { name: /sign out/i }));

  // signout torna alla landing
  expect(await screen.findByRole('button', { name: /admin access/i })).toBeTruthy();
});

test('admin: elimina una can dal dettaglio', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: '1', nome: 'Alpha' }] })
      .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) })
      .mockResolvedValueOnce({ ok: true }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(screen.getByRole('button', { name: /delete/i }));

  expect(screen.queryByText('Alpha')).toBeNull();
});

test('admin: Undo dopo delete ripristina la can senza purge', async () => {
  const spy = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [{ id: '1', nome: 'Alpha' }] }) // loadCans
    .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
    .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }) // login
    .mockResolvedValueOnce({ ok: true }) // DELETE soft
    .mockResolvedValueOnce({ ok: true }); // PUT restore
  vi.stubGlobal('fetch', spy);

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(screen.getByRole('button', { name: /delete/i }));
  expect(screen.queryByText('Alpha')).toBeNull();

  await userEvent.click(await screen.findByRole('button', { name: /undo/i }));

  expect(await screen.findByText('Alpha')).toBeTruthy();
  expect(spy.mock.calls.map((c) => c[0])).not.toContain('/api/cans/1/permanent');
});

test('admin: senza Undo dopo 10s parte il purge permanente', async () => {
  const spy = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [{ id: '1', nome: 'Alpha' }] }) // loadCans
    .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
    .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }) // login
    .mockResolvedValue({ ok: true }); // DELETE soft + DELETE permanent
  vi.stubGlobal('fetch', spy);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  try {
    render(<App />);
    await loginAsAdmin();

    await user.click(screen.getByRole('button', { name: /alpha/i }));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await screen.findByRole('button', { name: /undo/i });

    vi.advanceTimersByTime(10000);

    expect(spy.mock.calls.map((c) => c[0])).toContain('/api/cans/1/permanent');
  } finally {
    vi.useRealTimers();
  }
});

test('admin: modifica una can dal dettaglio', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: '1', nome: 'Alpha', sku: 'SKU-1' }],
      })
      .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', nome: 'Beta', sku: 'SKU-1' }),
      }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(
    within(screen.getByRole('complementary')).getByRole('button', { name: /edit/i }),
  );
  const nome = screen.getByLabelText('Name');
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Beta');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.queryByText('Alpha')).toBeNull();
  expect((await screen.findAllByText('Beta')).length).toBeGreaterThan(0);
});

test('admin: Annulla chiude il form e torna al dettaglio', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: '1', nome: 'Alpha', sku: 'SKU-1' }],
      })
      .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(
    within(screen.getByRole('complementary')).getByRole('button', { name: /edit/i }),
  );
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(
    within(screen.getByRole('complementary')).getByRole('button', { name: /edit/i }),
  ).toBeTruthy();
});

test('admin: crea una nuova can', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'x', nome: 'Nuova Lattina' }),
      }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /add/i }));
  await userEvent.type(screen.getByLabelText('Name'), 'Nuova Lattina');
  await userEvent.type(screen.getByLabelText('SKU'), '0101'); // Name+SKU obbligatori
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText('Nuova Lattina')).toBeTruthy();
});

test('admin: Annulla la creazione chiude il form', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /add/i }));
  expect(screen.getByLabelText('Name')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(screen.queryByLabelText('Name')).toBeNull();
});

test('filtri persistenti: mv_filters viene riapplicato al mount', async () => {
  localStorage.setItem('mv_filters', JSON.stringify({ query: 'alph' }));
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', nome: 'Alpha' },
        { id: '2', nome: 'Beta' },
      ],
    }),
  );

  render(<App />);
  await enterCollection();

  expect(await screen.findByText('Alpha')).toBeTruthy();
  expect(screen.queryByText('Beta')).toBeNull(); // query 'alph' ripristinata
});

test('filtri persistenti: i cambi finiscono in mv_filters', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: '1', nome: 'Alpha' }] }),
  );

  render(<App />);
  await enterCollection();
  await screen.findByText('Alpha');

  await userEvent.type(screen.getByRole('searchbox'), 'alp');

  expect(JSON.parse(localStorage.getItem('mv_filters')!).query).toBe('alp');
});

test('stats: click su un paese filtra la griglia e chiude il modal', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', nome: 'Alpha', lingua: 'USA' },
        { id: '2', nome: 'Beta', lingua: 'Italy' },
      ],
    }),
  );

  render(<App />);
  await enterCollection();
  await screen.findByText('Alpha');

  await userEvent.click(screen.getByRole('button', { name: /stats/i }));
  const modal = screen.getByRole('dialog', { name: /statistics/i });
  await userEvent.click(within(modal).getAllByRole('button', { name: /USA/ })[0]);

  expect(screen.queryByRole('dialog', { name: /statistics/i })).toBeNull(); // modal chiuso
  expect(screen.queryByText('Beta')).toBeNull(); // filtrato su USA
  expect(screen.getByText('Alpha')).toBeTruthy();
});

test('Share view mostra la conferma "link copied"', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', nome: 'Alpha' }],
    }),
  );

  render(<App />);
  await enterCollection();
  await screen.findByText('Alpha');

  await userEvent.click(screen.getByRole('button', { name: /share view/i }));

  expect(await screen.findByText(/link copied/i)).toBeTruthy();
});

test('admin: carica una foto durante la modifica', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: '1', nome: 'Alpha', sku: 'S' }] }) // loadCans
      .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }) // login
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1', nome: 'Alpha' }) }) // saveCan
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://cdn/up.jpg' }) }), // uploadPhoto
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(
    within(screen.getByRole('complementary')).getByRole('button', { name: /edit/i }),
  );

  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Photo 1'), file);
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  // salvataggio + upload della foto staged → la foto compare
  expect((await screen.findAllByRole('img', { name: 'Alpha' })).length).toBeGreaterThan(0);
});
