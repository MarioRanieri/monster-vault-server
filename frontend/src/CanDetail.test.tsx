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

test('admin vede il prezzo', () => {
  render(<CanDetail can={{ id: '1', nome: 'Alpha', valore: '20' }} onClose={() => {}} isAdmin />);
  expect(screen.getByText('€20')).toBeTruthy();
});
