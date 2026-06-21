import { defineConfig } from 'vitest/config';

// Unit tests only. E2E lives in tests/e2e and runs under Playwright
// (`npm run test:e2e`) — never picked up here.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
