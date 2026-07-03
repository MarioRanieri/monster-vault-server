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
import { buildCsv, parseCsv } from './csv';
import type { Can } from './types';

function App() {
  const cans = useCansStore((s) => s.cans);
  const loading = useCansStore((s) => s.loading);
  const error = useCansStore((s) => s.error);
  const loadCans = useCansStore((s) => s.loadCans);
  const saveCan = useCansStore((s) => s.saveCan);
  const deleteCan = useCansStore((s) => s.deleteCan);
  const createCan = useCansStore((s) => s.createCan);
  const uploadPhoto = useCansStore((s) => s.uploadPhoto);
  const uploadPhotoFromUrl = useCansStore((s) => s.uploadPhotoFromUrl);
  const importCans = useCansStore((s) => s.importCans);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const authError = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
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
  const [vmin, setVmin] = useState('');
  const [vmax, setVmax] = useState('');
  const [ymin, setYmin] = useState('');
  const [ymax, setYmax] = useState('');
  const [sort, setSort] = useState<SortKey>('added-desc');
  const [view, setView] = useState<'landing' | 'collection'>('landing');
  const [showLogin, setShowLogin] = useState(false);
  const [light, setLight] = useState(false);
  const [gridMode, setGridMode] = useState<'grid' | 'list' | 'wall'>('grid');
  const [toast, setToast] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showValue, setShowValue] = useState(false);

  useEffect(() => {
    loadCans();
  }, [loadCans]);

  useEffect(() => {
    document.body.classList.toggle('light', light);
  }, [light]);

  // Deep-link condiviso: al mount rilegge i filtri dalla URL e salta la landing.
  useEffect(() => {
    const f = parseShareUrl(window.location.search);
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
    const url = buildShareUrl(window.location.origin + window.location.pathname, currentFilters);
    void navigator.clipboard?.writeText(url);
    setToast('🔗 View link copied');
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
  const toggleWatch = (can: Can) => saveCan({ ...can, watch: !can.watch });
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const exportCsv = () => {
    const blob = new Blob([buildCsv(visible)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monster_vault.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📄 CSV exported');
  };
  const importCsv = async (file: File) => {
    const parsed = parseCsv(await file.text());
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
        onExport={exportCsv}
        onImport={importCsv}
      />
      <Hero
        stats={stats}
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
      {loading && <p>Loading…</p>}
      {error && <p role="alert">Error: {error}</p>}
      <div className="grid-info">
        <span>
          {visible.length === cans.length
            ? `${cans.length} cans`
            : `${visible.length} of ${cans.length} cans`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SavedViews current={currentFilters} onApply={applyShareFilters} />
          <button type="button" className="share-view-btn" onClick={shareCurrentView}>
            🔗 Share view
          </button>
        </div>
      </div>
      {gridMode === 'grid' ? (
        <CanGrid cans={visible} onSelect={selectCan} />
      ) : gridMode === 'list' ? (
        <CanList cans={visible} isAdmin={isAdmin} onSelect={selectCan} />
      ) : (
        <CanWall cans={visible} onSelect={selectCan} />
      )}
      {selected &&
        (editing ? (
          <CanEditForm
            can={selected}
            onSave={async (updated) => {
              await saveCan(updated);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            onUploadPhoto={(slot, file) => uploadPhoto(selected.id, slot, file)}
            onUploadPhotoUrl={(slot, url) => uploadPhotoFromUrl(selected.id, slot, url)}
          />
        ) : (
          <CanDetail
            can={selected}
            onClose={() => setSelectedId(null)}
            isAdmin={isAdmin}
            onEdit={() => setEditing(true)}
            onDelete={async () => {
              await deleteCan(selected.id);
              setSelectedId(null);
            }}
            inCompare={compareIds.includes(selected.id)}
            onToggleCompare={() => toggleCompare(selected.id)}
            watching={selected.watch}
            onToggleWatch={isAdmin ? () => toggleWatch(selected) : undefined}
          />
        ))}
      {creating && (
        <CanEditForm
          can={creating}
          onSave={async (newCan) => {
            await createCan(newCan);
            setCreating(null);
          }}
          onCancel={() => setCreating(null)}
        />
      )}
      {showLogin && (
        <LoginForm onLogin={handleLogin} error={authError} onGuest={() => setShowLogin(false)} />
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
      {showStats && <StatsModal cans={cans} stats={stats} onClose={() => setShowStats(false)} />}
      {showValue && <ValueCalc cans={visible} onClose={() => setShowValue(false)} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

export default App;
