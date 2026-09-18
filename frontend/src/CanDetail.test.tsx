import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanDetail } from './CanDetail';
import type { Can } from './types';

const can: Can = { id: '1', nome: 'Alpha', sku: 'SKU-1', size: '500ml' };

test('mostra i dettagli della can', () => {
  render(<CanDetail can={can} onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
  expect(screen.getAllByText('SKU-1').length).toBeGreaterThan(0);
  expect(screen.getAllByText('500ml').length).toBeGreaterThan(0);
});

test('il bottone Chiudi chiama onClose', async () => {
  const onClose = vi.fn();
  render(<CanDetail can={can} onClose={onClose} />);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

test('mostra foto e badge promo/stato quando presenti', () => {
  render(
    <CanDetail
      can={{
        id: '1',
        nome: 'Alpha',
        p1: 'https://cdn.example/x.jpg',
        promo: 'Zero',
        stato: 'ok',
      }}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole('img', { name: 'Alpha' })).toBeTruthy();
  expect(screen.getAllByText('Zero').length).toBeGreaterThan(0);
  expect(screen.getAllByText('ok').length).toBeGreaterThan(0);
});

test('mostra la galleria (immagine principale + miniature)', async () => {
  render(
    <CanDetail
      can={{ id: '1', nome: 'Alpha', p1: 'a.jpg', p2: 'b.jpg', p3: 'c.jpg' }}
      onClose={() => {}}
    />,
  );
  const imgs = screen.getAllByRole('img');
  expect(imgs.length).toBeGreaterThanOrEqual(3);
  await userEvent.click(imgs.at(-1)!); // clic su una miniatura
});

test('cliccando una foto si apre la lightbox; il suo Chiudi la chiude', async () => {
  render(<CanDetail can={{ id: '1', nome: 'Alpha', p1: 'a.jpg' }} onClose={() => {}} />);

  expect(screen.queryByRole('dialog')).toBeNull();

  await userEvent.click(screen.getByRole('img', { name: 'Alpha' }));
  expect(screen.getByRole('dialog')).toBeTruthy();

  await userEvent.click(screen.getByRole('button', { name: /close photo/i }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('da admin mostra Modifica ed Elimina con le callback', async () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <CanDetail
      can={{ id: '1', nome: 'Alpha' }}
      onClose={() => {}}
      isAdmin
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /edit/i }));
  await userEvent.click(screen.getByRole('button', { name: /delete/i }));

  expect(onEdit).toHaveBeenCalled();
  expect(onDelete).toHaveBeenCalled();
});

test('senza admin non mostra Modifica/Elimina', () => {
  render(<CanDetail can={{ id: '1', nome: 'Alpha' }} onClose={() => {}} />);
  expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
});

test('guest non vede il prezzo (Est. Value)', () => {
  render(<CanDetail can={{ id: '1', nome: 'Alpha', valore: '20' }} onClose={() => {}} />);
  expect(screen.queryByText('€20')).toBeNull();
});

test('col prezzo attivo (showPrice) mostra Est. Value', () => {
  render(
    <CanDetail
      can={{ id: '1', nome: 'Alpha', valore: '20' }}
      onClose={() => {}}
      isAdmin
      showPrice
    />,
  );
  expect(screen.getByText('€20')).toBeTruthy();
});

test('i campi sono una lista pulita, non box grigi identici', () => {
  const fullCan: Can = {
    id: '1',
    nome: 'Alpha',
    sku: 'SKU-1',
    produttore: 'Monster',
    lingua: 'ITALY',
    size: '500ml',
    top: 'Silver',
    stato: 'OK',
  };
  render(<CanDetail can={fullCan} onClose={() => {}} />);
  const list = screen.getByRole('list', { name: /can details/i });
  expect(list.querySelectorAll('li').length).toBeGreaterThanOrEqual(6);
});

test('mostra fino a 8 altre lattine dello stesso paese, non se stessa', () => {
  const target: Can = { id: '1', nome: 'Alpha', lingua: 'ITALY' };
  const allCans: Can[] = [
    target,
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `other-${i}`,
      nome: `Other ${i}`,
      lingua: 'ITALY',
    })),
    { id: 'diff', nome: 'Different country', lingua: 'GERMANY' },
  ];
  render(<CanDetail can={target} onClose={() => {}} allCans={allCans} onSelect={() => {}} />);
  const section = screen.getByRole('region', { name: /other cans from this country/i });
  expect(section.querySelectorAll('.card').length).toBe(8);
  expect(screen.queryByText('Different country')).toBeNull();
});

test('non mostra la sezione "other cans" senza allCans', () => {
  const target: Can = { id: '1', nome: 'Alpha', lingua: 'ITALY' };
  render(<CanDetail can={target} onClose={() => {}} />);
  expect(screen.queryByRole('region', { name: /other cans from this country/i })).toBeNull();
});

test('mostra le lattine della stessa linea (prime due parole del nome)', () => {
  const target: Can = { id: '1', nome: 'Absolutely Zero Dark BF1' };
  const allCans: Can[] = [
    target,
    { id: '2', nome: 'Absolutely Zero Blue Text 355' },
    { id: '3', nome: 'absolutely zero euro' }, // case diverso, stessa linea
    { id: '4', nome: 'Ultra White (New)' }, // linea diversa
  ];
  render(<CanDetail can={target} onClose={() => {}} allCans={allCans} onSelect={() => {}} />);
  const section = screen.getByRole('region', { name: /cans from the same lineup/i });
  expect(section.querySelectorAll('.card').length).toBe(2);
  expect(screen.queryByText('Ultra White (New)')).toBeNull();
});

