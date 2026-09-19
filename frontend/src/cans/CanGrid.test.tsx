import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanGrid } from './CanGrid';
import type { Can } from '../app/types';

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

test('overlay Details chiama onSelect', async () => {
  const onSelect = vi.fn();
  render(<CanGrid cans={[{ id: '1', nome: 'Alpha' }]} onSelect={onSelect} onEdit={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /details/i }));

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
});

test('overlay Edit chiama onEdit e NON onSelect (stopPropagation)', async () => {
  const onSelect = vi.fn();
  const onEdit = vi.fn();
  render(<CanGrid cans={[{ id: '1', nome: 'Alpha' }]} onSelect={onSelect} onEdit={onEdit} />);

  await userEvent.click(screen.getByRole('button', { name: /edit/i }));

  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  expect(onSelect).not.toHaveBeenCalled();
});

test('senza onEdit (guest) il bottone Edit non compare', () => {
  render(<CanGrid cans={[{ id: '1', nome: 'Alpha' }]} onSelect={() => {}} />);

  expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
});

test('lattina senza foto mostra una sagoma di lattina, non un trattino', () => {
  const noPhotoCan: Can = { id: 'x1', nome: 'Test Can', lingua: 'ITALY' };
  render(<CanGrid cans={[noPhotoCan]} />);
  // Il nome/bandiera restano dove sono sempre stati (card-body, sotto la foto/
  // placeholder): il placeholder aggiunge solo la sagoma, non li duplica.
  expect(screen.getByRole('img', { name: /can placeholder/i })).toBeTruthy();
  expect(screen.getByText('Test Can')).toBeTruthy();
});
