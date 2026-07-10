import { useCallback, useEffect, useRef, useState } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';
import { CanList } from './CanList';
import { CanWall } from './CanWall';
import { CanDetail } from './CanDetail';
import { filterCans, sortCans, filterOptions, type SortKey } from './filterCans';
import { Hero } from './Hero';
import { FilterBar } from './FilterBar';
import { computeStats, addedThisMonth } from './computeStats';
import { useAuthStore } from './authStore';
import { LoginForm } from './LoginForm';
import { CanEditForm } from './CanEditForm';
import { LandingPage } from './LandingPage';
import { Header } from './Header';
import { buildShareUrl, parseShareUrl, type ShareFilters } from './shareView';
import { SavedViews } from './SavedViews';
import { CompareBar } from './CompareBar';
import { ComparePanel } from './ComparePanel';
import { StatsModal } from './StatsModal';
import { ValueCalc } from './ValueCalc';
import { parseCsv } from './csv';
import { buildXlsx, parseXlsx } from './excel';
import { HelpModal } from './HelpModal';
import { Lightbox } from './Lightbox';
import { AccountPanel } from './AccountPanel';
import type { Can } from './types';

// Tutti i criteri di filtro in un unico oggetto: prima erano 14 useState
// duplicati in 5 punti (dichiarazione, restore, filtro, reset, share). `stato`
// non è condiviso (niente in ShareFilters) e si attiva solo dalle stats.
interface Filters {
  query: string;
  lingua: string;
  size: string;
  produttore: string;
  top: string;
  stato: string;
  promo: boolean;
  full: boolean;
  withPhoto: boolean;
  noPhoto: boolean;
  vmin: string;
  vmax: string;
  ymin: string;
  ymax: string;
}
// Render incrementale: quante card montare per "pagina" (vedi shownCans).
const PAGE = 60;
const NO_FILTERS: Filters = {
  query: '',
  lingua: '',
  size: '',
  produttore: '',
  top: '',
  stato: '',
  promo: false,
  full: false,
  withPhoto: false,
  noPhoto: false,
  vmin: '',
  vmax: '',
  ymin: '',
  ymax: '',
};

