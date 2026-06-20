import { test, expect, type Page } from '@playwright/test';

// Minimal cans for rendering — p1 set so they aren't hidden by a photo filter.
const CANS = [
  { id: 'c1', nome: 'Monster Original', sku: 'MO-1', lingua: 'USA', valore: '3', stato: 'OK', p1: 'https://x/a.jpg' },
  { id: 'c2', nome: 'Monster Ultra', sku: 'MU-2', lingua: 'ITALY', valore: '4', stato: 'OK', p1: 'https://x/b.jpg' },
  { id: 'c3', nome: 'Monster Khaos', sku: 'MK-3', lingua: 'GBR', valore: '5', stato: 'OK', p1: 'https://x/c.jpg' },
];

/** Mock the API. admin=true makes the boot cookie-refresh succeed → admin UI. */
async function mockApi(page: Page, admin = false) {
  await page.route('**/api/auth/refresh', (route) =>
    admin
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'fake' }) })
      : route.fulfill({ status: 401, body: '' }),
  );
  await page.route('**/api/cans**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANS) }),
  );
}

/** Fail the test on any uncaught JS exception — this is what catches the
 *  "missing window bridge" white-screen class of bug. */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('guest: page loads, grid renders cans, no JS errors', async ({ page }) => {
  const errors = trackPageErrors(page);
  await mockApi(page, false);
  await page.goto('/');
  await page.getByRole('button', { name: /guest access/i }).click();
  await expect(page.locator('#grid .card').first()).toBeVisible();
  await expect(page.locator('#grid .card')).toHaveCount(CANS.length);
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('guest: clicking a card opens the detail panel', async ({ page }) => {
  await mockApi(page, false);
  await page.goto('/');
  await page.getByRole('button', { name: /guest access/i }).click();
  await page.locator('#grid .card').first().click();
  await expect(page.locator('#detail-panel')).toHaveClass(/open/);
});

test('admin: cookie refresh recovers session, Add opens the edit modal', async ({ page }) => {
  const errors = trackPageErrors(page);
  await mockApi(page, true);
  await page.goto('/');
  await expect(page.locator('#btn-add')).toBeVisible(); // admin-only button
  await page.locator('#btn-add').click();
  await expect(page.locator('#edit-modal')).toHaveClass(/open/);
  expect(errors, errors.join('\n')).toHaveLength(0);
});

test('vault → map → back: grid still renders (no infinite loading)', async ({ page }) => {
  const errors = trackPageErrors(page);
  await mockApi(page, false);
  await page.goto('/');
  await page.getByRole('button', { name: /guest access/i }).click();
  await expect(page.locator('#grid .card').first()).toBeVisible();
  // real user flow: Map button → "← Vault" link (not browser-back/bfcache)
  await page.locator('#btn-map').click();
  await expect(page).toHaveTitle(/map/i);
  await page.locator('a.back').click();
  // returning to the vault re-boots index; sessionStorage auto-continues as guest
  await expect(page.locator('#grid .card').first()).toBeVisible();
  expect(errors, errors.join('\n')).toHaveLength(0);
});
