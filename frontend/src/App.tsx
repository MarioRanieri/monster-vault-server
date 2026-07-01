import { useEffect, useState } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';
import { filterCans } from './filterCans';

function App() {
  const cans = useCansStore((s) => s.cans);
  const loading = useCansStore((s) => s.loading);
  const error = useCansStore((s) => s.error);
  const loadCans = useCansStore((s) => s.loadCans);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadCans();
  }, [loadCans]);

  const visible = filterCans(cans, query);

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
      <CanGrid cans={visible} />
    </main>
  );
}

export default App;
