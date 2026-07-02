// Colore del tappo/tab: se il primo colore è "forte" (in BG) il campo prende uno
// sfondo colorato; altrimenti le parti dopo lo slash sono colorate nel testo.
// Porting dal vecchio core.ts (topBg + colorizeTop).

const BG: Record<string, string> = {
  black: '#111',
  nero: '#111',
  white: '#eee',
  bianco: '#eee',
  gold: '#caa62e',
  oro: '#caa62e',
  orange: '#e67e00',
  arancione: '#e67e00',
  arancio: '#e67e00',
  green: '#1f8f3a',
  verde: '#1f8f3a',
  lime: '#7bbf00',
  red: '#c0392b',
  rosso: '#c0392b',
  maroon: '#7d2b3e',
  blue: '#1f6fd6',
  blu: '#1f6fd6',
  navy: '#2a3f8f',
  teal: '#0f8a7e',
  cyan: '#0e9bb5',
  'light blue': '#2a96d6',
  lightblue: '#2a96d6',
  azzurro: '#2a96d6',
  celeste: '#2a96d6',
  azure: '#2a96d6',
  'sky blue': '#2a96d6',
  skyblue: '#2a96d6',
  yellow: '#d4b500',
  giallo: '#d4b500',
  purple: '#6c3fb5',
  viola: '#6c3fb5',
  magenta: '#b13fc4',
  pink: '#cf5a93',
  rosa: '#cf5a93',
  brown: '#7a4a1e',
  marrone: '#7a4a1e',
  copper: '#8a5320',
  rame: '#8a5320',
  bronze: '#8a6224',
  bronzo: '#8a6224',
  cream: '#d9cba8',
};

const TEXT_COLOR: Record<string, string> = {
  black: '#000',
  nero: '#000',
  white: '#fff',
  bianco: '#fff',
  silver: '#c0c0c0',
  argento: '#c0c0c0',
  grey: '#9e9e9e',
  gray: '#9e9e9e',
  grigio: '#9e9e9e',
  gold: '#ffd700',
  oro: '#ffd700',
  orange: '#ff8c00',
  arancione: '#ff8c00',
  arancio: '#ff8c00',
  green: '#2ecc40',
  verde: '#2ecc40',
  lime: '#a8ff00',
  red: '#ff4136',
  rosso: '#ff4136',
  maroon: '#c0506e',
  blue: '#4da3ff',
  blu: '#4da3ff',
  navy: '#5b7bd5',
  teal: '#14b8a6',
  cyan: '#22d3ee',
  'light blue': '#7cc7ff',
  lightblue: '#7cc7ff',
  azzurro: '#7cc7ff',
  celeste: '#7cc7ff',
  azure: '#7cc7ff',
  'sky blue': '#7cc7ff',
  skyblue: '#7cc7ff',
  yellow: '#ffdc00',
  giallo: '#ffdc00',
  purple: '#b07cff',
  viola: '#b07cff',
  magenta: '#e879f9',
  pink: '#ff7eb6',
  rosa: '#ff7eb6',
  brown: '#b5651d',
  marrone: '#b5651d',
  copper: '#b87333',
  rame: '#b87333',
  bronze: '#cd7f32',
  bronzo: '#cd7f32',
  cream: '#f1e9d2',
};

const LIGHT = new Set(['white', 'bianco', 'yellow', 'giallo', 'cream', 'lime', 'gold', 'oro']);

export interface TabPart {
  text: string;
  color?: string;
}

export interface TabDisplay {
  style?: { background: string; color: string };
  parts: TabPart[];
}

export function colorizeTab(tab?: string | null): TabDisplay {
  if (!tab) return { parts: [] };
  const raw = String(tab);
  const first = (raw.split('/')[0] ?? '').trim().toLowerCase();
  const bg = BG[first];
  if (bg) {
    return {
      style: { background: bg, color: LIGHT.has(first) ? '#111' : '#fff' },
      parts: [{ text: raw }],
    };
  }
  return {
    parts: raw
      .split('/')
      .map((s, i) =>
        i === 0 ? { text: s } : { text: s, color: TEXT_COLOR[s.trim().toLowerCase()] },
      ),
  };
}
