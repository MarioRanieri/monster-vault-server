import { useState } from 'react';
import type { ShareFilters } from './shareView';
import { getViews, saveView, deleteView, type SavedView } from './viewStorage';

// Menu "Views" (classi .views-menu/.view-item del vecchio): salva la combinazione
// di filtri corrente con un nome (localStorage) e la riapplica via onApply.
export function SavedViews({
  current,
  onApply,
}: Readonly<{
  current: ShareFilters;
  onApply: (f: ShareFilters) => void;
}>) {
  const [open, setOpen] = useState(false);
  const [views, setLocalViews] = useState<SavedView[]>(() => getViews());

  const save = () => {
    const name = globalThis.prompt('Name this view:')?.trim();
    if (!name) return;
    setLocalViews(saveView(name, current));
  };

  return (
    <div className="views-wrap">
      <button
        type="button"
        className="reset-filters-btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ★ Views
      </button>
      {open && (
        <div className="views-menu" role="menu">
          {views.length === 0 && <div className="view-empty">No saved views yet</div>}
          {views.map((v) => (
            <div key={v.name} className="view-item">
              <button
                type="button"
                className="view-apply"
                onClick={() => {
                  onApply(v.filters);
                  setOpen(false);
                }}
              >
                {v.name}
              </button>
              <button
                type="button"
                className="view-del"
                aria-label={`Delete ${v.name}`}
                onClick={() => setLocalViews(deleteView(v.name))}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="view-item view-save" onClick={save}>
            ＋ Save current view
          </button>
        </div>
      )}
    </div>
  );
}
