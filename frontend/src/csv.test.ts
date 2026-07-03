import { buildCsv, parseCsv } from './csv';
import type { Can } from './types';

test('buildCsv scrive intestazione + righe, con escaping', () => {
  const cans: Can[] = [
    { id: '1', nome: 'Alpha', sku: 'S1', valore: '20' },
    { id: '2', nome: 'Beta, "special"', note: 'line1\nline2' },
  ];
  const csv = buildCsv(cans);
  const lines = csv.split('\n');
  expect(lines[0]).toContain('MV_ID,NOME,SKU');
  expect(csv).toContain('"Beta, ""special"""'); // virgola + virgolette escapate
  expect(csv).toContain('"line1\nline2"'); // newline dentro il campo
});

test('parseCsv è l’inverso di buildCsv (round-trip)', () => {
  const cans: Can[] = [
    { id: '1', nome: 'Alpha', sku: 'S1', produttore: 'ACME', valore: '20' },
    { id: '2', nome: 'Beta, "x"', note: 'a\nb', stato: 'ok' },
  ];
  const parsed = parseCsv(buildCsv(cans));
  expect(parsed).toHaveLength(2);
  expect(parsed[0]).toMatchObject({
    id: '1',
    nome: 'Alpha',
    sku: 'S1',
    produttore: 'ACME',
    valore: '20',
  });
  expect(parsed[1]).toMatchObject({ id: '2', nome: 'Beta, "x"', note: 'a\nb', stato: 'ok' });
});

test('parseCsv genera un id se manca e ignora le righe vuote', () => {
  const csv = 'MV_ID,NOME\n,SenzaId\n\n';
  const out = parseCsv(csv);
  expect(out).toHaveLength(1);
  expect(out[0].nome).toBe('SenzaId');
  expect(out[0].id).toBeTruthy();
});
