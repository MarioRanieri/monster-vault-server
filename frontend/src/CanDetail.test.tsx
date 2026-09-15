import { render, screen } from '@testing-library/react';
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
  await userEvent.click(imgs[imgs.length - 1]); // clic su una miniatura
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
