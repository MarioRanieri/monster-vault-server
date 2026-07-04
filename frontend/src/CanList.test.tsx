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

test('anche il clic sulla riga (non solo sul nome) apre il dettaglio', async () => {
  const onSelect = vi.fn();
  render(<CanList cans={[{ id: '1', nome: 'Alpha', sku: 'SKU-1' }]} onSelect={onSelect} />);
  await userEvent.click(screen.getByText('SKU-1')); // cella SKU
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
});

test('la colonna Country mostra la bandiera', () => {
  const { container } = render(<CanList cans={[{ id: '1', nome: 'A', lingua: 'ITALY' }]} />);
  expect(container.querySelector('.flag-chip')).toBeTruthy();
});

test('il prezzo appare solo col toggle showPrice', () => {
  const { rerender } = render(<CanList cans={[{ id: '1', nome: 'A', valore: '20' }]} />);
  expect(screen.queryByText('€20')).toBeNull();
  rerender(<CanList cans={[{ id: '1', nome: 'A', valore: '20' }]} showPrice />);
  expect(screen.getByText('€20')).toBeTruthy();
});

test("cliccando l'header Name ordina le righe", async () => {
  render(
    <CanList
      cans={[
        { id: '1', nome: 'Zeta' },
        { id: '2', nome: 'Alpha' },
      ]}
    />,
  );
  expect(screen.getAllByRole('row')[1].textContent).toContain('Zeta'); // ordine originale
  await userEvent.click(screen.getByRole('columnheader', { name: /name/i }));
  expect(screen.getAllByRole('row')[1].textContent).toContain('Alpha'); // ordinato A→Z
});
