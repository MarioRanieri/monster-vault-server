import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoCrop } from './PhotoCrop';

// Il ritaglio su canvas non è eseguibile in jsdom → qui si testano i pulsanti
// (la logica pura del rettangolo sta in cropRect.test).
test('Apply crop è disabilitato senza una selezione', () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  const apply = screen.getByRole('button', { name: /apply crop/i }) as HTMLButtonElement;
  expect(apply.disabled).toBe(true);
});

test('Cancel chiama onCancel', async () => {
  const onCancel = vi.fn();
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={onCancel} />);
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalled();
});

test('la modale è un <dialog> nativo', () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  expect(screen.getByRole('dialog').tagName).toBe('DIALOG');
});

test('ESC chiama onCancel', async () => {
  const onCancel = vi.fn();
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={onCancel} />);
  await userEvent.keyboard('{Escape}');
  expect(onCancel).toHaveBeenCalled();
});

test('lo slider Straighten lavora a decimi di grado', () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  const slider = screen.getByLabelText('Straighten') as HTMLInputElement;
  expect(slider.step).toBe('0.1');
  expect(slider.min).toBe('-10');
  fireEvent.change(slider, { target: { value: '-0.3' } });
  expect(screen.getByText('-0.3°')).toBeTruthy();
  fireEvent.change(slider, { target: { value: '0.7' } });
  expect(screen.getByText('+0.7°')).toBeTruthy();
});

test('i pulsanti − e + spostano di un decimo per volta, senza code decimali', async () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  const minus = screen.getByRole('button', { name: /straighten 0.1 degree left/i });
  await userEvent.click(minus);
  await userEvent.click(minus);
  await userEvent.click(minus);
  expect(screen.getByText('-0.3°')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /straighten 0.1 degree right/i }));
  expect(screen.getByText('-0.2°')).toBeTruthy();
});

test('Full photo è disponibile solo quando la foto è caricata', () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  expect((screen.getByRole('button', { name: /full photo/i }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

test('ogni lato del riquadro si trascina, non solo gli angoli', () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  fireEvent.load(screen.getByAltText('To crop'));
  for (const side of ['top', 'right', 'bottom', 'left'])
    expect(screen.getByRole('button', { name: `Crop edge ${side}` })).toBeTruthy();
});

test('toccare una maniglia non avvia la selezione del testo (riquadro blu su iOS)', () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  fireEvent.load(screen.getByAltText('To crop'));
  const edge = screen.getByRole('button', { name: 'Crop edge right' });
  edge.setPointerCapture = () => {};
  expect(fireEvent.pointerDown(edge)).toBe(false); // false = preventDefault chiamato
});
