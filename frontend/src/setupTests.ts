import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Default (1000ms) troppo stretto: sotto Node 22 (CI) le query async
// (findBy*, waitFor) sono misurabilmente più lente che sotto Node 24 (locale) —
// osservato con timeout intermittenti su test diversi a ogni run in CI.
configure({ asyncUtilTimeout: 5000 });

// jsdom non implementa gli object URL: stub minimo per i componenti che li usano
// (es. l'editor di crop delle foto).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

// jsdom non implementa IntersectionObserver: mock no-op così i sentinel (render
// incrementale della griglia, hero sticky) creano l'observer senza errori.
if (globalThis.IntersectionObserver === undefined) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}
