import { colorizeTab } from './colorizeTab';

test('primo colore "forte" (gold) → sfondo colorato, testo scuro', () => {
  const r = colorizeTab('Gold');
  expect(r.style).toEqual({ background: '#caa62e', color: '#111' });
  expect(r.parts).toEqual([{ text: 'Gold' }]);
});

test('red → sfondo rosso, testo bianco', () => {
  expect(colorizeTab('Red').style).toEqual({
    background: '#c0392b',
    color: '#fff',
  });
});

test('primo colore senza sfondo (silver) → parti colorate nel testo', () => {
  const r = colorizeTab('SILVER/GOLD');
  expect(r.style).toBeUndefined();
  expect(r.parts[0]).toEqual({ text: 'SILVER' });
  expect(r.parts[1]).toEqual({ text: 'GOLD', color: '#ffd700' });
});

test('vuoto → nessuna parte', () => {
  expect(colorizeTab('').parts).toEqual([]);
});
