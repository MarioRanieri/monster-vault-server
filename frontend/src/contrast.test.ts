/// <reference types="node" />
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/main.css', 'utf8');

// WCAG AA per i colori "neon" di badge/chip. Sonar (css:S7924) ignora l'alpha e
// segnala falsi positivi; qui il contrasto VERO: ogni rgba viene composto sullo
// sfondo reale del tema. Il CSS è letto da main.css, quindi il test cade
// se qualcuno riporta un colore sotto soglia.

type Theme = 'dark' | 'light';
type RGBA = [number, number, number, number];

// Una regola per ogni selettore di una lista ("a, b { ... }").
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(
  (m) => m[1].split(',').map((sel) => ({ sel: sel.trim(), body: m[2] })),
);

function prop(sel: string, name: string, theme: Theme): string | undefined {
  const find = (s: string) => {
    const decls = rules.find((r) => r.sel === s)?.body;
    return decls?.match(new RegExp(String.raw`(?:^|[;\s])${name}\s*:\s*([^;]+)`))?.[1].trim();
  };
  return (theme === 'light' ? find(`body.light ${sel}`) : undefined) ?? find(sel);
}

function resolveVars(v: string, theme: Theme): string {
  const body = (sel: string) => rules.find((r) => r.sel === sel)?.body ?? '';
  return v.replace(/var\((--[\w-]+)\)/g, (_, n: string) => {
    const pick = (b: string) => b.match(new RegExp(String.raw`${n}\s*:\s*([^;]+)`))?.[1].trim();
    const val = (theme === 'light' ? pick(body('body.light')) : undefined) ?? pick(body(':root'));
    return resolveVars(val ?? '', theme);
  });
}

function parse(v: string, theme: Theme): RGBA {
  const s = resolveVars(v, theme);
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as RGBA;
  }
  const fn = s.match(/^rgba?\(([^)]+)\)$/);
  if (!fn) throw new Error(`colore non supportato: ${s}`);
  const [r, g, b, a = 1] = fn[1].split(',').map(Number);
  return [r, g, b, a];
}

function over([r, g, b, a]: RGBA, under: RGBA): RGBA {
  return [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a), 1];
}

function luminance([r, g, b]: RGBA): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function ratio(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Colore di testo su una pila di sfondi (dal più esterno al più interno) sopra un
// token di superficie del tema (--bg2 = card/filter-bar/compare-bar).
function contrast(theme: Theme, fgSel: string, bgSels: string[], surface = '--bg2'): number {
  let bg = parse(`var(${surface})`, theme);
  for (const s of bgSels)
    bg = over(parse(prop(s, 'background', theme) ?? 'rgba(0,0,0,0)', theme), bg);
  // il .chip-count senza `color` proprio eredita quello del chip padre
  const fg = over(
    parse(
      (prop(fgSel, 'color', theme) ?? prop(fgSel.replace(/ \S+$/, ''), 'color', theme))!,
      theme,
    ),
    bg,
  );
  return ratio(fg, bg);
}

const chip = (name: string) => `.filter-chip-${name}.active`;
const cases: [string, string, string[]][] = [
  ['.badge-stato-ok', '.badge-stato-ok', ['.badge-stato-ok']],
  ['.badge-stato-bozze', '.badge-stato-bozze', ['.badge-stato-bozze']],
  ['.badge-stato-danneggiata', '.badge-stato-danneggiata', ['.badge-stato-danneggiata']],
  ['.badge-promo', '.badge-promo', ['.badge-promo']],
  ['.auth-required-msg', '.auth-required-msg', ['.auth-required-msg']],
  ['.compare-slot-remove:hover', '.compare-slot-remove:hover', ['.compare-slot-remove:hover']],
  ...['promo', 'withphoto', 'nophotos'].flatMap((n): [string, string, string[]][] => [
    [chip(n), chip(n), [chip(n)]],
    [`${chip(n)} .chip-count`, `${chip(n)} .chip-count`, [chip(n), `${chip(n)} .chip-count`]],
  ]),
  ['.filter-reset-btn.active', '.filter-reset-btn.active', ['.filter-reset-btn.active']],
  [
    '.filter-reset-btn.active .chip-count',
    '.filter-reset-btn.active .chip-count',
    ['.filter-reset-btn.active', '.filter-reset-btn.active .chip-count'],
  ],
];

describe('WCAG AA contrast (4.5:1) su badge, chip e messaggi', () => {
  for (const theme of ['dark', 'light'] as const) {
    it.each(cases)(`${theme}: %s`, (_name, fg, bgs) => {
      expect(contrast(theme, fg, bgs)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
