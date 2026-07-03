import type { ShareFilters } from './shareView';

export interface SavedView {
  name: string;
  filters: ShareFilters;
}

const KEY = 'mv_saved_views';

export function getViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

export function setViews(views: SavedView[]): void {
  localStorage.setItem(KEY, JSON.stringify(views));
}

// Salva (o sovrascrive per nome) e ritorna la lista aggiornata.
export function saveView(name: string, filters: ShareFilters): SavedView[] {
  const views = getViews().filter((v) => v.name !== name);
  views.push({ name, filters });
  setViews(views);
  return views;
}

export function deleteView(name: string): SavedView[] {
  const views = getViews().filter((v) => v.name !== name);
  setViews(views);
  return views;
}
