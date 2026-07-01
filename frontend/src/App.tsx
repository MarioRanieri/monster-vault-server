import { useEffect, useState } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';
import { CanDetail } from './CanDetail';
import { filterCans } from './filterCans';

function App() {
  const cans = useCansStore((s) => s.cans);
  const loading = useCansStore((s) => s.loading);
  const error = useCansStore((s) => s.error);
  const loadCans = useCansStore((s) => s.loadCans);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadCans();
  }, [loadCans]);

  const visible = filterCans(cans, query);
  const selected = cans.find((c) => c.id === selectedId) ?? null;

  return (
    <main>
      <h1>Monster Vault</h1>
      <input
        type="search"
        aria-label="Cerca"
        placeholder="Cerca per nome…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <p>Caricamento…</p>}
      {error && <p role="alert">Errore: {error}</p>}
      <CanGrid cans={visible} onSelect={(can) => setSelectedId(can.id)} />
      {selected && <CanDetail can={selected} onClose={() => setSelectedId(null)} />}
    </main>
  );
}

export default App;
