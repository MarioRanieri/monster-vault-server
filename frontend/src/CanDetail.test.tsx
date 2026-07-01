import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanDetail } from './CanDetail';
import type { Can } from './types';

const can: Can = { id: '1', nome: 'Alpha', sku: 'SKU-1', size: '500ml' };

test('mostra i dettagli della can', () => {
  render(<CanDetail can={can} onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
  expect(screen.getByText('SKU-1')).toBeTruthy();
  expect(screen.getByText('500ml')).toBeTruthy();
});

test('il bottone Chiudi chiama onClose', async () => {
  const onClose = vi.fn();
  render(<CanDetail can={can} onClose={onClose} />);
  await userEvent.click(screen.getByRole('button', { name: /chiudi/i }));
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
  expect(screen.getByText('Zero')).toBeTruthy();
  expect(screen.getByText('ok')).toBeTruthy();
});
