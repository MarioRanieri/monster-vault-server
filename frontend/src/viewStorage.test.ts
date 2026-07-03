import { getViews, saveView, deleteView } from './viewStorage';
import type { ShareFilters } from './shareView';

const f: ShareFilters = {
  query: 'x',
  lingua: '',
  size: '',
  produttore: '',
  top: '',
  promo: true,
  full: false,
  withPhoto: false,
  noPhoto: false,
  vmin: '',
  vmax: '',
  ymin: '',
  ymax: '',
  sort: 'added-desc',
};

beforeEach(() => localStorage.clear());

test('save e get di una vista', () => {
  saveView('A', f);
  expect(getViews()).toEqual([{ name: 'A', filters: f }]);
});

test('salvare con lo stesso nome sovrascrive', () => {
  saveView('A', f);
  saveView('A', { ...f, query: 'y' });
  expect(getViews()).toHaveLength(1);
  expect(getViews()[0].filters.query).toBe('y');
});

test('deleteView rimuove per nome', () => {
  saveView('A', f);
  saveView('B', f);
  expect(deleteView('A').map((v) => v.name)).toEqual(['B']);
});

test('getViews su storage corrotto ritorna []', () => {
  localStorage.setItem('mv_saved_views', 'not json');
  expect(getViews()).toEqual([]);
});
