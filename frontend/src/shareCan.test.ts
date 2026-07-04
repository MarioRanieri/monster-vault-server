import { canShareText, canWhatsappUrl, canTelegramUrl } from './shareCan';
import type { Can } from './types';

const can: Can = { id: '1', nome: 'Alpha', lingua: 'USA', size: '500ML', sku: 'S1', note: 'FULL' };
const url = 'https://mv/share/1';

test('canShareText compone nome · paese · size · SKU · FULL · url', () => {
  expect(canShareText(can, url)).toBe('Alpha · USA · 500ML · SKU: S1 · FULL · https://mv/share/1');
});

test('canWhatsappUrl mette il nome in grassetto e codifica il testo', () => {
  const u = canWhatsappUrl(can, url);
  expect(u.startsWith('https://wa.me/?text=')).toBe(true);
  expect(decodeURIComponent(u.slice('https://wa.me/?text='.length))).toContain('*Alpha*');
});

test('canTelegramUrl usa t.me/share/url con url e titolo', () => {
  const u = canTelegramUrl(can, url);
  expect(u).toContain('https://t.me/share/url?url=');
  expect(decodeURIComponent(u)).toContain("Alpha — Mario Ranieri's collection");
});
