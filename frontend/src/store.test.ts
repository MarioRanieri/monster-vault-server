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

test('saveCan aggiorna la can nella lista (PUT)', async () => {
  useCansStore.setState({
    cans: [{ id: '1', nome: 'Old' }],
    loading: false,
    error: null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', nome: 'New' }),
    }),
  );

  await useCansStore.getState().saveCan({ id: '1', nome: 'New' });

  expect(useCansStore.getState().cans).toEqual([{ id: '1', nome: 'New' }]);
});

test('deleteCan rimuove la can dalla lista (DELETE)', async () => {
  useCansStore.setState({
    cans: [
      { id: '1', nome: 'A' },
      { id: '2', nome: 'B' },
    ],
    loading: false,
    error: null,
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

  await useCansStore.getState().deleteCan('1');

  expect(useCansStore.getState().cans.map((c) => c.id)).toEqual(['2']);
});

test('saveCan lancia se la risposta non è ok', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
  await expect(useCansStore.getState().saveCan({ id: '1', nome: 'X' })).rejects.toThrow();
});

test('deleteCan lancia se la risposta non è ok', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
  await expect(useCansStore.getState().deleteCan('1')).rejects.toThrow();
});

test('createCan aggiunge la nuova can alla lista (POST)', async () => {
  useCansStore.setState({
    cans: [{ id: '1', nome: 'A' }],
    loading: false,
    error: null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: '2', nome: 'B' }) }),
  );

  await useCansStore.getState().createCan({ id: '2', nome: 'B' });

  expect(useCansStore.getState().cans.map((c) => c.id)).toEqual(['1', '2']);
});

test('createCan lancia se la risposta non è ok', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
  await expect(useCansStore.getState().createCan({ id: '1', nome: 'X' })).rejects.toThrow();
});

test('uploadPhoto imposta l’URL foto sullo slot (POST multipart)', async () => {
  useCansStore.setState({
    cans: [{ id: '1', nome: 'A' }],
    loading: false,
    error: null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://cdn/new.jpg' }),
    }),
  );

  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
  await useCansStore.getState().uploadPhoto('1', 1, file);

  expect(useCansStore.getState().cans[0].p1).toBe('https://cdn/new.jpg');
});

test('uploadPhotoFromUrl imposta l’URL foto sullo slot (POST from-url)', async () => {
  useCansStore.setState({
    cans: [{ id: '1', nome: 'A' }],
    loading: false,
    error: null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://cdn/fromurl.jpg' }),
    }),
  );

  await useCansStore.getState().uploadPhotoFromUrl('1', 2, 'https://src/y.jpg');

  expect(useCansStore.getState().cans[0].p2).toBe('https://cdn/fromurl.jpg');
});

test('importCans invia il batch e ricarica la lista', async () => {
  const merged: Can[] = [
    { id: '1', nome: 'A' },
    { id: '2', nome: 'B' },
  ];
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // POST /batch
      .mockResolvedValueOnce({ ok: true, json: async () => merged }), // reload GET
  );

  await useCansStore.getState().importCans([{ id: '2', nome: 'B' }]);

  expect(useCansStore.getState().cans).toEqual(merged);
});
