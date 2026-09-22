import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanEditForm } from './CanEditForm';
import type { Can } from '../app/types';

const can: Can = { id: '1', nome: 'Alpha', sku: 'SKU-1' };

test('precompila i campi e salva le modifiche', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={can} onSave={onSave} onCancel={() => {}} />);

  expect(screen.getByDisplayValue('Alpha')).toBeTruthy();

  await userEvent.clear(screen.getByLabelText('Name'));
  await userEvent.type(screen.getByLabelText('Name'), 'Beta');
  await userEvent.type(screen.getByLabelText('SKU'), '-2');
  await userEvent.type(screen.getByLabelText('Size'), '500ml');
  await userEvent.selectOptions(screen.getByLabelText('Promo'), 'Yes');
  await userEvent.selectOptions(screen.getByLabelText('Condition'), 'Damaged');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      id: '1',
      nome: 'Beta',
      sku: 'SKU-1-2',
      size: '500ml',
      promo: 'Yes',
      stato: 'Damaged',
    }),
    expect.any(Array),
  );
});

test('Promo è un select Yes/No: precompilato se presente, No lo azzera', async () => {
  const onSave = vi.fn();
  render(
    <CanEditForm
      can={{ id: '1', nome: 'Alpha', sku: 'SKU-1', promo: 'Christmas' }}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  const promo = screen.getByLabelText('Promo') as HTMLSelectElement;
  expect(promo.value).toBe('Yes'); // promo esistente → Yes
  await userEvent.selectOptions(promo, 'No');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ promo: '' }), expect.any(Array));
});

test('Promo non toccata non riscrive il valore storico', async () => {
  const onSave = vi.fn();
  render(
    <CanEditForm
      can={{ id: '1', nome: 'Alpha', sku: 'SKU-1', promo: 'Christmas' }}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ promo: 'Christmas' }),
    expect.any(Array),
  );
});

test('Condition è un select OK / Minor Dents / Damaged', () => {
  render(<CanEditForm can={can} onSave={() => {}} onCancel={() => {}} />);
  const options = Array.from((screen.getByLabelText('Condition') as HTMLSelectElement).options).map(
    (o) => o.value,
  );
  expect(options).toEqual(['OK', 'Minor Dents', 'Damaged']);
});

test('Condition vuota (lattina nuova) parte da OK e salva OK', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={can} onSave={onSave} onCancel={() => {}} />);
  expect((screen.getByLabelText('Condition') as HTMLSelectElement).value).toBe('OK');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ stato: 'OK' }), expect.any(Array));
});

test('Condition storica fuori lista resta intatta se non la tocchi', async () => {
  const onSave = vi.fn();
  render(<CanEditForm can={{ ...can, stato: 'Mint' }} onSave={onSave} onCancel={() => {}} />);
  expect((screen.getByLabelText('Condition') as HTMLSelectElement).value).toBe('Mint');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ stato: 'Mint' }),
    expect.any(Array),
  );
});

test.each([
  ['Manufacturer', 'manufacturers', ['BALL', 'CROWN'], 'row', 'CROWN'],
  ['Size', 'sizes', ['250ML', '500ML'], '500', '500ML'],
  ['Language / Country', 'countries', ['MEXICO', 'ITALY'], 'mex', 'MEXICO'],
  ['Top / Tab', 'tops', ['SILVER/ORANGE', 'GOLD'], 'orange', 'SILVER/ORANGE'],
  [
    'More Info',
    'descriptions',
    ['Small logo 0920 design', 'First sku'],
    'logo',
    'Small logo 0920 design',
  ],
] as const)(
  '%s suggerisce i valori esistenti mentre scrivi',
  async (label, key, values, typed, picked) => {
    const onSave = vi.fn();
    render(
      <CanEditForm
        can={can}
        suggestions={{ [key]: [...values] }}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText(label), typed);
    await userEvent.click(screen.getByRole('option', { name: picked }));
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(picked);
  },
);

