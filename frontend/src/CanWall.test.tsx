import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanWall } from './CanWall';

test('mostra solo i cans con foto come tile cliccabili', async () => {
  const onSelect = vi.fn();
  render(
    <CanWall
      cans={[
        { id: '1', nome: 'Alpha', p1: 'a.jpg' },
        { id: '2', nome: 'Beta' },
      ]}
      onSelect={onSelect}
    />,
  );
  expect(screen.getAllByRole('img')).toHaveLength(1); // solo Alpha ha foto
  await userEvent.click(screen.getByRole('button', { name: /alpha/i }));
  expect(onSelect).toHaveBeenCalled();
});

test('senza foto mostra un messaggio', () => {
  render(<CanWall cans={[{ id: '1', nome: 'Alpha' }]} />);
  expect(screen.getByText(/no photos/i)).toBeTruthy();
});
