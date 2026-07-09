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

test('i bottoni testuali hanno icona + label collassabile (mobile icon-only)', () => {
  render(
    <Header
      isAdmin
      onSignOut={noop}
      onAdd={noop}
      onLogin={noop}
      onToggleTheme={noop}
      onGuide={noop}
      onExport={noop}
      onImport={noop}
      onAccount={noop}
    />,
  );
  for (const name of [/guide/i, /export/i, /account/i, /sign out/i]) {
    const btn = screen.getByRole('button', { name });
    expect(btn.querySelector('svg'), `${name} svg`).toBeTruthy();
    expect(btn.querySelector('.btn-label'), `${name} label`).toBeTruthy();
  }
});

test('admin: mostra avatar accanto al nome', () => {
  render(<Header isAdmin onSignOut={noop} onAdd={noop} onLogin={noop} onToggleTheme={noop} />);
  expect(document.querySelector('.header-user .header-avatar')).toBeTruthy();
});

test('guest: Admin access ha icona + label collassabile', () => {
  render(
    <Header isAdmin={false} onSignOut={noop} onAdd={noop} onLogin={noop} onToggleTheme={noop} />,
  );
  const btn = screen.getByRole('button', { name: /admin access/i });
  expect(btn.querySelector('svg')).toBeTruthy();
  expect(btn.querySelector('.btn-label')).toBeTruthy();
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
