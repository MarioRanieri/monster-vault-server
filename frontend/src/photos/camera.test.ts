import { lowRes, nextEmptySlot, loadZoom, saveZoom } from './camera';

test('nextEmptySlot va al prossimo slot vuoto dopo quello corrente', () => {
  expect(nextEmptySlot([true, false, false, false], 0)).toBe(1);
  expect(nextEmptySlot([true, true, false, false], 1)).toBe(2);
});

test('nextEmptySlot salta gli slot pieni e riparte dall’inizio', () => {
  expect(nextEmptySlot([false, true, true, true], 3)).toBe(0);
  expect(nextEmptySlot([true, false, true, true], 2)).toBe(1);
});

test('nextEmptySlot restituisce null quando sono tutti pieni', () => {
  expect(nextEmptySlot([true, true, true, true], 0)).toBeNull();
});

test('lowRes segnala meno di 1440px sul lato corto (orientamento indifferente)', () => {
  expect(lowRes(1920, 1440)).toBe(false);
  expect(lowRes(1440, 1920)).toBe(false);
  expect(lowRes(1920, 1080)).toBe(true);
  expect(lowRes(720, 1280)).toBe(true);
});

test('lo zoom scelto sopravvive tra una lattina e l’altra; default 1×', () => {
  localStorage.clear();
  expect(loadZoom()).toBe(1);
  saveZoom(2);
  expect(loadZoom()).toBe(2);
});

test('loadZoom ignora valori sporchi', () => {
  localStorage.setItem('mv.cameraZoom', 'banana');
  expect(loadZoom()).toBe(1);
});
