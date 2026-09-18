import { test, expect, type Page } from '@playwright/test';

// Bersagli di tocco su mobile: jsdom non calcola il layout CSS, quindi le misure
// vere si fanno qui con un browser reale (API finta, come negli altri e2e).
const CANS = [
  {
    id: 'c1',
    nome: 'Monster Original',
    sku: 'MO-1',
    lingua: 'USA',
    valore: '3',
    stato: 'OK',
    p1: 'https://x/a.jpg',
  },
  {
    id: 'c2',
    nome: 'Monster Ultra',
    sku: 'MU-2',
    lingua: 'ITALY',
    valore: '4',
    stato: 'OK',
    p1: 'https://x/b.jpg',
  },
];

const MIN = 44;

// [nome leggibile, selettore, controllo anche la larghezza?]
// La larghezza conta solo per i controlli quadrati/icona; testo e campi si allargano da soli.
const TARGETS: [string, string, boolean][] = [
  ['view toggle', '.view-btn', true],
  ['sort select', '.view-sort-bar .filter-select', false],
  ['header ⋯ menu', '.header-more-btn', true],
  ['search input', '.search-wrap input', false],
  ['card Details', '.card-overlay-btn.view', false],
  ['logo', '.logo', true],
  // Già sistemati in #46: restano nel test come guardia anti-regressione.
  ['filter chip', '.filter-chip', false],
  ['share view', '.share-view-btn', false],
  ['filters toggle', '.filter-toggle', false],
];

async function openCollection(page: Page) {
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401, body: '' }));
  await page.route('**/api/cans**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANS) }),
  );
  await page.route('https://x/**', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /enter the collection/i }).click();
  // I chip e le select dei filtri stanno nel pannello "Filters", chiuso di default.
  await page.locator('.filter-toggle').click();
}

test.describe('mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [name, selector, checkWidth] of TARGETS) {
    test(`${name} è un bersaglio di tocco >= ${MIN}px`, async ({ page }) => {
      await openCollection(page);
      const box = await page.locator(selector).first().boundingBox();
      expect(box, `${selector} non trovato`).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(MIN);
      if (checkWidth) expect(box!.width).toBeGreaterThanOrEqual(MIN);
    });
  }

  test('nessuno scroll orizzontale', async ({ page }) => {
    await openCollection(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('desktop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('le regole mobile non trapelano: il view toggle resta compatto', async ({ page }) => {
    await openCollection(page);
    const box = await page.locator('.view-btn').first().boundingBox();
    expect(box!.height).toBeLessThan(MIN);
  });
});
