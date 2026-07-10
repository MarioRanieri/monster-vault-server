import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingPage } from './LandingPage';

const base = {
  total: 1866,
  countries: 42,
  addedThisMonth: 0,
  onEnter: () => {},
  onAdmin: () => {},
};

test('mostra il wordmark e le stats (cans / countries)', () => {
  render(<LandingPage {...base} total={1866} countries={42} />);
  expect(screen.getByRole('heading', { name: /monster vault/i })).toBeTruthy();
  expect(screen.getByText('1866')).toBeTruthy();
  expect(screen.getByText('42')).toBeTruthy();
  expect(screen.getByText(/countries/i)).toBeTruthy();
});

test('badge mensile: "N added this month" quando > 0', () => {
  render(<LandingPage {...base} addedThisMonth={5} />);
  expect(screen.getByText(/5 added this month/i)).toBeTruthy();
});

test('badge mensile: "None added this month" quando 0', () => {
  render(<LandingPage {...base} addedThisMonth={0} />);
  expect(screen.getByText(/none added this month/i)).toBeTruthy();
});

test('ENTER THE COLLECTION chiama onEnter (guest)', async () => {
  const onEnter = vi.fn();
  render(<LandingPage {...base} onEnter={onEnter} />);
  await userEvent.click(screen.getByRole('button', { name: /enter the collection/i }));
  expect(onEnter).toHaveBeenCalled();
});

test('ADMIN ACCESS chiama onAdmin', async () => {
  const onAdmin = vi.fn();
  render(<LandingPage {...base} onAdmin={onAdmin} />);
  await userEvent.click(screen.getByRole('button', { name: /admin access/i }));
  expect(onAdmin).toHaveBeenCalled();
});
