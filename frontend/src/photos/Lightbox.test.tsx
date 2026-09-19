import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lightbox } from './Lightbox';

test('mostra la foto e la chiude con ✕', async () => {
  const onClose = vi.fn();
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={onClose} />);
  expect(screen.getByRole('img', { name: 'Alpha' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /close photo/i }));
  expect(onClose).toHaveBeenCalled();
});

test('con più foto le frecce cambiano immagine', async () => {
  render(<Lightbox photos={['a.jpg', 'b.jpg']} alt="Alpha" onClose={() => {}} />);
  const src = () => screen.getByRole('img', { name: 'Alpha' }).getAttribute('src');
  expect(src()).toContain('a.jpg');
  await userEvent.click(screen.getByRole('button', { name: /next photo/i }));
  expect(src()).toContain('b.jpg');
});

test('ESC chiude il lightbox', async () => {
  const onClose = vi.fn();
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={onClose} />);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});

test('doppio click: zoom 2.5x, di nuovo doppio click: reset', async () => {
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={() => {}} />);
  const img = screen.getByRole('img', { name: 'Alpha' });

  await userEvent.dblClick(img);
  expect(img.style.transform).toContain('scale(2.5)');

  await userEvent.dblClick(img);
  expect(img.style.transform).toContain('scale(1)');
});

test('cambiando foto lo zoom si resetta', async () => {
  render(<Lightbox photos={['a.jpg', 'b.jpg']} alt="Alpha" onClose={() => {}} />);
  const img = screen.getByRole('img', { name: 'Alpha' });

  await userEvent.dblClick(img);
  expect(img.style.transform).toContain('scale(2.5)');

  await userEvent.click(screen.getByRole('button', { name: /next photo/i }));
  expect(screen.getByRole('img', { name: 'Alpha' }).style.transform).toContain('scale(1)');
});

const two = (a: number, b: number) => [
  { clientX: a, clientY: 0 },
  { clientX: b, clientY: 0 },
];
const src = () => screen.getByRole('img', { name: 'Alpha' }).getAttribute('src');
const pair = () => render(<Lightbox photos={['a.jpg', 'b.jpg']} alt="Alpha" onClose={() => {}} />);

test('le frecce della tastiera scorrono le foto, con giro completo', async () => {
  pair();
  await userEvent.keyboard('{ArrowRight}');
  expect(src()).toContain('b.jpg');
  await userEvent.keyboard('{ArrowRight}');
  expect(src()).toContain('a.jpg');
  await userEvent.keyboard('{ArrowLeft}');
  expect(src()).toContain('b.jpg');
});

test('rotellina: su ingrandisce, giù rimpicciolisce fino al reset', () => {
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={() => {}} />);
  const img = screen.getByRole('img', { name: 'Alpha' });
  fireEvent.wheel(img, { deltaY: -100 });
  expect(img.style.transform).toContain('scale(1.25)');
  fireEvent.wheel(img, { deltaY: 100 });
  expect(img.style.transform).toContain('scale(1)');
});

test('mouse: da zoomati il trascinamento sposta la foto, al rilascio si ferma', () => {
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={() => {}} />);
  const img = screen.getByRole('img', { name: 'Alpha' });
  fireEvent.doubleClick(img);
  fireEvent.mouseDown(img, { clientX: 10, clientY: 10 });
  fireEvent.mouseMove(window, { clientX: 30, clientY: 40 });
  expect(img.style.transform).toContain('translate(20px, 30px)');
  fireEvent.mouseUp(window);
  fireEvent.mouseMove(window, { clientX: 90, clientY: 90 });
  expect(img.style.transform).toContain('translate(20px, 30px)');
});

test('mouse: a scala 1 il trascinamento non sposta nulla', () => {
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={() => {}} />);
  const img = screen.getByRole('img', { name: 'Alpha' });
  fireEvent.mouseDown(img, { clientX: 10, clientY: 10 });
  fireEvent.mouseMove(window, { clientX: 30, clientY: 40 });
  expect(img.style.transform).toContain('translate(0px, 0px)');
});

test('pinch a due dita: la distanza raddoppia → scala 2', () => {
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={() => {}} />);
  const img = screen.getByRole('img', { name: 'Alpha' });
  fireEvent.touchStart(img, { touches: two(0, 100) });
  fireEvent.touchMove(img, { touches: two(0, 200) });
  expect(img.style.transform).toContain('scale(2)');
  fireEvent.touchEnd(img, { changedTouches: [] });
});

test('touch: da zoomati un dito sposta la foto', () => {
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={() => {}} />);
  const img = screen.getByRole('img', { name: 'Alpha' });
  fireEvent.doubleClick(img);
  fireEvent.touchStart(img, { touches: [{ clientX: 10, clientY: 10 }] });
  fireEvent.touchMove(img, { touches: [{ clientX: 25, clientY: 30 }] });
  expect(img.style.transform).toContain('translate(15px, 20px)');
});

test('swipe a sinistra → foto successiva, a destra → precedente', () => {
  pair();
  const img = screen.getByRole('img', { name: 'Alpha' });
  fireEvent.touchStart(img, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchEnd(img, { changedTouches: [{ clientX: 100, clientY: 0 }] });
  expect(src()).toContain('b.jpg');
  fireEvent.touchStart(img, { touches: [{ clientX: 100, clientY: 0 }] });
  fireEvent.touchEnd(img, { changedTouches: [{ clientX: 200, clientY: 0 }] });
  expect(src()).toContain('a.jpg');
});

test('swipe troppo corto (< 40px) o da zoomati non cambia foto', () => {
  pair();
  const img = screen.getByRole('img', { name: 'Alpha' });
  fireEvent.touchStart(img, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchEnd(img, { changedTouches: [{ clientX: 170, clientY: 0 }] });
  expect(src()).toContain('a.jpg');
  fireEvent.doubleClick(img);
  fireEvent.touchStart(img, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchEnd(img, { changedTouches: [{ clientX: 100, clientY: 0 }] });
  expect(src()).toContain('a.jpg');
});

test('la modale � un <dialog> nativo', () => {
  render(<Lightbox photos={['a.jpg']} alt="Alpha" onClose={() => {}} />);
  expect(screen.getByRole('dialog').tagName).toBe('DIALOG');
});
