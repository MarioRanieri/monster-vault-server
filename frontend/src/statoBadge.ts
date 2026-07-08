// Colore del badge condizione (le classi CSS vengono dal vecchio STATO_COLORS:
// verde OK, giallo bozze, rosso danneggiata).
const BY_STATO: Record<string, string> = {
  'minor dents': 'badge-stato-bozze',
  'piccole bozze': 'badge-stato-bozze',
  damaged: 'badge-stato-danneggiata',
  danneggiata: 'badge-stato-danneggiata',
};

export function statoBadgeClass(stato?: string): string {
  return BY_STATO[(stato ?? '').trim().toLowerCase()] ?? 'badge-stato-ok';
}
