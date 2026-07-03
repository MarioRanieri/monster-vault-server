import { useEffect, useState } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';
import { CanDetail } from './CanDetail';
import { filterCans } from './filterCans';
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
  const [view, setView] = useState<'landing' | 'collection'>('landing');
  const [showLogin, setShowLogin] = useState(false);
  const [light, setLight] = useState(false);

  useEffect(() => {
    loadCans();
  }, [loadCans]);

  useEffect(() => {
    document.body.classList.toggle('light', light);
  }, [light]);

  const visible = filterCans(cans, { query, withPhoto, noPhoto, promo, full });
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
            onToggle: () => setWithPhoto((v) => !v),
          },
          {
            key: 'noPhoto',
            label: 'No photo',
            cls: 'filter-chip-nophotos',
            active: noPhoto,
            count: stats.total - stats.withPhoto,
            onToggle: () => setNoPhoto((v) => !v),
          },
        ]}
      />
      {loading && <p>Caricamento…</p>}
      {error && <p role="alert">Errore: {error}</p>}
      <CanGrid
        cans={visible}
        onSelect={(can) => {
          setSelectedId(can.id);
          setEditing(false);
        }}
      />
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
