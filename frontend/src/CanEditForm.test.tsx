import { render, screen, fireEvent } from '@testing-library/react';
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
  await userEvent.click(screen.getByLabelText('Promo'));
  await userEvent.type(screen.getByLabelText('Condition'), 'ok');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      id: '1',
      nome: 'Beta',
      sku: 'SKU-1-2',
      size: '500ml',
      promo: 'Yes',
      stato: 'ok',
    }),
    expect.any(Array),
  );
});

test('Promo è una flag sì/no: precompilata se presente e togglabile', async () => {
  const onSave = vi.fn();
  render(
    <CanEditForm
      can={{ id: '1', nome: 'Alpha', sku: 'SKU-1', promo: 'Christmas' }}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  const promo = screen.getByLabelText('Promo') as HTMLInputElement;
  expect(promo.checked).toBe(true); // promo esistente → flag ON
  await userEvent.click(promo); // toggle a OFF
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ promo: '' }), expect.any(Array));
});

test('Condition mostra i suggerimenti da inserimenti precedenti', () => {
  render(
    <CanEditForm
      can={can}
      suggestions={{ conditions: ['Mint', 'Good'] }}
      onSave={() => {}}
      onCancel={() => {}}
    />,
  );
  const values = Array.from(document.querySelectorAll('#dl-stato option')).map((o) =>
    o.getAttribute('value'),
  );
  expect(values).toEqual(['Mint', 'Good']);
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

test('mentre onSave è in corso, Save è disabilitato e mostra "Saving…"', async () => {
  let finish!: () => void;
  const onSave = vi.fn(() => new Promise<void>((r) => (finish = r)));
  render(<CanEditForm can={can} onSave={onSave} onCancel={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  const btn = await screen.findByRole('button', { name: /saving/i });
  expect(btn).toBeDisabled();
  expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

  finish();
});

const canWithPhotos: Can = { id: '1', nome: 'Alpha', sku: 'S', p1: 'a.jpg', p2: 'b.jpg' };

test('⇄: seleziona uno slot, tap su un altro → foto scambiate anche al Save', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={canWithPhotos} onSave={onSave} onCancel={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /^move photo 1$/i }));
  await userEvent.click(document.getElementById('slot-2')!);

  expect((screen.getByAltText('Photo 1') as HTMLImageElement).src).toContain('b.jpg');
  expect((screen.getByAltText('Photo 2') as HTMLImageElement).src).toContain('a.jpg');

  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ p1: 'b.jpg', p2: 'a.jpg' }),
    expect.any(Array),
  );
});

test('drag&drop tra due slot scambia le foto', () => {
  render(<CanEditForm can={canWithPhotos} onSave={() => {}} onCancel={() => {}} />);
  const dt = {
    data: {} as Record<string, string>,
    setData(k: string, v: string) {
      this.data[k] = v;
    },
    getData(k: string) {
      return this.data[k];
    },
  };
  fireEvent.dragStart(document.getElementById('slot-1')!, { dataTransfer: dt });
  fireEvent.dragOver(document.getElementById('slot-2')!, { dataTransfer: dt });
  fireEvent.drop(document.getElementById('slot-2')!, { dataTransfer: dt });

  expect((screen.getByAltText('Photo 1') as HTMLImageElement).src).toContain('b.jpg');
  expect((screen.getByAltText('Photo 2') as HTMLImageElement).src).toContain('a.jpg');
});

test('Save bloccato senza Name/SKU, con messaggio; sbloccato compilandoli', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={{ id: '1', nome: '' }} onSave={onSave} onCancel={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText(/name and sku are required/i)).toBeTruthy();

  await userEvent.type(screen.getByLabelText('Name'), 'X');
  await userEvent.type(screen.getByLabelText('SKU'), '1');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalled();
});

test('anteprima colore Top/Tab mentre scrivi', async () => {
  render(<CanEditForm can={can} onSave={() => {}} onCancel={() => {}} />);
  expect(document.querySelector('.top-preview')).toBeNull();
  await userEvent.type(screen.getByLabelText('Top / Tab'), 'gold');
  const prev = document.querySelector('.top-preview') as HTMLElement;
  expect(prev).toBeTruthy();
  expect(prev.style.background).toBeTruthy();
});

test('click su uno slot pieno riapre il file picker (sostituzione)', async () => {
  const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
  render(<CanEditForm can={canWithPhotos} onSave={() => {}} onCancel={() => {}} />);

  await userEvent.click(document.getElementById('slot-1')!);

  expect(clickSpy).toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: /crop photo/i })).toBeNull();
  clickSpy.mockRestore();
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
