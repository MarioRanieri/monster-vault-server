import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanEditForm } from './CanEditForm';
import type { Can } from './types';

const can: Can = { id: '1', nome: 'Alpha', sku: 'SKU-1' };

test('precompila i campi e salva le modifiche', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={can} onSave={onSave} onCancel={() => {}} />);

  expect(screen.getByDisplayValue('Alpha')).toBeTruthy();

  await userEvent.clear(screen.getByLabelText('Name'));
  await userEvent.type(screen.getByLabelText('Name'), 'Beta');
  await userEvent.type(screen.getByLabelText('SKU'), '-2');
  await userEvent.type(screen.getByLabelText('Size'), '500ml');
  await userEvent.type(screen.getByLabelText('Promo'), 'Zero');
  await userEvent.type(screen.getByLabelText('Status'), 'ok');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      id: '1',
      nome: 'Beta',
      sku: 'SKU-1-2',
      size: '500ml',
      promo: 'Zero',
      stato: 'ok',
    }),
  );
});

test('Annulla chiama onCancel', async () => {
  const onCancel = vi.fn();
  render(<CanEditForm can={can} onSave={() => {}} onCancel={onCancel} />);
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalled();
});

test('caricando un file chiama onUploadPhoto con lo slot 1', async () => {
  const onUploadPhoto = vi.fn();
  render(
    <CanEditForm can={can} onSave={() => {}} onCancel={() => {}} onUploadPhoto={onUploadPhoto} />,
  );

  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Photo 1'), file);

  expect(onUploadPhoto).toHaveBeenCalledWith(1, file);
});
