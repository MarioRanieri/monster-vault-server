import type { Can } from '../app/types';

const words = (nome?: string) =>
  new Set(
    (nome ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9- ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );

/**
 * Lattine già in collezione che somigliano alla bozza aperta nel form: +2 per
 * ogni parola del nome in comune, +1 se stesso paese, mezzo punto a chi ha una
 * foto (a parità, la più riconoscibile). Serve almeno una parola in comune, così
 * il solo paese non riempie la lista di lattine scollegate.
 *
 * Il nome si scrive a mano e le varianti sono tante (189 nomi ripetuti, "OG" da
 * solo 66 volte): vederne tre simili mentre si scrive aiuta a nominare la nuova
 * lattina come le sorelle.
 */
export function findSimilarCans(
  cans: Can[],
  draft: Pick<Can, 'nome' | 'lingua'> & { id?: string },
  limit = 3,
): Can[] {
  const draftWords = words(draft.nome);
  if (draftWords.size === 0) return [];
  const country = (draft.lingua ?? '').trim().toUpperCase();

  return cans
    .filter((c) => c.id !== draft.id)
    .map((can) => {
      let shared = 0;
      for (const w of words(can.nome)) if (draftWords.has(w)) shared++;
      const sameCountry = country !== '' && (can.lingua ?? '').trim().toUpperCase() === country;
      return { can, score: shared * 2 + (sameCountry ? 1 : 0) + (can.p1 ? 0.5 : 0), shared };
    })
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.can);
}
