import { test, expect, type Page } from '@playwright/test';

// 3 cans with values 3 / 4 / 5 → collection total €12.00.
const CANS = [
  { id: 'c1', nome: 'Monster Original', sku: 'MO-1', lingua: 'USA', valore: '3', stato: 'OK', p1: 'https://x/a.jpg' },
  { id: 'c2', nome: 'Monster Ultra', sku: 'MU-2', lingua: 'ITALY', valore: '4', stato: 'OK', p1: 'https://x/b.jpg' },
  { id: 'c3', nome: 'Monster Khaos', sku: 'MK-3', lingua: 'GBR', valore: '5', stato: 'OK', p1: 'https://x/c.jpg' },
];

// admin=true → boot cookie-refresh succeeds → admin UI (the value calculator
// and the rest of the toolbar are admin-only, see applyAuthUI in core.ts).
async function mockApi(page: Page, admin = false) {
  await page.route('**/api/auth/refresh', (route) =>
    admin
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ accessToken: 'fake' }),
        })
      : route.fulfill({ status: 401, body: '' }),
  );
  await page.route('**/api/cans**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANS) }),
  );
}

test('search box filters the grid by name', async ({ page }) => {
  await mockApi(page, false);
  await page.goto('/');
  await page.getByRole('button', { name: /enter the collection/i }).click();
  await expect(page.locator('#grid .card').first()).toBeVisible();

  await page.locator('#search-input').fill('ultra');
  await expect(page.locator('#grid .card')).toHaveCount(1);
  await page.locator('#search-input').fill('');
  await expect(page.locator('#grid .card')).toHaveCount(CANS.length);
});

test('value calculator opens and totals the collection (admin)', async ({ page }) => {
  await mockApi(page, true);
  await page.goto('/');
  await expect(page.locator('#btn-calc')).toBeVisible(); // admin-only toolbar
  await page.locator('#btn-calc').click();
  await expect(page.locator('#calc-panel')).toHaveClass(/open/);
  await expect(page.locator('#calc-summary')).toContainText('€12.00');
});
