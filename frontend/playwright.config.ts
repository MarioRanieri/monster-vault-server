import { defineConfig } from '@playwright/test';

// Smoke tests run against the built frontend served by `vite preview`, with the
// API mocked per-test (page.route). No backend/JDK/DB — these verify the
// frontend loads and wires up, which is exactly the class of bug (missing
// window bridges → white screen) that the Selenium E2E never caught in CI.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  // Block the service worker so page.route() mocks aren't bypassed by SW
  // network-first fetches on repeat navigations.
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
