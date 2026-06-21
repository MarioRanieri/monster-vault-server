import { test, expect, type Page } from '@playwright/test';

// Guards the photo editor's touch-crop on mobile. Regression: the crop
// listeners (initPhotoEditorListeners) existed but were never wired at boot,
// so drag-to-crop was dead — exactly "edit photo da mobile non funziona".

// Real touch device: without this the DOM touch listeners never fire.
test.use({ hasTouch: true, isMobile: true });

async function mockApi(page: Page) {
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401, body: '' }));
  await page.route('**/api/cans**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

// A 200x200 red PNG as a data URL — same-origin, no CORS, loads instantly.
const RED_PNG =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="red"/></svg>',
  ).toString('base64');

test('mobile: touch-crop in the photo editor produces an edited file', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');

  // Open the editor on slot 1 with a loadable image (bypasses the file picker).
  await page.evaluate(
    (src) =>
      new Promise<void>((resolve) => {
        const w = window as any;
        w.state.pendingURLs = { 1: src };
        w.editPhoto(1);
        // editPhoto loads the image async, then opens the modal
        const t = setInterval(() => {
          if (document.getElementById('photoedit-modal')!.classList.contains('open')) {
            clearInterval(t);
            resolve();
          }
        }, 30);
      }),
    RED_PNG,
  );

  const canvas = page.locator('#pe-canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  expect(box.width).toBeGreaterThan(0);

  // Simulate a touch drag (crop selection) across the middle ~50% of the canvas
  // by dispatching real DOM TouchEvents — this exercises the actual listeners
  // wired by initPhotoEditorListeners.
  await page.evaluate(() => {
    const cv = document.getElementById('pe-canvas')!;
    const r = cv.getBoundingClientRect();
    const mk = (type: string, fx: number, fy: number) => {
      const t = new Touch({ identifier: 1, target: cv, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy });
      const list = type === 'touchend' ? [] : [t];
      return new TouchEvent(type, { cancelable: true, bubbles: true, touches: list, targetTouches: list, changedTouches: [t] });
    };
    cv.dispatchEvent(mk('touchstart', 0.25, 0.25));
    cv.dispatchEvent(mk('touchmove', 0.75, 0.75));
    cv.dispatchEvent(mk('touchend', 0.75, 0.75));
  });

  // Apply, then measure the result. peApply ALWAYS writes a File (full image if
  // no crop), so the real assertion is on DIMENSIONS: the touch drag selected
  // the middle ~50% of a 200px image, so a working crop yields width < 200.
  // Without the listeners wired, crop stays null -> output is the full 200px.
  await page.evaluate(() => (window as any).peApply());
  await expect(page.locator('#photoedit-modal')).not.toHaveClass(/open/);
  const editedWidth = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const f = (window as any).state.pendingFiles[1];
        if (!(f instanceof File)) return resolve(-1);
        const im = new Image();
        im.onload = () => resolve(im.naturalWidth);
        im.onerror = () => resolve(-2);
        im.src = URL.createObjectURL(f);
      }),
  );
  expect(editedWidth, 'touch-crop should produce a File').toBeGreaterThan(0);
  expect(editedWidth, 'cropped image must be smaller than the 200px original').toBeLessThan(190);
  expect(errors, errors.join('\n')).toHaveLength(0);
});
