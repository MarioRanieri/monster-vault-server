import { registerSW } from './pwa';

afterEach(() => {
  vi.restoreAllMocks();
  // jsdom non ha serviceWorker di suo: rimuovi lo stub tra i test
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

test('senza supporto serviceWorker non fa nulla e non lancia', () => {
  expect(() => {
    registerSW();
    window.dispatchEvent(new Event('load'));
  }).not.toThrow();
});

test('registra /sw.js all’evento load', () => {
  const register = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register },
    configurable: true,
  });

  registerSW();
  expect(register).not.toHaveBeenCalled(); // solo dopo il load

  window.dispatchEvent(new Event('load'));
  expect(register).toHaveBeenCalledWith('/sw.js');
});
