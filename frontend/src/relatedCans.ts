import type { Can } from './types';

/**
 * Le prime due parole del nome, maiuscole: euristica per il "lineup" di un
 * prodotto — "ABSOLUTELY ZERO DARK BF1" e "ABSOLUTELY ZERO BLUE TEXT 355"
 * condividono "ABSOLUTELY ZERO" (stessa linea, varianti diverse).
 */
export function lineupKey(nome: string): string {
  return nome.trim().toUpperCase().split(/\s+/).slice(0, 2).join(' ');
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sceglie fino a `limit` lattine a caso da `cans`, preferendo quelle con
 * foto (p1): se ce ne sono almeno `limit` con foto, il risultato è tutto
 * con foto. Altrimenti completa con quelle senza, sempre a caso.
 */
export function pickRelated(cans: Can[], limit: number): Can[] {
  const withPhoto = shuffle(cans.filter((c) => c.p1));
  const withoutPhoto = shuffle(cans.filter((c) => !c.p1));
  return [...withPhoto, ...withoutPhoto].slice(0, limit);
}
