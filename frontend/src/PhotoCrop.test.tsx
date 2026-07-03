import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoCrop } from './PhotoCrop';

const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });

test('Skip crop applica il file originale', async () => {
  const onApply = vi.fn();
  render(<PhotoCrop file={file} onApply={onApply} onCancel={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /skip/i }));
  expect(onApply).toHaveBeenCalledWith(file);
});

test('Apply senza selezione usa il file originale', async () => {
  const onApply = vi.fn();
  render(<PhotoCrop file={file} onApply={onApply} onCancel={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /^apply$/i }));
  expect(onApply).toHaveBeenCalledWith(file);
});

test('Cancel chiama onCancel', async () => {
  const onCancel = vi.fn();
  render(<PhotoCrop file={file} onApply={() => {}} onCancel={onCancel} />);
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalled();
});
