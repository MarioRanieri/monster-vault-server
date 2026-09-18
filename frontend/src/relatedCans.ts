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
 * "OG Nico Hischier" vs "OG" normale).
 *
 * Dentro quel filtro, prova in ordine — le linee sono principalmente per
 * nazione, quindi la nazione si rilassa solo per ultima, dopo aver già
 * provato entrambe le larghezze di nome:
 *   1. nome a 2 parole + stessa nazione   (es. "HYDRO MEAN" + USA)
 *   2. nome a 1 parola  + stessa nazione   (es. "OG" + SWISS)
 *   3. nome a 2 parole, qualsiasi nazione
 *   4. nome a 1 parola,  qualsiasi nazione (rete di sicurezza finale)
 * Il primo tentativo che raggiunge `minGroupSize` lattine vince; se
 * nessuno lo raggiunge si usa comunque l'ultimo (il più ampio), così la
 * sezione non resta mai vuota per un pezzo davvero raro. Calcolato sui
 * dati reali ogni volta, nessuna lista scritta a mano — verificato sulla
 * collezione live: "HYDRO MEAN GREEN" USA isolato a 5 lattine (2 parole +
 * nazione), "OG NICO HISCHIER" (promo, SWISS) a 10 (1 parola + nazione,
 * niente bisogno di allargare oltre).
 */
export function sameLineupPool(cans: Can[], can: Can, minGroupSize = 4): Can[] {
  const isPromo = hasPromo(can.promo);
  const sameStatus = cans.filter((c) => c.id !== can.id && hasPromo(c.promo) === isPromo);

  const sameNazione = (c: Can) => Boolean(can.lingua) && c.lingua === can.lingua;
  const key2 = lineupKey(can.nome, 2);
  const key1 = lineupKey(can.nome, 1);
  const attempts: ((c: Can) => boolean)[] = [
    (c) => sameNazione(c) && lineupKey(c.nome, 2) === key2,
    (c) => sameNazione(c) && lineupKey(c.nome, 1) === key1,
    (c) => lineupKey(c.nome, 2) === key2,
    (c) => lineupKey(c.nome, 1) === key1,
  ];

  for (const attempt of attempts) {
    const matches = sameStatus.filter(attempt);
    if (matches.length >= minGroupSize) return matches;
  }
  const last = attempts.at(-1)!;
  return sameStatus.filter((c) => last(c));
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

/** Un blocco di card correlate con un'etichetta opzionale (null = nessun
 *  sottotitolo, si mostrano subito sotto il titolo principale della sezione). */
export interface RelatedGroup {
  label: string | null;
  cans: Can[];
}

/**
 * Lattine "della stessa linea" di `can`, in blocchi. Per una lattina normale
 * è un solo blocco (nazione-first, vedi sameLineupPool). Per una promo il
 * concetto di "linea" è diverso: una promo è definita dalla campagna/oggetto
 * (es. "OG Hardik Pandya"), non dal mercato locale, quindi ha priorità sulla
 * nazione — tre fasce concatenate, ognuna riempie quel che ha (mai scartata
 * per essere "troppo piccola" come nel cascade nazione-first):
 *   A. stesso identico item (2 parole), qualsiasi nazione — es. la versione
 *      Trinidad di "OG Hardik Pandya" guardando quella indiana.
 *   B. qualsiasi altra promo della stessa nazione — se A non basta.
 *   C. qualsiasi altra promo rara, da ovunque — riempimento finale.
 * Verificato sui dati reali: "OG Nico Hischier" (unica al mondo) → fascia A
 * vuota, fascia B con le altre promo svizzere; "OG Hardik Pandya" → fascia A
 * con la sola versione Trinidad.
 */
export function sameLineupGroups(cans: Can[], can: Can, limit = 8): RelatedGroup[] {
  const isPromo = hasPromo(can.promo);
  if (!isPromo) {
    const pool = rankByRelevance(sameLineupPool(cans, can), can).slice(0, limit);
    return pool.length > 0 ? [{ label: null, cans: pool }] : [];
  }

  const sameStatus = cans.filter((c) => c.id !== can.id && hasPromo(c.promo) === isPromo);
  const used = new Set<string>();
  const groups: RelatedGroup[] = [];
  let remaining = limit;

  const takeGroup = (label: string | null, candidates: Can[]) => {
    if (remaining <= 0 || candidates.length === 0) return;
    const picked = rankByRelevance(candidates, can).slice(0, remaining);
    picked.forEach((c) => used.add(c.id));
    groups.push({ label, cans: picked });
    remaining -= picked.length;
  };

  const key2 = lineupKey(can.nome, 2);
  takeGroup(
    null,
    sameStatus.filter((c) => !used.has(c.id) && lineupKey(c.nome, 2) === key2),
  );

  if (can.lingua) {
    takeGroup(
      `Other ${can.lingua} promos`,
      sameStatus.filter((c) => !used.has(c.id) && c.lingua === can.lingua),
    );
  }

  takeGroup(
    'Other rare promos',
    sameStatus.filter((c) => !used.has(c.id)),
  );

  return groups;
}
