import { useEffect } from 'react';
import { useCansStore } from './store';
import { CanGrid } from './CanGrid';

function App() {
  const cans = useCansStore((s) => s.cans);
  const loading = useCansStore((s) => s.loading);
  const error = useCansStore((s) => s.error);
  const loadCans = useCansStore((s) => s.loadCans);

  useEffect(() => {
    loadCans();
  }, [loadCans]);

  return (
    <main>
      <h1>Monster Vault</h1>
      {loading && <p>Caricamento…</p>}
      {error && <p role="alert">Errore: {error}</p>}
      <CanGrid cans={cans} />
    </main>
  );
}

export default App;
