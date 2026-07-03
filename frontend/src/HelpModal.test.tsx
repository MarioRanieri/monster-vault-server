import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpModal } from './HelpModal';

test('mostra il titolo Guide e le sezioni', () => {
  render(<HelpModal onClose={() => {}} />);
  expect(screen.getByText('Guide')).toBeTruthy();
  expect(screen.getByText('Browsing')).toBeTruthy();
  expect(screen.getByText('Admin')).toBeTruthy();
});

test('Close chiama onClose', async () => {
  const onClose = vi.fn();
  render(<HelpModal onClose={onClose} />);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});
