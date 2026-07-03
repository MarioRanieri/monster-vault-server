import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanGrid } from './CanGrid';
import type { Can } from './types';

test('la card di una can in watch ha la classe watching', () => {
  const { container } = render(<CanGrid cans={[{ id: '1', nome: 'A', watch: true }]} />);
  expect(container.querySelector('.card.watching')).toBeTruthy();
});

test('renderizza una card per ogni can col suo nome', () => {
  const cans: Can[] = [
    { id: '1', nome: 'Alpha' },
    { id: '2', nome: 'Beta' },
  ];

  render(<CanGrid cans={cans} />);

  expect(screen.getByText('Alpha')).toBeTruthy();
  expect(screen.getByText('Beta')).toBeTruthy();
});

test('mostra foto e badge quando presenti', () => {
  const cans: Can[] = [
    {
      id: '1',
      nome: 'Alpha',
      p1: 'https://cdn.example/x.jpg',
      size: '500ml',
      promo: 'Zero',
      stato: 'ok',
    },
  ];

  render(<CanGrid cans={cans} />);

  const img = screen.getByRole('img', { name: 'Alpha' });
  expect(img.getAttribute('src')).toBe('https://cdn.example/x.jpg');
  expect(screen.getByText('500ml')).toBeTruthy();
  expect(screen.getByText('Zero')).toBeTruthy();
  expect(screen.getByText('ok')).toBeTruthy();
});

test('clic su una card chiama onSelect con la can', async () => {
  const onSelect = vi.fn();
  render(<CanGrid cans={[{ id: '1', nome: 'Alpha' }]} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
});
