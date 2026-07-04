import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useCansStore } from './store';
import { useAuthStore } from './authStore';

beforeEach(() => {
  useCansStore.setState({ cans: [], loading: false, error: null });
  useAuthStore.setState({ accessToken: null, isAdmin: false, error: null });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', nome: 'Alpha', lingua: 'USA', p1: 'x.jpg', size: '500ML' },
        { id: '2', nome: 'Beta', size: '355ML' },
      ],
    }),
  );
});

afterEach(() => vi.restoreAllMocks());

async function enter() {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /enter the collection/i }));
  await screen.findByText('Alpha');
}

test('guest: apre Stats, Guide e copia lo Share view', async () => {
  await enter();

  await userEvent.click(screen.getByRole('button', { name: /stats/i }));
  expect(await screen.findByText(/statistics/i)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /close/i }));

  await userEvent.click(screen.getByRole('button', { name: /guide/i }));
  expect(await screen.findByText('Browsing')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /close/i }));

  await userEvent.click(screen.getByRole('button', { name: /share view/i }));
  expect(await screen.findByText(/link copied/i)).toBeTruthy();
});

test('guest: passa tra le tre viste', async () => {
  await enter();
  const toggles = screen
    .getAllByRole('button')
    .filter((b) => /view$/i.test(b.getAttribute('aria-label') || ''));
  await userEvent.click(toggles[1]); // list
  expect(screen.getByRole('columnheader', { name: /name/i })).toBeTruthy();
  await userEvent.click(toggles[2]); // wall
  await userEvent.click(toggles[0]); // grid
  expect(screen.getByText('Alpha')).toBeTruthy();
});

test('guest: la ricerca filtra e il reset ripristina', async () => {
  await enter();
  await userEvent.type(screen.getByRole('searchbox'), 'alph');
  expect(screen.queryByText('Beta')).toBeNull();
  const reset = screen.queryByRole('button', { name: /reset/i });
  if (reset) {
    await userEvent.click(reset);
    expect(await screen.findByText('Beta')).toBeTruthy();
  }
});

test('admin: apre il pannello Account e il Value calc', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: '1', nome: 'Alpha', valore: '10' }],
      })
      .mockResolvedValueOnce({ ok: false }) // refresh al mount
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'tok' }) }), // login
  );
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /admin access/i }));
  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await screen.findByRole('button', { name: /sign out/i });

  await userEvent.click(screen.getByRole('button', { name: /account/i }));
  expect(await screen.findByRole('button', { name: /generate recovery code/i })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /close/i }));

  await userEvent.click(screen.getByRole('button', { name: /value/i }));
  expect(await screen.findByText(/value calculator/i)).toBeTruthy();
});
