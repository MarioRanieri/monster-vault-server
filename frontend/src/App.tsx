import { useEffect, useState } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';
import { CanList } from './CanList';
import { CanWall } from './CanWall';
import { CanDetail } from './CanDetail';
import { filterCans, sortCans, filterOptions, type SortKey } from './filterCans';
import { Hero } from './Hero';
import { FilterBar } from './FilterBar';
import { computeStats } from './computeStats';
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
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState<Can | null>(null);
  const [withPhoto, setWithPhoto] = useState(false);
  const [noPhoto, setNoPhoto] = useState(false);
  const [promo, setPromo] = useState(false);
  const [full, setFull] = useState(false);
  const [flLingua, setFlLingua] = useState('');
  const [flSize, setFlSize] = useState('');
  const [flProduttore, setFlProduttore] = useState('');
  const [flTop, setFlTop] = useState('');
  const [flStato, setFlStato] = useState(''); // senza dropdown: si attiva solo dalle stats
  const [vmin, setVmin] = useState('');
  const [vmax, setVmax] = useState('');
  const [ymin, setYmin] = useState('');
  const [ymax, setYmax] = useState('');
  const [sort, setSort] = useState<SortKey>('added-desc');
  const [view, setView] = useState<'landing' | 'collection'>('landing');
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
    refresh();
  }, [loadCans, refresh]);

  useEffect(() => {
    document.body.classList.toggle('light', light);
  }, [light]);

  // Deep-link condiviso: al mount rilegge i filtri dalla URL e salta la landing.
  useEffect(() => {
    const f = parseShareUrl(globalThis.location.search);
    if (Object.keys(f).length === 0) return;
    if (f.query != null) setQuery(f.query);
    if (f.lingua != null) setFlLingua(f.lingua);
    if (f.size != null) setFlSize(f.size);
    if (f.produttore != null) setFlProduttore(f.produttore);
    if (f.top != null) setFlTop(f.top);
    if (f.promo) setPromo(true);
    if (f.full) setFull(true);
    if (f.withPhoto) setWithPhoto(true);
    if (f.noPhoto) setNoPhoto(true);
    if (f.vmin != null) setVmin(f.vmin);
    if (f.vmax != null) setVmax(f.vmax);
    if (f.ymin != null) setYmin(f.ymin);
    if (f.ymax != null) setYmax(f.ymax);
    if (f.sort != null) setSort(f.sort as SortKey);
    setView('collection');
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
      query,
      withPhoto,
      noPhoto,
      promo,
      full,
      lingua: flLingua,
      size: flSize,
      produttore: flProduttore,
      top: flTop,
      stato: flStato,
      vmin: numOrUndef(vmin),
      vmax: numOrUndef(vmax),
      ymin: numOrUndef(ymin),
      ymax: numOrUndef(ymax),
    }),
    sort,
  );
  const hasFilters = Boolean(
    query ||
    withPhoto ||
    noPhoto ||
    promo ||
    full ||
    flLingua ||
    flSize ||
    flProduttore ||
    flTop ||
    flStato ||
    vmin ||
    vmax ||
    ymin ||
    ymax,
  );
  const resetFilters = () => {
    setQuery('');
    setWithPhoto(false);
    setNoPhoto(false);
    setPromo(false);
    setFull(false);
    setFlLingua('');
    setFlSize('');
    setFlProduttore('');
    setFlTop('');
    setFlStato('');
    setVmin('');
    setVmax('');
    setYmin('');
    setYmax('');
  };
  const selectCan = (can: Can) => {
    setSelectedId(can.id);
    setEditing(false);
  };
  const currentFilters: ShareFilters = {
    query,
    lingua: flLingua,
    size: flSize,
    produttore: flProduttore,
    top: flTop,
    promo,
    full,
    withPhoto,
    noPhoto,
    vmin,
    vmax,
    ymin,
    ymax,
    sort,
  };
  const applyShareFilters = (f: Partial<ShareFilters>) => {
    setQuery(f.query ?? '');
    setFlLingua(f.lingua ?? '');
    setFlSize(f.size ?? '');
    setFlProduttore(f.produttore ?? '');
    setFlTop(f.top ?? '');
    setPromo(f.promo ?? false);
    setFull(f.full ?? false);
    setWithPhoto(f.withPhoto ?? false);
    setNoPhoto(f.noPhoto ?? false);
    setVmin(f.vmin ?? '');
    setVmax(f.vmax ?? '');
    setYmin(f.ymin ?? '');
    setYmax(f.ymax ?? '');
    if (f.sort) setSort(f.sort as SortKey);
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
    resetFilters();
    if (field === 'lingua') setFlLingua(value);
    else if (field === 'size') setFlSize(value);
    else if (field === 'produttore') setFlProduttore(value);
    else if (field === 'stato') setFlStato(value);
    else if (field === 'promo') setPromo(true);
    else if (field === 'full') setFull(true);
    else if (field === 'withPhoto') setWithPhoto(true);
    else if (field === 'noPhoto') setNoPhoto(true);
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
        withPhoto={stats.withPhoto}
        loading={loading}
        onEnter={() => setView('collection')}
        onAdmin={() => {
          setView('collection');
          setShowLogin(true);
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
        query={query}
        onQuery={setQuery}
        selects={[
          {
            key: 'lingua',
            allLabel: 'ALL COUNTRIES',
            value: flLingua,
            options: options.countries,
            onChange: setFlLingua,
          },
          {
            key: 'size',
            allLabel: 'ALL SIZES',
            value: flSize,
            options: options.sizes,
            onChange: setFlSize,
          },
          {
            key: 'produttore',
            allLabel: 'ALL MANUFACTURERS',
            value: flProduttore,
            options: options.manufacturers,
            onChange: setFlProduttore,
          },
          {
            key: 'top',
            allLabel: 'ALL TOPS/TABS',
            value: flTop,
            options: options.tops,
            onChange: setFlTop,
          },
        ]}
        chips={[
          {
            key: 'promo',
            label: 'Promo',
            cls: 'filter-chip-promo',
            active: promo,
            count: stats.promo,
            onToggle: () => setPromo((v) => !v),
          },
          {
            key: 'full',
            label: 'FULL',
            cls: 'filter-chip-full',
            active: full,
            count: stats.full,
            onToggle: () => setFull((v) => !v),
          },
          {
            key: 'withPhoto',
            label: 'With photo',
            cls: 'filter-chip-withphoto',
            active: withPhoto,
            count: stats.withPhoto,
            onToggle: () => {
              setWithPhoto((v) => !v);
              setNoPhoto(false);
            },
          },
          {
            key: 'noPhoto',
            label: 'No photo',
            cls: 'filter-chip-nophotos',
            active: noPhoto,
            count: stats.total - stats.withPhoto,
            onToggle: () => {
              setNoPhoto((v) => !v);
              setWithPhoto(false);
            },
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
            min: vmin,
            max: vmax,
            onMin: setVmin,
            onMax: setVmax,
          },
          {
            key: 'year',
            sep: '📅',
            min: ymin,
            max: ymax,
            onMin: setYmin,
            onMax: setYmax,
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
          cans={visible}
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
        <CanList cans={visible} showPrice={isAdmin && showPrice} onSelect={selectCan} />
      ) : (
        <CanWall
          cans={visible}
          onSelect={(can) => {
            const ph = [can.p1, can.p2, can.p3, can.p4].filter((u): u is string => Boolean(u));
            if (ph.length) setWallPhotos({ photos: ph, alt: can.nome });
          }}
        />
      )}
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
