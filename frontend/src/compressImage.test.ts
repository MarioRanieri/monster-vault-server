import { compressImage } from './compressImage';

// jsdom non decodifica le immagini né implementa canvas/toBlob: qui li simuliamo,
// così possiamo verificare le decisioni (dimensioni, ripiego sull'originale).

const BIG = 500_000; // sopra la soglia dei 400KB → viene ricodificata

function bigFile(name = 'photo.png'): File {
  return new File([new Uint8Array(BIG)], name, { type: 'image/png' });
}

// Finto Image: appena gli si assegna src, "decodifica" con le misure date (o fallisce).
function fakeImage(width: number, height: number, fail = false) {
  class FakeImage {
    width = width;
    height = height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_: string) {
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

// Finto canvas: registra le misure ricevute e restituisce il blob scelto.
function fakeCanvas(opts: { ctx?: boolean; blob?: Blob | null } = {}) {
  const { ctx = true, blob = new Blob(['jpeg']) } = opts;
  const seen = { width: 0, height: 0, drawn: false };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    seen.width = this.width;
    seen.height = this.height;
    return ctx ? ({ drawImage: () => (seen.drawn = true) } as never) : null;
  });
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => cb(blob));
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('un file non-immagine passa intatto', async () => {
  const f = new File(['hello'], 'note.txt', { type: 'text/plain' });
  expect(await compressImage(f)).toBe(f);
});

test('una immagine piccola (< 400KB) passa intatta senza ricodifica', async () => {
  const f = new File([new Uint8Array(1000)], 'small.jpg', { type: 'image/jpeg' });
  expect(await compressImage(f)).toBe(f);
});

test('foto orizzontale grande: lato lungo a 1800px, proporzioni mantenute, JPEG', async () => {
  fakeImage(4000, 2000);
  const seen = fakeCanvas();
  const out = await compressImage(bigFile('wide.png'));
  expect(seen).toMatchObject({ width: 1800, height: 900, drawn: true });
  expect(out.type).toBe('image/jpeg');
  expect(out.name).toBe('wide.png');
});

test('foto verticale grande: il lato lungo (altezza) va a 1800px', async () => {
  fakeImage(2000, 4000);
  const seen = fakeCanvas();
  await compressImage(bigFile());
  expect(seen).toMatchObject({ width: 900, height: 1800 });
});

test('file pesante ma con dimensioni già ok: non ridimensiona, ricodifica soltanto', async () => {
  fakeImage(1000, 800);
  const seen = fakeCanvas();
  const out = await compressImage(bigFile());
  expect(seen).toMatchObject({ width: 1000, height: 800 });
  expect(out.type).toBe('image/jpeg');
});

test('senza contesto canvas restituisce il file originale', async () => {
  fakeImage(4000, 2000);
  fakeCanvas({ ctx: false });
  const f = bigFile();
  expect(await compressImage(f)).toBe(f);
});

test('se toBlob non produce nulla restituisce il file originale', async () => {
  fakeImage(4000, 2000);
  fakeCanvas({ blob: null });
  const f = bigFile();
  expect(await compressImage(f)).toBe(f);
});

test('se l’immagine non si decodifica restituisce l’originale e libera l’URL', async () => {
  fakeImage(0, 0, true);
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  const f = bigFile();
  expect(await compressImage(f)).toBe(f);
  expect(revoke).toHaveBeenCalled();
});