function App() {
  const cans = useCansStore((s) => s.cans);
  const loading = useCansStore((s) => s.loading);
  const error = useCansStore((s) => s.error);
  const warming = useCansStore((s) => s.warming);
  const updatedAt = useCansStore((s) => s.updatedAt);
  const loadCans = useCansStore((s) => s.loadCans);
  const saveCan = useCansStore((s) => s.saveCan);
  const deleteCan = useCansStore((s) => s.deleteCan);
  const restoreCan = useCansStore((s) => s.restoreCan);
  const permanentDeleteCan = useCansStore((s) => s.permanentDeleteCan);
  const createCan = useCansStore((s) => s.createCan);
  const uploadPhoto = useCansStore((s) => s.uploadPhoto);
  const uploadPhotoFromUrl = useCansStore((s) => s.uploadPhotoFromUrl);
  const importCans = useCansStore((s) => s.importCans);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const authError = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const refresh = useAuthStore((s) => s.refresh);
  const recover = useAuthStore((s) => s.recover);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState<Can | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));
  const [sort, setSort] = useState<SortKey>('added-desc');
  // Chi è già entrato una volta (mv_seen_landing) salta la splash e va dritto in
  // collection; la landing resta raggiungibile dal logo dell'header.
  const [view, setView] = useState<'landing' | 'collection'>(() =>
    localStorage.getItem('mv_seen_landing') ? 'collection' : 'landing',
  );
  const enterCollection = () => {
    localStorage.setItem('mv_seen_landing', '1');
    setView('collection');
  };
  const [showLogin, setShowLogin] = useState(false);
  const [light, setLight] = useState(false);
  const [gridMode, setGridMode] = useState<'grid' | 'list' | 'wall'>('grid');
  const [toast, setToast] = useState<{ msg: string; onUndo?: () => void } | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [wallPhotos, setWallPhotos] = useState<{ photos: string[]; alt: string } | null>(null);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    loadCans();
    // Ripristina la sessione solo se questo browser ha già fatto login (hint
    // mv_auth): i guest non chiamano /auth/refresh → niente 401 in console.
    if (localStorage.getItem('mv_auth')) refresh();
  }, [loadCans, refresh]);

  useEffect(() => {
    document.body.classList.toggle('light', light);
  }, [light]);

  // Deep-link condiviso: al mount rilegge i filtri dalla URL e salta la landing.
  // Senza parametri condivisi, ripristina gli ultimi filtri usati (mv_filters).
  useEffect(() => {
    const shared = parseShareUrl(globalThis.location.search);
    const fromUrl = Object.keys(shared).length > 0;
    let f = shared;
    if (!fromUrl) {
      try {
        f = (JSON.parse(localStorage.getItem('mv_filters') || 'null') as ShareFilters) ?? {};
      } catch {
        f = {};
      }
    }
    if (Object.keys(f).length === 0) return;
    const { sort: s, ...rest } = f;
    setFilters((prev) => ({ ...prev, ...rest }));
    if (s != null) setSort(s as SortKey);
    if (fromUrl) setView('collection');
  }, []);

  const options = filterOptions(cans);
  const suggestions = {
    manufacturers: options.manufacturers,
    sizes: options.sizes,
    countries: options.countries,
    tops: options.tops,
    conditions: [
      ...new Set(cans.map((c) => c.stato?.trim()).filter((v): v is string => Boolean(v))),
    ].sort((a, b) => a.localeCompare(b)),
  };
  const uploadStaged = async (
    id: string,
    uploads: { slot: number; file?: File; url?: string }[],
  ) => {
    for (const u of uploads) {
      if (u.file) await uploadPhoto(id, u.slot, u.file);
      else if (u.url) await uploadPhotoFromUrl(id, u.slot, u.url);
    }
  };
  const numOrUndef = (s: string) => (s === '' ? undefined : Number(s));
  const visible = sortCans(
    filterCans(cans, {
      ...filters,
      vmin: numOrUndef(filters.vmin),
      vmax: numOrUndef(filters.vmax),
      ymin: numOrUndef(filters.ymin),
      ymax: numOrUndef(filters.ymax),
    }),
    sort,
  );
  const hasFilters = Object.values(filters).some(Boolean);
  const resetFilters = () => setFilters(NO_FILTERS);
  const selectCan = (can: Can) => {
    setSelectedId(can.id);
    setEditing(false);
  };
  // ShareFilters non include `stato` (si attiva solo dalle stats, non si condivide).
  const currentFilters: ShareFilters = {
    query: filters.query,
    lingua: filters.lingua,
    size: filters.size,
    produttore: filters.produttore,
    top: filters.top,
    promo: filters.promo,
    full: filters.full,
    withPhoto: filters.withPhoto,
    noPhoto: filters.noPhoto,
    vmin: filters.vmin,
    vmax: filters.vmax,
    ymin: filters.ymin,
    ymax: filters.ymax,
    sort,
  };
  // Persistenza filtri come il vecchio saveFilters (chiave mv_filters): scritti
  // a ogni cambio, saltando il primo render (non sovrascrivere prima del restore).
  const filtersJson = JSON.stringify(currentFilters);
  const persistReady = useRef(false);
  useEffect(() => {
    if (persistReady.current) localStorage.setItem('mv_filters', filtersJson);
    else persistReady.current = true;
  }, [filtersJson]);
  // Render incrementale: monta le prime PAGE card, poi cresce quando l'utente
  // arriva in fondo (IntersectionObserver sul sentinel) → evita ~1866 nodi al
  // primo paint. Riparte da capo quando cambiano filtri/sort o i dati.
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [filtersJson, cans.length]);
  // Callback ref sul sentinel: (dis)connette l'IntersectionObserver esattamente
  // quando il nodo monta/smonta, senza dipendere dal timing degli effetti.
  // rootMargin carica la pagina successiva ~600px prima del fondo (preload).
  const ioRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    ioRef.current?.disconnect();
    if (node && typeof IntersectionObserver !== 'undefined') {
      ioRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) setShown((n) => n + PAGE);
        },
        { rootMargin: '600px' },
      );
      ioRef.current.observe(node);
    }
  }, []);
  const shownCans = visible.slice(0, shown);
  const applyShareFilters = (f: Partial<ShareFilters>) => {
    const { sort: s, ...rest } = f;
    setFilters({ ...NO_FILTERS, ...rest });
    if (s) setSort(s as SortKey);
  };
  const shareCurrentView = () => {
    const url = buildShareUrl(
      globalThis.location.origin + globalThis.location.pathname,
      currentFilters,
    );
    void navigator.clipboard?.writeText(url);
    setToast({ msg: '🔗 View link copied' });
    setTimeout(() => setToast(null), 2000);
  };
  const toggleCompare = (id: string) => {
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 4 ? ids : [...ids, id],
    );
  };
  const compareCans = compareIds
    .map((id) => cans.find((c) => c.id === id))
    .filter((c): c is Can => Boolean(c));
  const showToast = (msg: string) => {
    setToast({ msg });
    setTimeout(() => setToast(null), 2500);
  };
  // Soft-delete con finestra di undo di 10s, come la vecchia app: Undo → restore
  // dello snapshot; scaduto il timer → purge definitivo (DB + foto Cloudinary).
  const handleDelete = async (can: Can) => {
    await deleteCan(can.id);
    setEditing(false);
    setSelectedId(null);
    const purge = setTimeout(() => {
      permanentDeleteCan(can.id).catch(() => {});
      setToast(null);
    }, 10000);
    setToast({
      msg: 'Can deleted',
      onUndo: async () => {
        clearTimeout(purge);
        try {
          await restoreCan(can);
          showToast('Restored ✓');
        } catch {
          showToast('⚠ Restore failed');
        }
      },
    });
  };
  // Click su una voce delle stats: chiude il modal, azzera i filtri e applica
  // solo quello scelto (come il vecchio statsFilter), con toast e scroll su.
  const statsFilter = (field: string, value: string) => {
    const boolField =
      field === 'promo' || field === 'full' || field === 'withPhoto' || field === 'noPhoto';
    setFilters({ ...NO_FILTERS, [field]: boolField ? true : value } as Filters);
    setShowStats(false);
    showToast(`Filter: ${value}`);
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  };
  const exportExcel = async () => {
    const buf = await buildXlsx(visible);
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monster_vault_export.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📄 Excel exported');
  };
  // Import per estensione: .xlsx/.xls (anche i backup della vecchia app) o .csv.
  const importFile = async (file: File) => {
    const parsed = file.name.toLowerCase().endsWith('.csv')
      ? parseCsv(await file.text())
      : await parseXlsx(await file.arrayBuffer());
    await importCans(parsed);
    showToast(`📥 Imported ${parsed.length} cans`);
  };
  const selected = cans.find((c) => c.id === selectedId) ?? null;
  const stats = computeStats(cans);

  const handleLogin = async (u: string, p: string) => {
    await login(u, p);
    if (useAuthStore.getState().isAdmin) setShowLogin(false);
  };

  if (view === 'landing') {
    return (
      <LandingPage
        total={stats.total}
        countries={stats.countries}
        addedThisMonth={addedThisMonth(cans)}
        loading={loading}
        onEnter={enterCollection}
        onAdmin={() => {
          // Già admin (sessione attiva) → entra dritto, niente password.
          // Guest → entra e apre il login.
          enterCollection();
          if (!isAdmin) setShowLogin(true);
        }}
      />
    );
  }

  return (
    <main>
      <Header
        isAdmin={isAdmin}
        onSignOut={() => {
          logout();
          setView('landing');
        }}
        onLogoHome={() => setView('landing')}
        onAdd={() => setCreating({ id: crypto.randomUUID(), nome: '' })}
        onLogin={() => setShowLogin(true)}
        onToggleTheme={() => setLight((v) => !v)}
        onGuide={() => setShowGuide(true)}
        onExport={exportExcel}
        onImport={importFile}
        onAccount={() => setShowAccount(true)}
      />
      <Hero
        stats={stats}
        isAdmin={isAdmin}
        onStats={() => setShowStats(true)}
        onValue={isAdmin ? () => setShowValue(true) : undefined}
      />
      <FilterBar
        query={filters.query}
        onQuery={(v) => setFilter('query', v)}
        selects={[
          {
            key: 'lingua',
            allLabel: 'ALL COUNTRIES',
            value: filters.lingua,
            options: options.countries,
            onChange: (v) => setFilter('lingua', v),
          },
          {
            key: 'size',
            allLabel: 'ALL SIZES',
            value: filters.size,
            options: options.sizes,
            onChange: (v) => setFilter('size', v),
          },
          {
            key: 'produttore',
            allLabel: 'ALL MANUFACTURERS',
            value: filters.produttore,
            options: options.manufacturers,
            onChange: (v) => setFilter('produttore', v),
          },
          {
            key: 'top',
            allLabel: 'ALL TOPS/TABS',
            value: filters.top,
            options: options.tops,
            onChange: (v) => setFilter('top', v),
          },
        ]}
        chips={[
          {
            key: 'promo',
            label: 'Promo',
            cls: 'filter-chip-promo',
            active: filters.promo,
            count: stats.promo,
            onToggle: () => setFilter('promo', !filters.promo),
          },
          {
            key: 'full',
            label: 'FULL',
            cls: 'filter-chip-full',
            active: filters.full,
            count: stats.full,
            onToggle: () => setFilter('full', !filters.full),
          },
          {
            key: 'withPhoto',
            label: 'With photo',
            cls: 'filter-chip-withphoto',
            active: filters.withPhoto,
            count: stats.withPhoto,
            // withPhoto e noPhoto sono mutuamente esclusivi.
            onToggle: () => setFilters((f) => ({ ...f, withPhoto: !f.withPhoto, noPhoto: false })),
          },
          {
            key: 'noPhoto',
            label: 'No photo',
            cls: 'filter-chip-nophotos',
            active: filters.noPhoto,
            count: stats.total - stats.withPhoto,
            onToggle: () => setFilters((f) => ({ ...f, noPhoto: !f.noPhoto, withPhoto: false })),
          },
        ]}
        sort={{
          value: sort,
          options: [
            { value: 'added-desc', label: 'RECENTLY PHOTOGRAPHED' },
            { value: 'nome-asc', label: 'NAME A→Z' },
            { value: 'lingua-asc', label: 'COUNTRY A→Z' },
            { value: 'valore-desc', label: 'VALUE ↓' },
            { value: 'valore-asc', label: 'VALUE ↑' },
          ],
          onChange: (v) => setSort(v as SortKey),
        }}
        ranges={[
          {
            key: 'price',
            sep: '€',
            min: filters.vmin,
            max: filters.vmax,
            onMin: (v) => setFilter('vmin', v),
            onMax: (v) => setFilter('vmax', v),
          },
          {
            key: 'year',
            sep: '📅',
            min: filters.ymin,
            max: filters.ymax,
            onMin: (v) => setFilter('ymin', v),
            onMax: (v) => setFilter('ymax', v),
            minPlaceholder: 'from',
            maxPlaceholder: 'to',
          },
        ]}
        onReset={hasFilters ? resetFilters : undefined}
        view={{
          value: gridMode,
          onChange: (v) => setGridMode(v as 'grid' | 'list' | 'wall'),
        }}
      />
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
      <div className="grid-info">
        <span>
          {visible.length === cans.length
            ? `${cans.length} cans`
            : `${visible.length} of ${cans.length} cans`}
          {updatedAt != null && (
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>
              · Updated {new Date(updatedAt).toLocaleDateString('en-US')}{' '}
              {new Date(updatedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <button
              type="button"
              className="share-view-btn"
              aria-pressed={showPrice}
              onClick={() => setShowPrice((v) => !v)}
            >
              € {showPrice ? 'Hide prices' : 'Show prices'}
            </button>
          )}
          <SavedViews current={currentFilters} onApply={applyShareFilters} />
          <button type="button" className="share-view-btn" onClick={shareCurrentView}>
            🔗 Share view
          </button>
        </div>
      </div>
      {gridMode === 'grid' ? (
        <CanGrid
          cans={shownCans}
          showPrice={isAdmin && showPrice}
          onSelect={selectCan}
          onEdit={
            isAdmin
              ? (can) => {
                  setSelectedId(can.id);
                  setEditing(true);
                }
              : undefined
          }
        />
      ) : gridMode === 'list' ? (
        <CanList cans={shownCans} showPrice={isAdmin && showPrice} onSelect={selectCan} />
      ) : (
        <CanWall
          cans={shownCans}
          onSelect={(can) => {
            const ph = [can.p1, can.p2, can.p3, can.p4].filter((u): u is string => Boolean(u));
            if (ph.length) setWallPhotos({ photos: ph, alt: can.nome });
          }}
        />
      )}
      {shown < visible.length && <div ref={sentinelRef} aria-hidden="true" />}
      {selected &&
        (editing ? (
          <CanEditForm
            can={selected}
            title="Edit Can"
            suggestions={suggestions}
            onSave={async (canData, uploads) => {
              try {
                const saved = await saveCan(canData);
                try {
                  await uploadStaged(saved.id, uploads);
                  showToast('Can updated ✓');
                } catch {
                  showToast('⚠ Some photos could not be uploaded');
                }
                setEditing(false);
              } catch {
                showToast('⚠ Could not save changes');
              }
            }}
            onCancel={() => setEditing(false)}
            onDelete={() => handleDelete(selected)}
          />
        ) : (
          <CanDetail
            can={selected}
            onClose={() => setSelectedId(null)}
            isAdmin={isAdmin}
            showPrice={isAdmin && showPrice}
            onEdit={() => setEditing(true)}
            onDelete={() => handleDelete(selected)}
            inCompare={compareIds.includes(selected.id)}
            onToggleCompare={() => toggleCompare(selected.id)}
            onToast={showToast}
          />
        ))}
      {creating && (
        <CanEditForm
          can={creating}
          title="Add Can"
          suggestions={suggestions}
          onSave={async (canData, uploads) => {
            try {
              const saved = await createCan(canData);
              try {
                await uploadStaged(saved.id, uploads);
                showToast('Can added ✓');
              } catch {
                showToast('⚠ Some photos could not be uploaded');
              }
              setCreating(null);
            } catch {
              showToast('⚠ Could not save changes');
            }
          }}
          onCancel={() => setCreating(null)}
        />
      )}
      {showLogin && (
        <LoginForm
          onLogin={handleLogin}
          error={authError}
          onGuest={() => setShowLogin(false)}
          onRecover={recover}
        />
      )}
      <CompareBar
        cans={compareCans}
        onRemove={toggleCompare}
        onOpen={() => setShowCompare(true)}
        onClear={() => setCompareIds([])}
      />
      {showCompare && compareCans.length >= 2 && (
        <ComparePanel cans={compareCans} isAdmin={isAdmin} onClose={() => setShowCompare(false)} />
      )}
      {showStats && (
        <StatsModal
          cans={cans}
          stats={stats}
          onClose={() => setShowStats(false)}
          isAdmin={isAdmin}
          onFilter={statsFilter}
          onSelect={(can) => {
            setShowStats(false);
            setSelectedId(can.id);
            setEditing(false);
          }}
        />
      )}
      {showValue && <ValueCalc cans={visible} onClose={() => setShowValue(false)} />}
      {showGuide && <HelpModal onClose={() => setShowGuide(false)} />}
      {showAccount && <AccountPanel onClose={() => setShowAccount(false)} />}
      {wallPhotos && (
        <Lightbox
          photos={wallPhotos.photos}
          alt={wallPhotos.alt}
          onClose={() => setWallPhotos(null)}
        />
      )}
      {toast && (
        <div className={toast.onUndo ? 'toast toast-undo' : 'toast'} role="status">
          {toast.msg}
          {toast.onUndo && (
            <button type="button" className="toast-undo-btn" onClick={toast.onUndo}>
              Undo
            </button>
          )}
        </div>
      )}
    </main>
  );
}

export default App;
