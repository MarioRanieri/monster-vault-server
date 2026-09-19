import { test, expect, type Page } from '@playwright/test';

// "Latest additions" sulla landing (vedi LandingPage.tsx): jsdom non calcola il
// layout CSS né eredita le custom property della cascata, quindi due classi di bug
// si vedono solo qui, con un browser vero.
// 8 cans (il limit di "Latest additions"): serve un mock grande abbastanza da
// far crescere .land-inner oltre l'altezza del viewport, altrimenti il bug di
// centraggio (vedi sotto) non si manifesta affatto.
const CANS = Array.from({ length: 8 }, (_, i) => ({
  id: `c${i}`,
  nome: `Monster ${i}`,
  sku: `MO-${i}`,
  lingua: 'USA',
  valore: '3',
  stato: 'OK',
  p1: 'https://x/a.jpg',
  photoAt: Date.now(),
}));

async function openLanding(page: Page) {
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401, body: '' }));
  await page.route('**/api/cans**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANS) }),
  );
  await page.route('https://x/**', (route) => route.abort());
  await page.goto('/');
  // Aspetta che i cans siano caricati e la sezione monti, altrimenti i test
  // sotto misurerebbero il layout di "…" (stato loading).
  await page.getByText('Latest additions').waitFor();
}

test.describe('landing mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Regressione: #landing-overlay centrava .land-inner con align-items/
  // justify-content su un flex container con overflow-y:auto. Con la sezione
  // "Latest additions", .land-inner diventa più alto del viewport e il
  // centraggio spingeva il top (claw/wordmark/tagline/stats) SOPRA lo scroll
  // origin, irraggiungibile: la pagina si apriva già sul badge "added this
  // month". margin:auto su .land-inner deve tenere il wordmark raggiungibile
  // a scrollTop 0.
  test(".land-wordmark è dentro l'area raggiungibile a scrollTop 0", async ({ page }) => {
    await openLanding(page);
    const scrollTop = await page.locator('#landing-overlay').evaluate((el) => el.scrollTop);
    expect(scrollTop).toBe(0);
    const box = await page.locator('.land-wordmark').boundingBox();
    expect(box, '.land-wordmark non trovato').not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
  });

  // Su mobile il claw (26vh ≈ 220px) prendeva mezzo schermo e spingeva
  // "Latest additions" sotto la piega: sotto i 640px resta al massimo 160px.
  test('il claw non supera 160px di altezza', async ({ page }) => {
    await openLanding(page);
    const box = await page.locator('.land-claw').boundingBox();
    expect(box, '.land-claw non trovato').not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(160);
  });
});

test.describe('landing: palette', () => {
  // Il jpg del claw ha un fondo quasi nero ma non nero: con mix-blend-mode
  // screen restava visibile il quadrato. La maschera radiale ne sfuma i bordi.
  test('il claw ha una maschera che sfuma i bordi', async ({ page }) => {
    await openLanding(page);
    const mask = await page.locator('.land-claw').evaluate((el) => {
      const s = getComputedStyle(el);
      return s.maskImage || s.getPropertyValue('-webkit-mask-image');
    });
    expect(mask).toContain('radial-gradient');
  });

  // La barra sotto la tagline era un arcobaleno fuori palette: ora solo lime.
  test('la barra sotto la tagline usa solo il lime', async ({ page }) => {
    await openLanding(page);
    const bg = await page
      .locator('.land-bar')
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('rgb(168, 255, 0)');
    expect(bg).not.toContain('rgb(155, 109, 255)');
  });
});

test.describe('landing: tema sempre dark', () => {
  // Regressione: la card di "Latest additions" riusa .card (CanGrid), che
  // legge --bg2/--text2/... da body.light quando l'utente aveva acceso il
  // tema chiaro nella collection e torna alla landing (logo/sign-out). La
  // landing non ha mai avuto un tema chiaro: deve restare scura comunque.
  test('una card resta scura anche con body.light attivo', async ({ page }) => {
    await openLanding(page);
    await page.evaluate(() => document.body.classList.add('light'));
    const bg = await page
      .locator('.land-latest .card')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(17, 17, 17)'); // --bg2 scuro (#111111), non #ffffff di body.light
  });
});
