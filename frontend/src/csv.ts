import type { Can } from './types';

// Colonne del CSV (etichetta ↔ campo), come l'export del vecchio.
const COLUMNS: {
  h: string;
  get: (c: Can) => string;
  set: (c: Can, v: string) => void;
}[] = [
  { h: 'MV_ID', get: (c) => c.id, set: (c, v) => (c.id = v) },
  { h: 'NOME', get: (c) => c.nome ?? '', set: (c, v) => (c.nome = v) },
  { h: 'SKU', get: (c) => c.sku ?? '', set: (c, v) => (c.sku = v) },
  { h: 'PRODUTTORE', get: (c) => c.produttore ?? '', set: (c, v) => (c.produttore = v) },
  { h: 'SIZE', get: (c) => c.size ?? '', set: (c, v) => (c.size = v) },
  { h: 'LINGUA', get: (c) => c.lingua ?? '', set: (c, v) => (c.lingua = v) },
  { h: 'TOP/TAB', get: (c) => c.top ?? '', set: (c, v) => (c.top = v) },
  { h: 'PROMO', get: (c) => c.promo ?? '', set: (c, v) => (c.promo = v) },
  { h: 'VALORE', get: (c) => c.valore ?? '', set: (c, v) => (c.valore = v) },
  { h: 'OPENING', get: (c) => c.note ?? '', set: (c, v) => (c.note = v) },
  { h: 'CONDITIONS', get: (c) => c.stato ?? '', set: (c, v) => (c.stato = v) },
  { h: 'MORE INFO', get: (c) => c.descrizione ?? '', set: (c, v) => (c.descrizione = v) },
];

const escapeCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// Serializza le lattine in CSV (con intestazione).
export function buildCsv(cans: Can[]): string {
  const head = COLUMNS.map((col) => col.h).join(',');
  const rows = cans.map((c) => COLUMNS.map((col) => escapeCell(col.get(c))).join(','));
  return [head, ...rows].join('\n');
}

// Tokenizer CSV che gestisce virgolette, virgole e newline dentro i campi.
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Ricostruisce le lattine da un CSV (con intestazione). Righe senza id → id nuovo.
export function parseCsv(text: string): Can[] {
  const rows = parseRows(text);
  if (rows.length < 2) return [];
  const header = rows[0];
  const cols = COLUMNS.map((col) => ({ col, i: header.indexOf(col.h) }));
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => {
      const can = { id: '', nome: '' } as Can;
      for (const { col, i } of cols) {
        if (i >= 0 && r[i] != null && r[i] !== '') col.set(can, r[i]);
      }
      if (!can.id) can.id = crypto.randomUUID();
      return can;
    });
}
