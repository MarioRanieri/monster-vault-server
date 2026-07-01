import { useCansStore } from './store';
import type { Can } from './types';

// Ogni test riparte da stato pulito; ripristina i mock di fetch dopo ognuno.
beforeEach(() => {
  useCansStore.setState({ cans: [], loading: false, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('loadCans popola cans da GET /api/cans', async () => {
  const fake: Can[] = [{ id: '1', nome: 'Alpha' }];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fake }));

  await useCansStore.getState().loadCans();

  const s = useCansStore.getState();
  expect(s.cans).toEqual(fake);
  expect(s.loading).toBe(false);
  expect(s.error).toBeNull();
});

test('loadCans imposta error quando la fetch fallisce', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

  await useCansStore.getState().loadCans();

  const s = useCansStore.getState();
  expect(s.error).toBeTruthy();
  expect(s.loading).toBe(false);
  expect(s.cans).toEqual([]);
});
