import { render, screen } from '@testing-library/react';
import App from './App';
import { useCansStore } from './store';

beforeEach(() => {
  useCansStore.setState({ cans: [], loading: false, error: null });
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
