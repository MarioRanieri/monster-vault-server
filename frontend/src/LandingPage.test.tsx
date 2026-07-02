import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingPage } from './LandingPage';

test('mostra il wordmark e le stats (total / with photo)', () => {
  render(<LandingPage total={1866} withPhoto={355} onEnter={() => {}} onAdmin={() => {}} />);
  expect(screen.getByRole('heading', { name: /monster vault/i })).toBeTruthy();
  expect(screen.getByText('1866')).toBeTruthy();
  expect(screen.getByText('355')).toBeTruthy();
});

test('ENTER THE COLLECTION chiama onEnter (guest)', async () => {
  const onEnter = vi.fn();
  render(<LandingPage total={0} withPhoto={0} onEnter={onEnter} onAdmin={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /enter the collection/i }));
  expect(onEnter).toHaveBeenCalled();
});

test('ADMIN ACCESS chiama onAdmin', async () => {
  const onAdmin = vi.fn();
  render(<LandingPage total={0} withPhoto={0} onEnter={() => {}} onAdmin={onAdmin} />);
  await userEvent.click(screen.getByRole('button', { name: /admin access/i }));
  expect(onAdmin).toHaveBeenCalled();
});
