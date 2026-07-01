import { test, expect } from '@playwright/test';

// Smoke minimo (Fase 0): la app React, buildata e servita da `vite preview`, si
// carica e mostra il titolo. Gli e2e delle feature reali arrivano nelle fasi successive.
test('la app si carica e mostra il titolo Monster Vault', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Monster Vault' })).toBeVisible();
});
