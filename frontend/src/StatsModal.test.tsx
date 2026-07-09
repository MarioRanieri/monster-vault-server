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
  expect(screen.getAllByText('USA').length).toBeGreaterThan(0);
  expect(screen.getByText(/photo coverage/i)).toBeTruthy();
});

test('Close chiama onClose', async () => {
  const onClose = vi.fn();
  render(<StatsModal cans={[]} stats={stats} onClose={onClose} />);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

const richCans = [
  { id: '1', nome: 'Gold', lingua: 'USA', stato: 'Damaged', valore: '80', updatedAt: Date.now() },
  { id: '2', nome: 'Silver', lingua: 'Italy', stato: 'OK', valore: '20', updatedAt: Date.now() },
];

test('click su una voce della legenda chiama onFilter', async () => {
  const onFilter = vi.fn();
  render(<StatsModal cans={richCans} stats={stats} onClose={() => {}} onFilter={onFilter} />);
  await userEvent.click(screen.getAllByRole('button', { name: /USA/ })[0]);
  expect(onFilter).toHaveBeenCalledWith('lingua', 'USA');
});

test('sezione Condition: card cliccabili con badge colorato', async () => {
  const onFilter = vi.fn();
  render(<StatsModal cans={richCans} stats={stats} onClose={() => {}} onFilter={onFilter} />);
  expect(screen.getByText('Condition')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /damaged/i }));
  expect(onFilter).toHaveBeenCalledWith('stato', 'Damaged');
});

test('Top value: solo admin, click apre il dettaglio', async () => {
  const onSelect = vi.fn();
  const { rerender } = render(
    <StatsModal cans={richCans} stats={stats} onClose={() => {}} onSelect={onSelect} />,
  );
  expect(screen.queryByText(/most valuable/i)).toBeNull(); // guest: niente prezzi

  rerender(
    <StatsModal cans={richCans} stats={stats} onClose={() => {}} onSelect={onSelect} isAdmin />,
  );
  expect(screen.getByText(/most valuable/i)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /gold/i }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
});

test('timeline: presente con toggle By year; € Value solo admin', async () => {
  const { rerender } = render(<StatsModal cans={richCans} stats={stats} onClose={() => {}} />);
  expect(screen.getByText(/added over time/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /by year/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /value/i })).toBeNull(); // guest: niente €

  rerender(<StatsModal cans={richCans} stats={stats} onClose={() => {}} isAdmin />);
  await userEvent.click(screen.getByRole('button', { name: /€ value/i }));
  expect(screen.getByRole('button', { name: /€ value/i }).className).toContain('active');
});
