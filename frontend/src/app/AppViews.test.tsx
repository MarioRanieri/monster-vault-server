import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useCansStore } from './store';
import { useAuthStore } from './authStore';

// Test di caratterizzazione di App (filtri, viste, toast, compare, import):
// bloccano il comportamento prima di estrarne i blocchi in sotto-componenti.
const CANS = [
  { id: '1', nome: 'Alpha', lingua: 'USA', p1: 'x.jpg', sku: '0610', valore: '30' },
  { id: '2', nome: 'Beta', sku: '0615', valore: '10', note: 'FULL' },
  { id: '3', nome: 'Gamma', promo: 'Yes' },
];

const mockFetch = (cans = CANS) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/auth/login') return { ok: true, json: async () => ({ accessToken: 't' }) };
      if (url === '/api/cans') return { ok: true, json: async () => cans };
      return { ok: true, json: async () => ({}) };
    }),
  );

beforeEach(() => {
  useCansStore.setState({ cans: [], loading: false, error: null, warming: false, updatedAt: null });
  useAuthStore.setState({ accessToken: null, isAdmin: false, error: null, sessionExpired: false });
  localStorage.clear();
  sessionStorage.clear();
  window.history.pushState({}, '', '/');
  mockFetch();
});
afterEach(() => vi.restoreAllMocks());

async function enterAsGuest() {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /enter the collection/i }));
  await screen.findByText('Alpha');
}

async function enterAsAdmin() {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /admin access/i }));
  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await screen.findByRole('button', { name: /sign out/i });
  await screen.findByText('Alpha');
}

const cardNames = () => screen.getAllByRole('button', { name: /^(Alpha|Beta|Gamma)$/ });

test('i chip "With photo" e "No photo" sono mutuamente esclusivi', async () => {
  await enterAsGuest();
  const withPhoto = screen.getByRole('button', { name: /with photo/i });
  const noPhoto = screen.getByRole('button', { name: /no photo/i });

  await userEvent.click(withPhoto);
  expect(withPhoto.getAttribute('aria-pressed')).toBe('true');
  expect(cardNames()).toHaveLength(1);

  await userEvent.click(noPhoto);
  expect(withPhoto.getAttribute('aria-pressed')).toBe('false');
  expect(noPhoto.getAttribute('aria-pressed')).toBe('true');
  expect(cardNames().map((c) => c.getAttribute('aria-label'))).toEqual(['Beta', 'Gamma']);

  await userEvent.click(withPhoto);
  expect(noPhoto.getAttribute('aria-pressed')).toBe('false');
});

test('il chip FULL filtra per note e Promo per promozione', async () => {
  await enterAsGuest();
  await userEvent.click(screen.getByRole('button', { name: /^full/i }));
  expect(cardNames().map((c) => c.getAttribute('aria-label'))).toEqual(['Beta']);
  await userEvent.click(screen.getByRole('button', { name: /^full/i }));
  await userEvent.click(screen.getByRole('button', { name: /^promo/i }));
  expect(cardNames().map((c) => c.getAttribute('aria-label'))).toEqual(['Gamma']);
});

test('il filtro anno (from/to) esclude le lattine fuori range o senza anno', async () => {
  await enterAsGuest();
  await userEvent.type(screen.getByLabelText('year min'), '2012');
  expect(cardNames().map((c) => c.getAttribute('aria-label'))).toEqual(['Beta']);
  await userEvent.clear(screen.getByLabelText('year min'));
  await userEvent.type(screen.getByLabelText('year max'), '2012');
  expect(cardNames().map((c) => c.getAttribute('aria-label'))).toEqual(['Alpha']);
});

test('i select di lingua filtrano e il reset li azzera', async () => {
  await enterAsGuest();
  await userEvent.selectOptions(screen.getByLabelText('ALL COUNTRIES'), 'USA');
  expect(cardNames()).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: /reset/i }));
  expect(cardNames()).toHaveLength(3);
});

