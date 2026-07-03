import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComparePanel } from './ComparePanel';

test('mostra una colonna per can e le righe di confronto', () => {
  render(
    <ComparePanel
      cans={[
        { id: '1', nome: 'Alpha', produttore: 'ACME' },
        { id: '2', nome: 'Beta', produttore: 'MonsterCo' },
      ]}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText('Alpha')).toBeTruthy();
  expect(screen.getByText('Beta')).toBeTruthy();
  expect(screen.getByText('Manufacturer')).toBeTruthy(); // label riga
  expect(screen.getByText('ACME')).toBeTruthy();
});

test('Close chiama onClose', async () => {
  const onClose = vi.fn();
  render(
    <ComparePanel
      cans={[
        { id: '1', nome: 'A' },
        { id: '2', nome: 'B' },
      ]}
      onClose={onClose}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

test('il prezzo (Est. Value) è solo da admin', () => {
  const { rerender } = render(
    <ComparePanel cans={[{ id: '1', nome: 'A', valore: '20' }]} onClose={() => {}} />,
  );
  expect(screen.queryByText('Est. Value')).toBeNull();
  rerender(
    <ComparePanel cans={[{ id: '1', nome: 'A', valore: '20' }]} onClose={() => {}} isAdmin />,
  );
  expect(screen.getByText('Est. Value')).toBeTruthy();
  expect(screen.getByText('€20')).toBeTruthy();
});
