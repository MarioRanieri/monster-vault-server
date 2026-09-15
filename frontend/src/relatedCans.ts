import type { Can } from './types';
import { hasPromo } from './filterCans';

/**
 * Le prime `wordCount` parole del nome, maiuscole: euristica per il
 * "lineup" di un prodotto — "ABSOLUTELY ZERO DARK BF1" e "ABSOLUTELY ZERO
 * BLUE TEXT 355" condividono "ABSOLUTELY ZERO" (stessa linea, varianti
 * diverse). wordCount=1 per allargare quando 2 parole isolano un gruppo
 * troppo piccolo — vedi sameLineupPool.
 */
export function lineupKey(nome: string, wordCount: 1 | 2 = 2): string {
  return nome.trim().toUpperCase().split(/\s+/).slice(0, wordCount).join(' ');
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    // Ordine di visualizzazione delle card correlate, nessuna decisione di
    // sicurezza: Math.random() non crittografico è adeguato qui, non serve
    // crypto.getRandomValues(). Falso positivo verificato (S2245). NOSONAR
    const j = Math.floor(Math.random() * (i + 1)); // NOSONAR
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

/**
 * Pool di lattine della stessa "linea" di `can`: promo e non-promo non si
 * mischiano mai (una lattina promo — crossover CoD, Halo, sponsor... — non
 * è la stessa linea di una lattina normale anche se il nome combacia, es.
 * "OG Nico Hischier" vs "OG" normale). Dentro quel filtro, prova il match
 * a 2 parole; se il gruppo risultante ha meno di `minGroupSize` lattine
 * (nomi molto specifici come "OG Nico Hischier" isolano gruppetti da 1-2),
 * allarga a 1 parola. Calcolato sui dati reali ogni volta, nessuna lista
 * scritta a mano — verificato sulla collezione live: "OG" si frammenta in
 * decine di varianti da 2 parole per lo più minuscole, "ULTRA"/"ABSOLUTELY
 * ZERO" no.
 */
export function sameLineupPool(cans: Can[], can: Can, minGroupSize = 4): Can[] {
  const isPromo = hasPromo(can.promo);
  const sameStatus = cans.filter((c) => c.id !== can.id && hasPromo(c.promo) === isPromo);

  const key2 = lineupKey(can.nome, 2);
  const matches2 = sameStatus.filter((c) => lineupKey(c.nome, 2) === key2);
  if (matches2.length >= minGroupSize) return matches2;

  const key1 = lineupKey(can.nome, 1);
  return sameStatus.filter((c) => lineupKey(c.nome, 1) === key1);
}

/**
 * Ordina `cans` per rilevanza rispetto a `can` — preferenza morbida, non un
 * filtro: nessuna lattina viene esclusa, solo riordinata. Priorità: stessa
 * nazione, poi stessa size, poi con foto; pareggio a caso.
 */
export function rankByRelevance(cans: Can[], can: Can): Can[] {
  const score = (c: Can): number =>
    (c.lingua && c.lingua === can.lingua ? 4 : 0) +
    (c.size && c.size === can.size ? 2 : 0) +
    (c.p1 ? 1 : 0);

  const byScore = new Map<number, Can[]>();
  for (const c of cans) {
    const s = score(c);
    const group = byScore.get(s);
    if (group) group.push(c);
    else byScore.set(s, [c]);
  }
  return [...byScore.keys()].sort((a, b) => b - a).flatMap((s) => shuffle(byScore.get(s)!));
}
