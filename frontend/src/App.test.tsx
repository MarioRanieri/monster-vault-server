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
