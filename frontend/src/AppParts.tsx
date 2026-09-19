import { CanGrid } from './cans/CanGrid';
import { CanList } from './cans/CanList';
import { CanWall } from './cans/CanWall';
import type { GridMode } from './filters/CollectionFilterBar';
import type { SortKey } from './filters/filterCans';
import type { Can } from './types';

export interface ToastState {
  msg: string;
  onUndo?: () => void;
}

// Stato di caricamento (con messaggio dedicato al cold start del free tier) e
// eventuale errore di rete.
export function LoadStatus({
  loading,
  warming,
  error,
}: Readonly<{ loading: boolean; warming: boolean; error: string | null }>) {
  return (
    <>
      {loading && (
        <p>
          {warming ? (
            <>
              Server warming up…{' '}
              <small style={{ color: 'var(--text2)', fontSize: 11 }}>
                Free tier cold start · usually 30–50s
              </small>
            </>
          ) : (
            'Loading…'
          )}
        </p>
      )}
      {error && <p role="alert">Error: {error}</p>}
    </>
  );
}

// Le tre viste della collezione (grid / list / wall) sullo stesso elenco.
export function CanViews({
  cans,
  mode,
  showPrice,
  sort,
  onSelect,
  onEdit,
  canEdit,
  onWall,
}: Readonly<{
  cans: Can[];
  mode: GridMode;
  showPrice: boolean;
  sort: SortKey;
  onSelect: (can: Can) => void;
  onEdit: (can: Can) => void;
  canEdit: boolean;
  onWall: (wall: { photos: string[]; alt: string }) => void;
}>) {
  if (mode === 'list') {
    return <CanList cans={cans} showPrice={showPrice} onSelect={onSelect} globalSort={sort} />;
  }
  if (mode === 'wall') {
    return (
      <CanWall
        cans={cans}
        onSelect={(can) => {
          const photos = [can.p1, can.p2, can.p3, can.p4].filter((u): u is string => Boolean(u));
          if (photos.length) onWall({ photos, alt: can.nome });
        }}
      />
    );
  }
  return (
    <CanGrid
      cans={cans}
      showPrice={showPrice}
      onSelect={onSelect}
      onEdit={canEdit ? onEdit : undefined}
    />
  );
}

export function Toast({ toast }: Readonly<{ toast: ToastState }>) {
  return (
    <output className={toast.onUndo ? 'toast toast-undo' : 'toast'}>
      {toast.msg}
      {toast.onUndo && (
        <button type="button" className="toast-undo-btn" onClick={toast.onUndo}>
          Undo
        </button>
      )}
    </output>
  );
}
