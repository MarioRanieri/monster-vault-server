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
    expect.any(Array),
  );
});

test('Annulla chiama onCancel', async () => {
  const onCancel = vi.fn();
  render(<CanEditForm can={can} onSave={() => {}} onCancel={onCancel} />);
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalled();
});

test('Opening è un gruppo di pill: selezionandone una la salva in note', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={can} onSave={onSave} onCancel={() => {}} />);
  await userEvent.click(screen.getByRole('radio', { name: 'FULL' }));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ note: 'FULL' }), expect.any(Array));
});

test('un file (staged) al Save finisce in uploads sullo slot 1', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={can} onSave={onSave} onCancel={() => {}} />);
  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Photo 1'), file);
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(
    expect.any(Object),
    expect.arrayContaining([expect.objectContaining({ slot: 1, file })]),
  );
});

test('un file su Photo 3 finisce sullo slot 3', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={can} onSave={onSave} onCancel={() => {}} />);
  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Photo 3'), file);
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(
    expect.any(Object),
    expect.arrayContaining([expect.objectContaining({ slot: 3, file })]),
  );
});

test('cliccando una foto caricata si apre il crop (non è forzato all’upload)', async () => {
  render(<CanEditForm can={can} onSave={() => {}} onCancel={() => {}} />);
  const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Photo 1'), file);
  // nessun crop all'upload: si apre solo cliccando la foto
  expect(screen.queryByRole('button', { name: /apply crop/i })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /crop photo 1/i }));
  expect(screen.getByRole('button', { name: /apply crop/i })).toBeTruthy();
});

test('il bottone URL mette in coda un upload da URL sullo slot 1', async () => {
  const onSave = vi.fn();
  vi.spyOn(window, 'prompt').mockReturnValue('https://x/y.jpg');
  render(<CanEditForm can={can} onSave={onSave} onCancel={() => {}} />);
  await userEvent.click(screen.getAllByRole('button', { name: /paste url/i })[0]);
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(
    expect.any(Object),
    expect.arrayContaining([expect.objectContaining({ slot: 1, url: 'https://x/y.jpg' })]),
  );
});