test('admin: ordina per valore crescente e mostra/nasconde i prezzi', async () => {
  await enterAsAdmin();
  await userEvent.selectOptions(screen.getByLabelText('Sort'), 'valore-asc');
  expect(cardNames().map((c) => c.getAttribute('aria-label'))).toEqual(['Gamma', 'Beta', 'Alpha']);

  const toggle = screen.getByRole('button', { name: /show prices/i });
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  await userEvent.click(toggle);
  expect(screen.getByRole('button', { name: /hide prices/i }).getAttribute('aria-pressed')).toBe(
    'true',
  );
});

test('admin: il filtro di prezzo restringe la griglia', async () => {
  await enterAsAdmin();
  await userEvent.type(screen.getByLabelText('price min'), '20');
  expect(cardNames().map((c) => c.getAttribute('aria-label'))).toEqual(['Alpha']);
});

test('admin: la matita sulla card apre direttamente la modifica', async () => {
  await enterAsAdmin();
  await userEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
  expect(await screen.findByRole('dialog', { name: /edit can/i })).toBeTruthy();
});

test('vista wall: il tile apre il lightbox della lattina', async () => {
  await enterAsGuest();
  await userEvent.click(screen.getByRole('button', { name: 'Wall view' }));
  await userEvent.click(screen.getByTitle('Alpha'));
  expect(screen.getByRole('dialog', { name: /enlarged photo/i })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /close photo/i }));
  expect(screen.queryByRole('dialog', { name: /enlarged photo/i })).toBeNull();
});

test('vista list: mostra la tabella', async () => {
  await enterAsGuest();
  await userEvent.click(screen.getByRole('button', { name: 'List view' }));
  expect(screen.getByRole('columnheader', { name: /name/i })).toBeTruthy();
});

test('durante il cold start mostra il messaggio di warming', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  sessionStorage.setItem('mv_seen_landing', '1');
  render(<App />);
  await screen.findByText('Loading…');
  act(() => useCansStore.setState({ loading: true, warming: true }));
  expect(screen.getByText(/server warming up/i)).toBeTruthy();
});

test('un deep-link applica filtri e ordinamento e salta la landing', async () => {
  window.history.pushState({}, '', '/?q=bet&sort=nome-asc');
  render(<App />);
  await screen.findByText('Beta');
  expect(cardNames()).toHaveLength(1);
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('bet');
  expect((screen.getByLabelText('Sort') as HTMLSelectElement).value).toBe('nome-asc');
});

test('compare: aggiunge lattine, ne accetta al massimo 4 e apre il pannello', async () => {
  const many = Array.from({ length: 5 }, (_, n) => ({ id: `id${n}`, nome: `Can${n}` }));
  mockFetch(many as typeof CANS);
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /enter the collection/i }));
  await screen.findByText('Can0');
  for (const { nome } of many) {
    await userEvent.click(screen.getByRole('button', { name: nome }));
    await userEvent.click(screen.getByRole('button', { name: /^compare$/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  }
  expect(screen.getAllByRole('button', { name: /^Remove Can/ })).toHaveLength(4);

  await userEvent.click(screen.getByRole('button', { name: /compare \(4\)/i }));
  expect(screen.getByRole('dialog', { name: /compare cans/i })).toBeTruthy();

  await userEvent.click(screen.getByRole('button', { name: 'Remove Can0' }));
  expect(screen.getAllByRole('button', { name: /^Remove Can/ })).toHaveLength(3);
  await userEvent.click(screen.getByRole('button', { name: /clear/i }));
  expect(screen.queryByRole('button', { name: /^Remove Can/ })).toBeNull();
});

test('admin: importa un CSV e conferma con il toast', async () => {
  await enterAsAdmin();
  const csv = new File(['MV_ID,NOME\n9,Delta'], 'cans.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText('Import Excel or CSV'), csv);
  expect(await screen.findByText(/imported 1 cans/i)).toBeTruthy();
});
