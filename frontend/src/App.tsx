import { useEffect, useState } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';
import { CanDetail } from './CanDetail';
import { filterCans } from './filterCans';
import { StatsBar } from './StatsBar';
import { computeStats } from './computeStats';
import { useAuthStore } from './authStore';
import { LoginForm } from './LoginForm';
import { CanEditForm } from './CanEditForm';
import type { Can } from './types';

function App() {
  const cans = useCansStore((s) => s.cans);
  const loading = useCansStore((s) => s.loading);
  const error = useCansStore((s) => s.error);
  const loadCans = useCansStore((s) => s.loadCans);
  const saveCan = useCansStore((s) => s.saveCan);
  const deleteCan = useCansStore((s) => s.deleteCan);
  const createCan = useCansStore((s) => s.createCan);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const authError = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState<Can | null>(null);
  const [withPhoto, setWithPhoto] = useState(false);
  const [promo, setPromo] = useState(false);

  useEffect(() => {
    loadCans();
  }, [loadCans]);

  const visible = filterCans(cans, { query, withPhoto, promo });
  const selected = cans.find((c) => c.id === selectedId) ?? null;

  return (
    <main>
      <h1>Monster Vault</h1>
      {isAdmin ? (
        <div className="admin-bar">
          <button type="button" onClick={() => logout()}>
            Esci
          </button>
          <button type="button" onClick={() => setCreating({ id: crypto.randomUUID(), nome: '' })}>
            Nuova
          </button>
        </div>
      ) : (
        <LoginForm onLogin={login} error={authError} />
      )}
      <StatsBar stats={computeStats(cans)} />
      <input
        type="search"
        aria-label="Cerca"
        placeholder="Cerca per nome…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chips">
        <button type="button" aria-pressed={withPhoto} onClick={() => setWithPhoto((v) => !v)}>
          Con foto
        </button>
        <button type="button" aria-pressed={promo} onClick={() => setPromo((v) => !v)}>
          Promo
        </button>
      </div>
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
    </main>
  );
}

export default App;
