import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

const noop = () => {};

test('guest: mostra "Admin access", non Sign out', () => {
  render(
    <Header isAdmin={false} onSignOut={noop} onAdd={noop} onLogin={noop} onToggleTheme={noop} />,
  );
  expect(screen.getByRole('button', { name: /admin access/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
});

test('admin: Add e Sign out chiamano le callback', async () => {
  const onAdd = vi.fn();
  const onSignOut = vi.fn();
  render(
    <Header isAdmin onSignOut={onSignOut} onAdd={onAdd} onLogin={noop} onToggleTheme={noop} />,
  );
  await userEvent.click(screen.getByRole('button', { name: /add/i }));
  await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
  expect(onAdd).toHaveBeenCalled();
  expect(onSignOut).toHaveBeenCalled();
});

test('il toggle tema chiama onToggleTheme', async () => {
  const onToggleTheme = vi.fn();
  render(
    <Header
      isAdmin={false}
      onSignOut={noop}
      onAdd={noop}
      onLogin={noop}
      onToggleTheme={onToggleTheme}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /theme/i }));
  expect(onToggleTheme).toHaveBeenCalled();
});
