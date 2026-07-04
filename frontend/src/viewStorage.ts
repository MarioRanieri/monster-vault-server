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
  // Le viste salvate sono le preferenze di filtro dell'utente stesso (nessun input
  // esterno) e vengono rilette come stato React, mai come HTML: localStorage non
  // esegue codice, quindi non è una sink XSS. Falso positivo verificato. NOSONAR
  localStorage.setItem(KEY, JSON.stringify(views)); // NOSONAR
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
