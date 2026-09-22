import { colorizeTab } from './colorizeTab';

test('primo colore "forte" (gold) → sfondo colorato, testo scuro', () => {
  const r = colorizeTab('Gold');
  expect(r.style).toEqual({ background: '#caa62e', color: '#111' });
  expect(r.parts).toEqual([{ text: 'Gold' }]);
});

test('sfondo del top E linguetta colorata: BLACK/PINK', () => {
  const r = colorizeTab('BLACK/PINK');
  expect(r.style).toEqual({ background: '#111', color: '#fff' });
  expect(r.parts).toEqual([{ text: 'BLACK' }, { text: 'PINK', color: '#ff7eb6' }]);
});

test('su sfondo chiaro la linguetta prende la versione scura del colore', () => {
  // giallo su bianco sarebbe illeggibile: si usa il colore da sfondo (#d4b500)
  const r = colorizeTab('WHITE/YELLOW');
  expect(r.style?.background).toBe('#eee');
  expect(r.parts[1]).toEqual({ text: 'YELLOW', color: '#d4b500' });
});

test('linguetta sconosciuta resta senza colore', () => {
  expect(colorizeTab('BLACK/RESEABLE').parts[1]).toEqual({ text: 'RESEABLE' });
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

test('black come seconda parte (Silver/Black) non è illeggibile su sfondo scuro', () => {
  const r = colorizeTab('SILVER/BLACK');
  const color = r.parts[1].color;
  expect(color).toBeTruthy();
  expect(color).not.toBe('#000');
});
