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

test('lo slider Straighten mostra i gradi scelti', () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  const slider = screen.getByLabelText('Straighten') as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '-4.5' } });
  expect(screen.getByText('-4.5°')).toBeTruthy();
  fireEvent.change(slider, { target: { value: '3' } });
  expect(screen.getByText('+3°')).toBeTruthy();
});

test('Full photo è disponibile solo quando la foto è caricata', () => {
  render(<PhotoCrop src="blob:x" onApply={() => {}} onCancel={() => {}} />);
  expect((screen.getByRole('button', { name: /full photo/i }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});
