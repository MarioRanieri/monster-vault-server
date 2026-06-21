import { test, expect, type Page } from '@playwright/test';

// Guards against horizontal scroll on the landing — the class of bug where a
// wide child (wordmark/eyebrow) or overflow-y:auto (which makes overflow-x
// compute to auto) produces a side scrollbar on phones.

async function mockApi(page: Page) {
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401, body: '' }));
  await page.route('**/api/cans**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

// Common phone widths: iPhone SE, typical Android, iPhone 12/13/14.
const VIEWPORTS = [
  { name: 'iPhone SE (320)', width: 320, height: 568 },
  { name: 'Android (360)', width: 360, height: 740 },
  { name: 'iPhone 12 (390)', width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test(`landing has no horizontal overflow @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockApi(page);
    await page.goto('/');
    await expect(page.locator('#landing-overlay')).toBeVisible();

    // Neither the page nor the landing overlay (its own scroll container) may
    // be horizontally scrollable. +1 tolerance for sub-pixel rounding.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const ov = document.getElementById('landing-overlay')!;
      return {
        page: doc.scrollWidth - doc.clientWidth,
        overlay: ov.scrollWidth - ov.clientWidth,
      };
    });
    expect(overflow.page, `page x-overflow @ ${vp.name}`).toBeLessThanOrEqual(1);
    expect(overflow.overlay, `overlay x-overflow @ ${vp.name}`).toBeLessThanOrEqual(1);
  });
}
