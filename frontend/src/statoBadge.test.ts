import { statoBadgeClass } from './statoBadge';

test.each([
  ['OK', 'badge-stato-ok'],
  ['ok', 'badge-stato-ok'],
  ['Minor Dents', 'badge-stato-bozze'],
  ['MINOR DENTS', 'badge-stato-bozze'],
  ['Piccole bozze', 'badge-stato-bozze'],
  ['Damaged', 'badge-stato-danneggiata'],
  ['DANNEGGIATA', 'badge-stato-danneggiata'],
  ['Mint', 'badge-stato-ok'], // sconosciuto → default come il vecchio cardHTML
  [undefined, 'badge-stato-ok'],
])('statoBadgeClass(%s) → %s', (stato, cls) => {
  expect(statoBadgeClass(stato)).toBe(cls);
});
