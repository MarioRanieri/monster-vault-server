import { useEffect, useState } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';
import { CanDetail } from './CanDetail';
import { filterCans } from './filterCans';
import { StatsBar } from './StatsBar';
import { computeStats } from './computeStats';
import { useAuthStore } from './authStore';
import { LoginForm } from './LoginForm';

function App() {
  const cans = useCansStore((s) => s.cans);
  const loading = useCansStore((s) => s.loading);
  const error = useCansStore((s) => s.error);
  const loadCans = useCansStore((s) => s.loadCans);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const authError = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        <button type="button" onClick={() => logout()}>
          Esci
        </button>
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
      <CanGrid cans={visible} onSelect={(can) => setSelectedId(can.id)} />
      {selected && <CanDetail can={selected} onClose={() => setSelectedId(null)} />}
    </main>
  );
}

export default App;
