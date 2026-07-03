import { useEffect, useState } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';
import { CanList } from './CanList';
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
  const [gridMode, setGridMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadCans();
  }, [loadCans]);

  useEffect(() => {
    document.body.classList.toggle('light', light);
  }, [light]);

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
      />
      <Hero stats={stats} />
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
          onChange: (v) => setGridMode(v as 'grid' | 'list'),
        }}
      />
      {loading && <p>Caricamento…</p>}
      {error && <p role="alert">Errore: {error}</p>}
      {gridMode === 'grid' ? (
        <CanGrid cans={visible} onSelect={selectCan} />
      ) : (
        <CanList cans={visible} isAdmin={isAdmin} onSelect={selectCan} />
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
    </main>
  );
}

export default App;
