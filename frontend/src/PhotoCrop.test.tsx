import { render, screen } from '@testing-library/react';
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
