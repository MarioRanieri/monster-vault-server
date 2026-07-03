import { parseFlags } from './flags';

test('mappa un nome di paese alla sua bandiera ISO + nome', () => {
  const t = parseFlags('ITALY');
  expect(t).toEqual([{ kind: 'flag', iso: 'IT', name: 'Italy' }]);
});

test('BENELUX si espande in Belgio/Olanda/Lussemburgo', () => {
  const flags = parseFlags('BENELUX').filter((x) => x.kind === 'flag');
  expect(flags.map((f) => (f as { iso: string }).iso)).toEqual(['BE', 'NL', 'LU']);
});

test('gestisce la freccia -> come separatore tra due bandiere', () => {
  const t = parseFlags('USA -> UK');
  expect(t.map((x) => x.kind)).toEqual(['flag', 'sep', 'flag']);
  expect(t.filter((x) => x.kind === 'sep')[0]).toMatchObject({ text: '→' });
});

test('un valore sconosciuto resta testo', () => {
  expect(parseFlags('Zzz')).toEqual([{ kind: 'text', text: 'Zzz' }]);
  expect(parseFlags('')).toEqual([]);
  expect(parseFlags(undefined)).toEqual([]);
});
