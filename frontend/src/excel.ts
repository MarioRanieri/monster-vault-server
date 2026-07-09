import type { Can } from './types';
import { COLUMNS } from './csv';

// Header alternativi visti nei fogli storici (dal vecchio parseExcel), mappati
// sull'etichetta canonica di COLUMNS.
const ALIASES: Record<string, string> = {
  ID: 'MV_ID',
  TOP: 'TOP/TAB',
  TAB: 'TOP/TAB',
  'VALORE (STIMA)': 'VALORE',
  VALUE: 'VALORE',
  NOTE: 'OPENING',
  INFO: 'OPENING',
  COLONNA1: 'OPENING',
  STATO: 'CONDITIONS',
  STATUS: 'CONDITIONS',
  COLONNA2: 'CONDITIONS',
  DESCRIZIONE: 'MORE INFO',
};

// Hash del vecchio core.ts: righe senza MV_ID ottengono un id deterministico,
// così re-importare lo stesso foglio aggiorna invece di duplicare.
function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

// SheetJS è caricato on demand (chunk separato): export/import sono azioni rare
// e il bundle principale non deve pagarne i ~400KB.

export async function buildXlsx(cans: Can[]): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');
  const rows = cans.map((c) => Object.fromEntries(COLUMNS.map((col) => [col.h, col.get(c)])));
  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map((c) => c.h) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Monster Vault');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export async function parseXlsx(buf: ArrayBuffer): Promise<Can[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

  // La riga header è quella che contiene "NOME" (cercata nelle prime 10, come
  // il vecchio: i fogli storici hanno righe di titolo prima).
  let hIdx = 0;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    if (raw[i].some((cell) => String(cell).toUpperCase().trim() === 'NOME')) {
      hIdx = i;
      break;
    }
  }
  const headers = (raw[hIdx] ?? []).map((h) => {
    const up = String(h).toUpperCase().trim();
    return ALIASES[up] ?? up;
  });
  const cols = COLUMNS.map((col) => ({ col, i: headers.indexOf(col.h) }));

  return raw
    .slice(hIdx + 1)
    .filter((r) => r.some((v) => String(v).trim() !== ''))
    .map((r) => {
      const can = { id: '', nome: '' } as Can;
      for (const { col, i } of cols) {
        const v = i >= 0 ? String(r[i] ?? '').trim() : '';
        if (v) col.set(can, v);
      }
      can.stato ??= 'OK'; // default del vecchio
      can.id ||= `can_${simpleHash(
        [can.nome, can.sku, can.produttore, can.lingua, can.size, can.top, can.promo]
          .map((v) => v ?? '')
          .join('||')
          .toLowerCase()
          .trim(),
      )}`;
      return can;
    });
}
