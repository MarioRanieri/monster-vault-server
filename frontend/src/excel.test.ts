import { buildXlsx, parseXlsx } from './excel';
import * as XLSX from 'xlsx';
import type { Can } from './types';

test('roundtrip: buildXlsx → parseXlsx conserva i campi', async () => {
  const cans: Can[] = [
    {
      id: 'can_1',
      nome: 'Monster Original',
      sku: '0610',
      produttore: 'Monster',
      size: '500ML',
      lingua: 'USA',
      top: 'Gold',
      promo: 'Yes',
      valore: '25',
      note: 'FULL',
      stato: 'OK',
      descrizione: 'First run',
    },
  ];

  const parsed = await parseXlsx(await buildXlsx(cans));

  expect(parsed).toHaveLength(1);
  expect(parsed[0]).toMatchObject({ ...cans[0] });
});

test('parseXlsx legge i backup vecchi (header VALORE (STIMA), TOP, ID)', async () => {
  // foglio come lo esportava la vecchia app / fogli storici con alias
  const rows = [
    ['ID', 'NOME', 'TOP', 'VALORE (STIMA)', 'CONDITIONS'],
    ['can_9', 'Assault', 'Camo', '40', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = await parseXlsx(buf);

  expect(parsed).toHaveLength(1);
  expect(parsed[0]).toMatchObject({
    id: 'can_9',
    nome: 'Assault',
    top: 'Camo',
    valore: '40',
    stato: 'OK', // default del vecchio quando CONDITIONS è vuota
  });
});

test('parseXlsx trova la riga header anche se preceduta da righe di titolo', async () => {
  const rows = [
    ['Il mio foglio', '', ''],
    ['NOME', 'SKU', 'LINGUA'],
    ['Ripper', '0311', 'Japan'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'S');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = await parseXlsx(buf);

  expect(parsed).toHaveLength(1);
  expect(parsed[0]).toMatchObject({ nome: 'Ripper', sku: '0311', lingua: 'Japan' });
  expect(parsed[0].id).toBeTruthy(); // senza MV_ID → id generato
});