test('More Info: suggerisce i testi delle lattine simili mentre compili nome e nazione', async () => {
  const collection: Can[] = [
    { id: 'a', nome: 'KHAOS SMALL LOGO', lingua: 'MEXICO', descrizione: 'Small logo 0920 design' },
    { id: 'b', nome: 'OG SMALL LOGO', lingua: 'MEXICO', descrizione: 'Small logo 0920 design' },
  ];
  const onSave = vi.fn();
  render(
    <CanEditForm
      can={{ id: 'new', nome: '' }}
      collection={collection}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  expect(screen.queryByRole('button', { name: /Small logo 0920 design/ })).toBeNull();
  await userEvent.type(screen.getByLabelText('Name'), 'MANGO LOCO SMALL LOGO');
  await userEvent.type(screen.getByLabelText('Language / Country'), 'MEXICO');
  await userEvent.click(screen.getByRole('button', { name: /Small logo 0920 design/ }));
  expect(screen.getByLabelText('More Info')).toHaveProperty('value', 'Small logo 0920 design');
  // compilato: i suggerimenti spariscono
  expect(screen.queryByRole('button', { name: /Small logo 0920 design/ })).toBeNull();
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

  expect((screen.getByAltText('Slot 1') as HTMLImageElement).src).toContain('b.jpg');
  expect((screen.getByAltText('Slot 2') as HTMLImageElement).src).toContain('a.jpg');

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

  expect((screen.getByAltText('Slot 1') as HTMLImageElement).src).toContain('b.jpg');
  expect((screen.getByAltText('Slot 2') as HTMLImageElement).src).toContain('a.jpg');
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
  const badge = document.querySelector('.top-preview .tab-badge') as HTMLElement;
  expect(badge).toBeTruthy();
  expect(badge.style.background).toBe('rgb(202, 166, 46)');
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

test('la modale è un <dialog> nativo', () => {
  render(<CanEditForm can={can} onSave={vi.fn()} onCancel={() => {}} />);
  expect(screen.getByRole('dialog').tagName).toBe('DIALOG');
});

test('ESC senza modifiche chiude subito, senza chiedere conferma', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm');
  const onCancel = vi.fn();
  render(<CanEditForm can={can} onSave={() => {}} onCancel={onCancel} />);

  await userEvent.keyboard('{Escape}');

  expect(confirmSpy).not.toHaveBeenCalled();
  expect(onCancel).toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test('ESC con modifiche non salvate chiede conferma; annullando resta aperto', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  const onCancel = vi.fn();
  render(<CanEditForm can={can} onSave={() => {}} onCancel={onCancel} />);

  await userEvent.type(screen.getByLabelText('Name'), ' Beta');
  await userEvent.keyboard('{Escape}');

  expect(window.confirm).toHaveBeenCalledWith('Discard changes?');
  expect(onCancel).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

test('ESC con modifiche non salvate, confermando chiude', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onCancel = vi.fn();
  render(<CanEditForm can={can} onSave={() => {}} onCancel={onCancel} />);

  await userEvent.type(screen.getByLabelText('Name'), ' Beta');
  await userEvent.keyboard('{Escape}');

  expect(onCancel).toHaveBeenCalled();
  vi.restoreAllMocks();
});

test('ESC durante il salvataggio non chiude e non chiede conferma', async () => {
  let resolveSave: () => void = () => {};
  const onSave = vi.fn(() => new Promise<void>((resolve) => (resolveSave = resolve)));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onCancel = vi.fn();
  render(<CanEditForm can={can} onSave={onSave} onCancel={onCancel} />);

  await userEvent.type(screen.getByLabelText('Name'), ' Beta');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(await screen.findByRole('button', { name: /saving/i })).toBeTruthy();

  await userEvent.keyboard('{Escape}');

  expect(window.confirm).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();

  resolveSave();
  await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy());
  vi.restoreAllMocks();
});
