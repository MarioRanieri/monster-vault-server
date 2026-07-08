import { useCansStore } from './store';
import type { Can } from './types';

// Ogni test riparte da stato pulito; ripristina i mock di fetch dopo ognuno.
beforeEach(() => {
  useCansStore.setState({ cans: [], loading: false, error: null, warming: false, updatedAt: null });
  localStorage.clear();
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
  // 404 e non 500: sui 5xx ora scatta il retry del cold start
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

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

test('loadCans mostra subito la cache e poi i dati freschi', async () => {
  localStorage.setItem('mv_cache', JSON.stringify({ ts: 1, cans: [{ id: '1', nome: 'A' }] }));
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: '1', nome: 'A' },
        { id: '2', nome: 'B' },
      ],
    }),
  );

  const p = useCansStore.getState().loadCans();

  // subito dalla cache, senza spinner
  expect(useCansStore.getState().cans.map((c) => c.nome)).toEqual(['A']);
  expect(useCansStore.getState().loading).toBe(false);

  await p;

  expect(useCansStore.getState().cans.map((c) => c.nome)).toEqual(['A', 'B']);
  expect(JSON.parse(localStorage.getItem('mv_cache')!).cans).toHaveLength(2);
});

test('loadCans con server giù mantiene la cache senza errore', async () => {
  localStorage.setItem('mv_cache', JSON.stringify({ ts: 1, cans: [{ id: '1', nome: 'A' }] }));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net down')));

  await useCansStore.getState().loadCans();

  const s = useCansStore.getState();
  expect(s.cans.map((c) => c.nome)).toEqual(['A']);
  expect(s.error).toBeNull();
});

test('loadCans riprova sui 5xx (cold start) segnalando warming', async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: '1', nome: 'A' }] }),
    );

    const p = useCansStore.getState().loadCans();
    await vi.advanceTimersByTimeAsync(0);
    expect(useCansStore.getState().warming).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);
    await p;

    const s = useCansStore.getState();
    expect(s.cans.map((c) => c.nome)).toEqual(['A']);
    expect(s.warming).toBe(false);
    expect(s.error).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test('le mutazioni aggiornano la cache e updatedAt (saveCan)', async () => {
  useCansStore.setState({ cans: [{ id: '1', nome: 'Old' }], loading: false, error: null });
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: '1', nome: 'New' }) }),
  );

  await useCansStore.getState().saveCan({ id: '1', nome: 'New' });

  expect(JSON.parse(localStorage.getItem('mv_cache')!).cans[0].nome).toBe('New');
  expect(useCansStore.getState().updatedAt).toBeTruthy();
});

test('restoreCan chiama PUT /restore e re-inserisce lo snapshot', async () => {
  useCansStore.setState({ cans: [{ id: '2', nome: 'B' }], loading: false, error: null });
  const spy = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', spy);

  await useCansStore.getState().restoreCan({ id: '1', nome: 'A' });

  expect(spy).toHaveBeenCalledWith(
    '/api/cans/1/restore',
    expect.objectContaining({ method: 'PUT' }),
  );
  expect(useCansStore.getState().cans.map((c) => c.id)).toEqual(['2', '1']);
});

test('permanentDeleteCan chiama DELETE /permanent', async () => {
  const spy = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', spy);

  await useCansStore.getState().permanentDeleteCan('1');

  expect(spy).toHaveBeenCalledWith(
    '/api/cans/1/permanent',
    expect.objectContaining({ method: 'DELETE' }),
  );
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
