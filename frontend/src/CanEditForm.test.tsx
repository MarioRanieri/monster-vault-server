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
  await userEvent.type(screen.getByLabelText('Condition'), 'ok');
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
  await userEvent.click(screen.getByRole('button', { name: /skip crop/i }));

  expect(onUploadPhoto).toHaveBeenCalledWith(1, file);
});

test('supporta i 4 slot: upload su Photo 3 usa lo slot 3', async () => {
  const onUploadPhoto = vi.fn();
  render(
    <CanEditForm can={can} onSave={() => {}} onCancel={() => {}} onUploadPhoto={onUploadPhoto} />,
  );

  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Photo 3'), file);
  await userEvent.click(screen.getByRole('button', { name: /skip crop/i }));

  expect(onUploadPhoto).toHaveBeenCalledWith(3, file);
});

test('il bottone URL di uno slot chiede un link e chiama onUploadPhotoUrl', async () => {
  const onUploadPhotoUrl = vi.fn();
  vi.spyOn(window, 'prompt').mockReturnValue('https://x/y.jpg');
  render(
    <CanEditForm
      can={can}
      onSave={() => {}}
      onCancel={() => {}}
      onUploadPhoto={() => {}}
      onUploadPhotoUrl={onUploadPhotoUrl}
    />,
  );

  await userEvent.click(screen.getAllByRole('button', { name: /paste url/i })[0]);

  expect(onUploadPhotoUrl).toHaveBeenCalledWith(1, 'https://x/y.jpg');
});
