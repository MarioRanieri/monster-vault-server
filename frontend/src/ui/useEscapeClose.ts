import { useEffect, useRef } from 'react';

// Stack module-level dei gestori Escape montati: gli overlay annidati (es. il crop
// dentro l'editor, o la lightbox dentro il dettaglio) si registrano nell'ordine in
// cui montano; su Escape chiude solo il più recente ancora enabled, scendendo lo
// stack se quello in cima è disabilitato (mai i sottostanti finché lui c'è).
type Entry = { onClose: () => void; enabled: boolean };
const stack: Entry[] = [];

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].enabled) {
      stack[i].onClose();
      return;
    }
  }
}

// Pagina dietro bloccata finché c'è un overlay aperto: da telefono si scorreva la
// vista sotto il form/crop e a volte l'overlay si spostava. `overflow: hidden`
// non basta su iOS Safari: il body diventa fixed allo scroll corrente, e alla
// chiusura si torna esattamente lì.
let lockedY = 0;
function lockScroll() {
  lockedY = window.scrollY;
  Object.assign(document.body.style, { position: 'fixed', top: `-${lockedY}px`, width: '100%' });
}
function unlockScroll() {
  Object.assign(document.body.style, { position: '', top: '', width: '' });
  window.scrollTo(0, lockedY);
}

// Un solo listener globale (e un solo blocco dello scroll), vivo finché c'è
// almeno un overlay montato.
let listenerCount = 0;
function addListener() {
  if (listenerCount === 0) {
    globalThis.addEventListener('keydown', onKeyDown);
    lockScroll();
  }
  listenerCount++;
}
function removeListener() {
  listenerCount--;
  if (listenerCount === 0) {
    globalThis.removeEventListener('keydown', onKeyDown);
    unlockScroll();
  }
}

// Chiude l'overlay più in cima su Escape, blocca lo scroll della pagina dietro
// e ripristina il focus a chi l'aveva aperto quando si smonta (se è ancora nel
// documento; preventScroll: la posizione l'ha già ripristinata unlockScroll).
export function useEscapeClose(onClose: () => void, enabled = true) {
  const entry = useRef<Entry>({ onClose, enabled });
  entry.current.onClose = onClose;
  entry.current.enabled = enabled;

  useEffect(() => {
    const e = entry.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stack.push(e);
    addListener();
    return () => {
      const i = stack.indexOf(e);
      if (i !== -1) stack.splice(i, 1);
      removeListener();
      if (previouslyFocused && document.contains(previouslyFocused))
        previouslyFocused.focus({ preventScroll: true });
    };
  }, []);
}
