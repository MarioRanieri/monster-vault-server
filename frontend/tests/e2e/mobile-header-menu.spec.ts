import { test, expect, type Page } from '@playwright/test';

// Il menu ⋯ dell'header su mobile deve stare SOPRA la hero. Regressione: con
// `.header {position: static}` il suo z-index è ignorato e il backdrop-filter crea un
// livello a 0, quindi la hero (dopo nel DOM) copriva le voci e intercettava i click.
const CANS = Array.from({ length: 6 }, (_, i) => ({
  id: `c${i}`,
  nome: `Monster ${i}`,
  sku: `0${i}11`,
  lingua: 'USA',
  valore: '3',
  stato: 'OK',
}));

async function open(page: Page, admin: boolean) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/auth/refresh', (r) =>
    admin
      ? r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ accessToken: 'x' }),
        })
      : r.fulfill({ status: 401, body: '' }),
  );
  await page.route('**/api/cans**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANS) }),
  );
  await page.goto('/');
  if (admin) {
    await page.evaluate(() => localStorage.setItem('mv_auth', '1'));
    await page.reload();
  }
  const enter = page.getByRole('button', { name: /enter the collection/i });
  if (await enter.count()) await enter.click();
  await page.locator('.header-more-btn').click();
  await expect(page.locator('.header-more-menu.open')).toBeVisible();
}

// Per ogni voce del menu, il punto centrale deve cadere sulla voce stessa (o dentro di essa).
async function coveredItems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const items = document.querySelectorAll(
      '.header-more-menu.open button, .header-more-menu.open a',
    );
    return [...items]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !hit || !(el === hit || el.contains(hit));
      })
      .map((el) => (el.textContent ?? '').trim());
  });
}

for (const admin of [false, true]) {
  test(`menu ⋯ (${admin ? 'admin' : 'ospite'}): nessuna voce è coperta dalla hero`, async ({
    page,
  }) => {
    await open(page, admin);
    expect(await coveredItems(page)).toEqual([]);
  });
}

test('menu ⋯: un click su "Guide" apre davvero la guida', async ({ page }) => {
  await open(page, false);
  await page.locator('.header-more-menu.open').getByRole('button', { name: /guide/i }).click();
  await expect(page.getByRole('dialog', { name: 'Guide' })).toBeVisible();
});
