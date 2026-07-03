import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanList } from './CanList';

test('mostra una riga per can e chiama onSelect al clic sul nome', async () => {
  const onSelect = vi.fn();
  render(<CanList cans={[{ id: '1', nome: 'Alpha', sku: 'SKU-1' }]} onSelect={onSelect} />);
  expect(screen.getByText('SKU-1')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  expect(onSelect).toHaveBeenCalled();
});

test('mostra il prezzo solo da admin', () => {
  const { rerender } = render(<CanList cans={[{ id: '1', nome: 'A', valore: '20' }]} />);
  expect(screen.queryByText('€20')).toBeNull();
  rerender(<CanList cans={[{ id: '1', nome: 'A', valore: '20' }]} isAdmin />);
  expect(screen.getByText('€20')).toBeTruthy();
});
