import { compressImage } from './compressImage';

// Nota: il ridimensionamento via canvas non è testabile in jsdom (niente decode
// immagini né toBlob reali), come nel vecchio photos.ts. Copriamo i due
// short-circuit che decidono se comprimere.

test('un file non-immagine passa intatto', async () => {
  const f = new File(['hello'], 'note.txt', { type: 'text/plain' });
  expect(await compressImage(f)).toBe(f);
});

test('una immagine piccola (< 400KB) passa intatta senza ricodifica', async () => {
  const f = new File([new Uint8Array(1000)], 'small.jpg', { type: 'image/jpeg' });
  expect(await compressImage(f)).toBe(f);
});
