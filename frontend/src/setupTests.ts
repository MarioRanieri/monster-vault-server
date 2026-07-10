import '@testing-library/jest-dom';

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
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}
