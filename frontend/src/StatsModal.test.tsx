import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatsModal } from './StatsModal';
import type { Stats } from './computeStats';

const stats: Stats = { total: 2, withPhoto: 1, promo: 0, countries: 1, full: 0 };

test('mostra i tile riepilogo, la coverage e le sezioni a barre', () => {
  render(
    <StatsModal
      cans={[
        { id: '1', nome: 'a', lingua: 'USA', p1: 'x.jpg' },
        { id: '2', nome: 'b', lingua: 'USA' },
      ]}
      stats={stats}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText('Total')).toBeTruthy();
  expect(screen.getByText('By country / language')).toBeTruthy();
  expect(screen.getByText('USA')).toBeTruthy();
  expect(screen.getByText(/photo coverage/i)).toBeTruthy();
});

test('Close chiama onClose', async () => {
  const onClose = vi.fn();
  render(<StatsModal cans={[]} stats={stats} onClose={onClose} />);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});