test('nella stessa linea non mischia mai promo e non-promo', () => {
  const target: Can = { id: '1', nome: 'OG Nico Hischier', promo: 'YES' };
  const allCans: Can[] = [
    target,
    { id: '2', nome: 'OG Ken Block', promo: 'YES' }, // stesso stato promo → ok
    { id: '3', nome: 'OG Original' }, // stessa linea ma NON promo → escluso
  ];
  render(<CanDetail can={target} onClose={() => {}} allCans={allCans} onSelect={() => {}} />);
  const section = screen.getByRole('region', { name: /cans from the same lineup/i });
  expect(section.querySelectorAll('.card').length).toBe(1);
  expect(screen.queryByText('OG Original')).toBeNull();
});

test('una promo con gemella in un’altra nazione mostra la fascia senza sottotitolo, poi quella "same country" con etichetta', () => {
  const target: Can = { id: '1', nome: 'OG Hardik Pandya', promo: 'YES', lingua: 'INDIA' };
  const allCans: Can[] = [
    target,
    { id: '2', nome: 'OG Hardik Pandya Trinidad', promo: 'YES', lingua: 'TRINIDAD' },
    { id: '3', nome: 'ULTRA WHITE THAR', promo: 'YES', lingua: 'INDIA' }, // altra promo indiana
  ];
  render(<CanDetail can={target} onClose={() => {}} allCans={allCans} onSelect={() => {}} />);
  // "ULTRA WHITE THAR" combacia anche per "Other cans from this country" (stessa
  // nazione+promo, sezione indipendente) — la query resta dentro "same lineup".
  const section = screen.getByRole('region', { name: /cans from the same lineup/i });
  expect(within(section).getByText('OG Hardik Pandya Trinidad')).toBeTruthy();
  expect(within(section).getByText('Other INDIA promos')).toBeTruthy();
  expect(within(section).getByText('ULTRA WHITE THAR')).toBeTruthy();
});

test('le frecce ← → passano alla lattina precedente/successiva di navCans', async () => {
  const a: Can = { id: '1', nome: 'Alpha' };
  const b: Can = { id: '2', nome: 'Beta' };
  const c: Can = { id: '3', nome: 'Gamma' };
  const onSelect = vi.fn();
  render(
    <CanDetail
      can={b}
      onClose={() => {}}
      navCans={[a, b, c]}
      allCans={[a, b, c]}
      onSelect={onSelect}
    />,
  );

  await userEvent.keyboard('{ArrowRight}');
  expect(onSelect).toHaveBeenCalledWith(c);

  await userEvent.keyboard('{ArrowLeft}');
  expect(onSelect).toHaveBeenCalledWith(a);
});

test('con la lightbox aperta le frecce scorrono le foto, non la lattina', async () => {
  const a: Can = { id: '1', nome: 'Alpha', p1: 'a.jpg', p2: 'b.jpg' };
  const b: Can = { id: '2', nome: 'Beta' };
  const onSelect = vi.fn();
  render(<CanDetail can={a} onClose={() => {}} navCans={[a, b]} onSelect={onSelect} />);

  await userEvent.click(screen.getAllByRole('img', { name: 'Alpha' })[0]);
  expect(screen.getByRole('dialog')).toBeTruthy();

  await userEvent.keyboard('{ArrowRight}');
  expect(onSelect).not.toHaveBeenCalled();
});

test('naviga le foto con le frecce e mostra il contatore', async () => {
  const user = userEvent.setup();
  const multiPhotoCan: Can = {
    id: '1',
    nome: 'Alpha',
    p1: 'https://res.cloudinary.com/x/image/upload/a.jpg',
    p2: 'https://res.cloudinary.com/x/image/upload/b.jpg',
    p3: 'https://res.cloudinary.com/x/image/upload/c.jpg',
  };
  render(<CanDetail can={multiPhotoCan} onClose={() => {}} />);
  expect(screen.getByText('1 / 3')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /next photo/i }));
  expect(screen.getByText('2 / 3')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /previous photo/i }));
  expect(screen.getByText('1 / 3')).toBeTruthy();
});

test('ESC chiude il pannello di dettaglio', async () => {
  const onClose = vi.fn();
  render(<CanDetail can={can} onClose={onClose} />);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});

test('con la lightbox aperta ESC chiude la lightbox, non il pannello', async () => {
  const onClose = vi.fn();
  const withPhoto: Can = { ...can, p1: 'a.jpg' };
  render(<CanDetail can={withPhoto} onClose={onClose} />);

  await userEvent.click(screen.getByRole('img', { name: 'Alpha' }));
  expect(screen.getByRole('dialog')).toBeTruthy();

  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
});

test('il pannello riceve il focus all’apertura', () => {
  render(<CanDetail can={can} onClose={() => {}} />);
  expect(document.activeElement).toBe(screen.getByRole('complementary'));
});

test('alla chiusura il focus torna al trigger che ha aperto il pannello', () => {
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();
  expect(document.activeElement).toBe(trigger);

  const { unmount } = render(<CanDetail can={can} onClose={() => {}} />);
  expect(document.activeElement).not.toBe(trigger);

  unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
