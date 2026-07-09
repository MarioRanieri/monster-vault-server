import { render, screen } from '@testing-library/react';
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
