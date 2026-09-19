import { buildShareUrl, parseShareUrl } from './shareView';

const base = 'https://x.test/';

const empty = {
  query: '',
  lingua: '',
  size: '',
  produttore: '',
  top: '',
  promo: false,
  full: false,
  withPhoto: false,
  noPhoto: false,
  vmin: '',
  vmax: '',
  ymin: '',
  ymax: '',
  sort: 'added-desc',
};

test('buildShareUrl codifica solo i filtri attivi', () => {
  const url = buildShareUrl(base, {
    ...empty,
    query: 'ripper',
    lingua: 'USA',
    promo: true,
    withPhoto: true,
    vmin: '5',
    sort: 'valore-desc',
  });
  const p = new URLSearchParams(url.split('?')[1]);
  expect(p.get('q')).toBe('ripper');
  expect(p.get('lingua')).toBe('USA');
  expect(p.get('chips')).toBe('promo,withphoto');
  expect(p.get('vmin')).toBe('5');
  expect(p.get('sort')).toBe('valore-desc');
});

test('buildShareUrl senza filtri (e sort di default) ritorna il base', () => {
  expect(buildShareUrl(base, empty)).toBe(base);
});

test('parseShareUrl è l’inverso di buildShareUrl', () => {
  expect(
    parseShareUrl('?q=ripper&lingua=USA&chips=promo,withphoto&vmin=5&sort=valore-desc'),
  ).toEqual({
    query: 'ripper',
    lingua: 'USA',
    promo: true,
    withPhoto: true,
    vmin: '5',
    sort: 'valore-desc',
  });
});

test('parseShareUrl su stringa vuota ritorna oggetto vuoto', () => {
  expect(parseShareUrl('')).toEqual({});
});
