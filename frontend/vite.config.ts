import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In sviluppo (`vite dev`) le chiamate a /api vengono inoltrate al backend deployato
// su Render: così la app React parla con l'API reale senza avviare Spring in locale.
// In produzione il backend serve la app same-origin, quindi il proxy non serve.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://monster-vault-server.onrender.com',
        changeOrigin: true,
      },
    },
  },
});
