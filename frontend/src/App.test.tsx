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

test('mostra il titolo "Monster Vault"', () => {
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

  expect(await screen.findByText('Alpha')).toBeTruthy();
});

test('mostra un messaggio di errore se la fetch fallisce', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

  render(<App />);

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

  await userEvent.click(await screen.findByRole('button', { name: /alpha/i }));
  expect(await screen.findByText('SKU-1')).toBeTruthy();

  await userEvent.click(screen.getByRole('button', { name: /chiudi/i }));
  expect(screen.queryByText('SKU-1')).toBeNull();
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
  await screen.findByText('Alpha');

  await userEvent.click(screen.getByRole('button', { name: /con foto/i }));

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
  await screen.findByText('Alpha');

  await userEvent.click(screen.getByRole('button', { name: /^promo$/i }));

  expect(screen.queryByText('Beta')).toBeNull();
  expect(screen.getByText('Alpha')).toBeTruthy();
});

test('login/logout: mostra il form, poi "Esci", poi di nuovo il form', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // loadCans
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'tok' }),
      }) // login
      .mockResolvedValueOnce({ ok: true }), // logout
  );

  render(<App />);

  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /accedi/i }));

  await userEvent.click(await screen.findByRole('button', { name: /esci/i }));

  expect(await screen.findByRole('button', { name: /accedi/i })).toBeTruthy();
});

async function loginAsAdmin() {
  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /accedi/i }));
  await screen.findByRole('button', { name: /esci/i });
}

test('admin: elimina una can dal dettaglio', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: '1', nome: 'Alpha' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) })
      .mockResolvedValueOnce({ ok: true }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(screen.getByRole('button', { name: /elimina/i }));

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
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', nome: 'Beta', sku: 'SKU-1' }),
      }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(screen.getByRole('button', { name: /modifica/i }));
  const nome = screen.getByLabelText('Nome');
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Beta');
  await userEvent.click(screen.getByRole('button', { name: /salva/i }));

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
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  await userEvent.click(screen.getByRole('button', { name: /modifica/i }));
  await userEvent.click(screen.getByRole('button', { name: /annulla/i }));

  expect(screen.getByRole('button', { name: /modifica/i })).toBeTruthy();
});

test('admin: crea una nuova can', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'x', nome: 'Nuova Lattina' }),
      }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /nuova/i }));
  await userEvent.type(screen.getByLabelText('Nome'), 'Nuova Lattina');
  await userEvent.click(screen.getByRole('button', { name: /salva/i }));

  expect(await screen.findByText('Nuova Lattina')).toBeTruthy();
});

test('admin: Annulla la creazione chiude il form', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }),
  );

  render(<App />);
  await loginAsAdmin();

  await userEvent.click(screen.getByRole('button', { name: /nuova/i }));
  expect(screen.getByLabelText('Nome')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /annulla/i }));
  expect(screen.queryByLabelText('Nome')).toBeNull();
});
