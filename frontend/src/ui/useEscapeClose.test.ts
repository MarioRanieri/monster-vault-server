import { renderHook, fireEvent } from '@testing-library/react';
import { useEscapeClose } from './useEscapeClose';

const esc = () => fireEvent.keyDown(window, { key: 'Escape' });

test('single overlay closes on Escape', () => {
  const onClose = vi.fn();
  const { unmount } = renderHook(() => useEscapeClose(onClose));
  esc();
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();
});

test('two stacked: only the top one closes, then Esc closes the lower one', () => {
  const onCloseBottom = vi.fn();
  const onCloseTop = vi.fn();
  const bottom = renderHook(() => useEscapeClose(onCloseBottom));
  const top = renderHook(() => useEscapeClose(onCloseTop));

  esc();
  expect(onCloseTop).toHaveBeenCalledTimes(1);
  expect(onCloseBottom).not.toHaveBeenCalled();

  top.unmount();
  esc();
  expect(onCloseBottom).toHaveBeenCalledTimes(1);

  bottom.unmount();
});

test('a disabled top overlay lets the next enabled one down handle Escape', () => {
  const onCloseBottom = vi.fn();
  const onCloseTop = vi.fn();
  const bottom = renderHook(() => useEscapeClose(onCloseBottom));
  const top = renderHook(() => useEscapeClose(onCloseTop, false));

  esc();
  expect(onCloseBottom).toHaveBeenCalledTimes(1);
  expect(onCloseTop).not.toHaveBeenCalled();

  top.unmount();
  bottom.unmount();
});

test('enabled=false is skipped entirely (no lower handler to fall back to)', () => {
  const onClose = vi.fn();
  const { unmount } = renderHook(() => useEscapeClose(onClose, false));
  esc();
  expect(onClose).not.toHaveBeenCalled();
  unmount();
});

test('non-Escape keys are ignored', () => {
  const onClose = vi.fn();
  const { unmount } = renderHook(() => useEscapeClose(onClose));
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(onClose).not.toHaveBeenCalled();
  unmount();
});

test('focus is restored to the previously focused element on unmount', () => {
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();
  expect(document.activeElement).toBe(trigger);

  const { unmount } = renderHook(() => useEscapeClose(() => {}));

  const other = document.createElement('button');
  document.body.appendChild(other);
  other.focus();
  expect(document.activeElement).toBe(other);

  unmount();
  expect(document.activeElement).toBe(trigger);

  trigger.remove();
  other.remove();
});

test('focus restore is skipped if the previously focused element left the document', () => {
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();

  const { unmount } = renderHook(() => useEscapeClose(() => {}));
  trigger.remove();

  expect(() => unmount()).not.toThrow();
});

test('con un overlay aperto la pagina dietro non scorre; alla chiusura torna dov’era', () => {
  window.scrollTo = vi.fn();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 640 });
  const bottom = renderHook(() => useEscapeClose(() => {}));
  expect(document.body.style.position).toBe('fixed');
  expect(document.body.style.top).toBe('-640px');

  // un secondo overlay sopra (es. il crop dentro il form) non rompe il blocco
  const top = renderHook(() => useEscapeClose(() => {}));
  top.unmount();
  expect(document.body.style.position).toBe('fixed');

  bottom.unmount();
  expect(document.body.style.position).toBe('');
  expect(document.body.style.top).toBe('');
  expect(window.scrollTo).toHaveBeenCalledWith(0, 640);
});
