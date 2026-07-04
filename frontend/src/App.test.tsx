import { render, screen } from '@testing-library/react';
import App from './App';
import userEvent from '@testing-library/user-event';
import { useCansStore } from './store';
import { useAuthStore } from './authStore';

beforeEach(() => {
  useCansStore.setState({ cans: [], loading: false, error: null });
  useAuthStore.setState({ accessToken: null, isAdmin: false, error: null });
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

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
  await userEvent.click(screen.getByRole('button', { name: /edit/i }));
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
  await userEvent.click(screen.getByRole('button', { name: /edit/i }));
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
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
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: '1', nome: 'Alpha' }] }) // loadCans
      .mockResolvedValueOnce({ ok: false }) // refresh al mount: non loggato
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }) // login
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1', nome: 'Alpha' }) }) // saveCan
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://cdn/up.jpg' }) }), // uploadPhoto
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(screen.getByRole('button', { name: /edit/i }));

  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Photo 1'), file);
  await userEvent.click(screen.getByRole('button', { name: /skip crop/i }));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  // salvataggio + upload della foto staged → la foto compare
  expect((await screen.findAllByRole('img', { name: 'Alpha' })).length).toBeGreaterThan(0);
});
