import { test, expect, type Page } from '@playwright/test';

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
  { id: 'c2', nome: 'OG', sku: '0118', produttore: 'BALL', lingua: 'ITALY' },
];

test.use({ viewport: { width: 390, height: 844 } });

// Sessione admin finta (hint in localStorage + refresh con token) e form aperto.
async function openEdit(page: Page) {
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
}

test('il modale Edit Can non scorre in orizzontale', async ({ page }) => {
  await openEdit(page);
  const overflow = await page
    .locator('dialog .modal')
    .evaluate((m) => m.scrollWidth - m.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Manufacturer suggerisce i valori esistenti e il tocco ne sceglie uno', async ({ page }) => {
  await openEdit(page);
  const field = page.locator('#e-produttore');
  await field.fill('');
  await field.pressSequentially('al');
  await page.getByRole('option', { name: 'BALL' }).click();
  await expect(field).toHaveValue('BALL');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});
