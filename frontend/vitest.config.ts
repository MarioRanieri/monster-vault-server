import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Config separata per i test (build usa vite.config.ts). jsdom simula il DOM del
// browser; setupFiles carica i matcher di jest-dom; coverage in formato lcov per SonarQube.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'public/map-data.js'],
      exclude: [
        'src/main.tsx',
        'src/setupTests.ts',
        'src/**/*.d.ts',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/PhotoCrop.tsx',
      ],
    },
  },
});
