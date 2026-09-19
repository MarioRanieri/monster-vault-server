import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingPage } from './LandingPage';
import type { Can } from '../app/types';

const base = {
  total: 1866,
  countries: 42,
  addedThisMonth: 0,
  latest: [] as Can[],
  onEnter: () => {},
  onAdmin: () => {},
  onSelect: () => {},
};

const twoLatest: Can[] = [
  { id: '1', nome: 'Alpha', p1: 'a.jpg' },
  { id: '2', nome: 'Beta', p1: 'b.jpg' },
];

test('mostra il wordmark e le stats (cans / countries)', () => {
  render(<LandingPage {...base} total={1866} countries={42} />);
  expect(screen.getByRole('heading', { name: /monster vault/i })).toBeTruthy();
  expect(screen.getByText('1866')).toBeTruthy();
  expect(screen.getByText('42')).toBeTruthy();
  expect(screen.getByText(/countries/i)).toBeTruthy();
});

test('badge mensile: "N cans added this month" quando > 1', () => {
  render(<LandingPage {...base} addedThisMonth={5} />);
  expect(screen.getByText(/5 cans added this month/i)).toBeTruthy();
});

test('badge mensile: singolare "1 can added this month"', () => {
  render(<LandingPage {...base} addedThisMonth={1} />);
  expect(screen.getByText(/1 can added this month/i)).toBeTruthy();
});

test('badge mensile: "no new cans added this month" quando 0', () => {
  render(<LandingPage {...base} addedThisMonth={0} />);
  expect(screen.getByText(/no new cans added this month/i)).toBeTruthy();
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

test('"Latest additions" mostra una card per ogni lattina passata', () => {
  render(<LandingPage {...base} latest={twoLatest} />);
  expect(screen.getByText('Latest additions')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Alpha' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Beta' })).toBeTruthy();
});

test('"Latest additions" è nascosta mentre loading, anche con lattine', () => {
  render(<LandingPage {...base} latest={twoLatest} loading />);
  expect(screen.queryByText('Latest additions')).toBeNull();
});

test('"Latest additions" è nascosta se non ci sono lattine', () => {
  render(<LandingPage {...base} latest={[]} />);
  expect(screen.queryByText('Latest additions')).toBeNull();
});

test('cliccare una card di "Latest additions" chiama onSelect con quella lattina', async () => {
  const onSelect = vi.fn();
  render(<LandingPage {...base} latest={twoLatest} onSelect={onSelect} />);
  await userEvent.click(screen.getByRole('button', { name: 'Alpha' }));
  expect(onSelect).toHaveBeenCalledWith(twoLatest[0]);
});
