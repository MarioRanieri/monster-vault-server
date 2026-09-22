import { test, expect } from '@playwright/test';

// Il form di modifica su mobile non deve scorrere in orizzontale: con la griglia
// a due colonne gli input (16px su mobile) non si stringevano sotto la loro
// larghezza intrinseca e sforavano a destra. Serve un layout vero → Playwright.
const CANS = [
  {
    id: 'c1',
    nome: 'LO-CARB SMALL LOGO',
    sku: '0920',
    produttore: 'CROWN',
    size: '473ml',
    lingua: 'MEXICO',
    top: 'SILVER/LIGHT BLUE',
    stato: 'OK',
  },
];

test.use({ viewport: { width: 390, height: 844 } });

test('il modale Edit Can non scorre in orizzontale', async ({ page }) => {
  // Sessione admin finta: hint in localStorage + refresh che restituisce un token.
  await page.addInitScript(() => localStorage.setItem('mv_auth', '1'));
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'fake' }),
    }),
  );
  await page.route('**/api/cans**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANS) }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit' }).first().click();
  const overflow = await page
    .locator('dialog .modal')
    .evaluate((m) => m.scrollWidth - m.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
