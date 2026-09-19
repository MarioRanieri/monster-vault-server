// Chiavi React stabili senza usare l'indice dell'array: testo + numero di
// occorrenza ("GOLD#0", "GOLD#1"). Servono per liste che non si riordinano ma
// possono avere elementi con lo stesso testo.
export function keyed<T>(
  items: readonly T[],
  textOf: (item: T) => string,
): { key: string; item: T }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const text = textOf(item);
    const n = seen.get(text) ?? 0;
    seen.set(text, n + 1);
    return { key: `${text}#${n}`, item };
  });
}
