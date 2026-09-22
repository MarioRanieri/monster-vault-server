import type { Can } from '../app/types';

export interface MoreInfoSuggestion {
  text: string;
  count: number; // quante lattine simili usano questo testo
}

const norm = (s?: string) => (s ?? '').trim().toUpperCase();
const words = (nome?: string) =>
  new Set(
    norm(nome)
      .replace(/[^A-Z0-9\- ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
const countShared = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;

// Classifica i testi "More Info" delle lattine simili alla bozza (anche non ancora
// salvata): +2 stessa nazione, +1 per parola del nome in comune; conta una lattina
// se ottiene almeno 3 (senza nazione: 3 parole). I More Info di un set sono per
// nazione + parole di variante ("SMALL LOGO" → "Small logo 0920 design"): sui dati
// reali il testo giusto è fra i primi 3 nell'82% dei casi. Se nessuna lattina
// arriva a 3, ripiega sui testi della stessa nazione ("Set Ecuador").
export function suggestMoreInfo(
  cans: Can[],
  draft: Pick<Can, 'nome' | 'lingua'> & { id?: string },
  limit = 3,
): MoreInfoSuggestion[] {
  const country = norm(draft.lingua);
  const draftWords = words(draft.nome);
  const scored = new Map<string, { score: number; count: number }>();
  const byCountry = new Map<string, { score: number; count: number }>();
  const add = (m: typeof scored, text: string, score: number) => {
    const e = m.get(text) ?? { score: 0, count: 0 };
    m.set(text, { score: e.score + score, count: e.count + 1 });
  };

  for (const c of cans) {
    const text = c.descrizione?.trim();
    if (!text || c.id === draft.id) continue;
    const sameCountry = country !== '' && norm(c.lingua) === country;
    const score = (sameCountry ? 2 : 0) + countShared(words(c.nome), draftWords);
    if (score >= 3) add(scored, text, score);
    if (sameCountry) add(byCountry, text, 1);
  }

  const pool = scored.size > 0 ? scored : byCountry;
  return [...pool]
    .sort(([, a], [, b]) => b.score - a.score || b.count - a.count)
    .slice(0, limit)
    .map(([text, { count }]) => ({ text, count }));
}
