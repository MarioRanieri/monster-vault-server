import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

const noop = () => {};
const base = {
  onSignOut: noop,
  onLogoHome: noop,
  onAdd: noop,
  onLogin: noop,
  onToggleTheme: noop,
};

test('guest: mostra "Admin access", non Sign out', () => {
  render(<Header {...base} isAdmin={false} />);
  expect(screen.getByRole('button', { name: /admin access/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
});

test('admin: Add e Sign out chiamano le callback', async () => {
  const onAdd = vi.fn();
  const onSignOut = vi.fn();
  render(<Header {...base} isAdmin onSignOut={onSignOut} onAdd={onAdd} />);
  await userEvent.click(screen.getByRole('button', { name: /add/i }));
  await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
  expect(onAdd).toHaveBeenCalled();
  expect(onSignOut).toHaveBeenCalled();
});

test('il logo è un button e chiama onLogoHome (torna alla landing, no logout)', async () => {
  const onLogoHome = vi.fn();
  const onSignOut = vi.fn();
  render(<Header {...base} isAdmin onLogoHome={onLogoHome} onSignOut={onSignOut} />);
  await userEvent.click(screen.getByRole('button', { name: /monster vault.*home/i }));
  expect(onLogoHome).toHaveBeenCalled();
  expect(onSignOut).not.toHaveBeenCalled(); // logo ≠ sign out
});

test('i bottoni testuali hanno icona + label collassabile (mobile icon-only)', () => {
  render(
    <Header {...base} isAdmin onGuide={noop} onExport={noop} onImport={noop} onAccount={noop} />,
  );
  for (const name of [/guide/i, /export/i, /account/i, /sign out/i]) {
    const btn = screen.getByRole('button', { name });
    expect(btn.querySelector('svg'), `${name} svg`).toBeTruthy();
    expect(btn.querySelector('.btn-label'), `${name} label`).toBeTruthy();
  }
});

test('admin: mostra avatar accanto al nome', () => {
  render(<Header {...base} isAdmin />);
  expect(document.querySelector('.header-user .header-avatar')).toBeTruthy();
});

test('guest: Admin access ha icona + label collassabile', () => {
  render(<Header {...base} isAdmin={false} />);
  const btn = screen.getByRole('button', { name: /admin access/i });
  expect(btn.querySelector('svg')).toBeTruthy();
  expect(btn.querySelector('.btn-label')).toBeTruthy();
});

test('il toggle tema chiama onToggleTheme', async () => {
  const onToggleTheme = vi.fn();
  render(<Header {...base} isAdmin={false} onToggleTheme={onToggleTheme} />);
  await userEvent.click(screen.getByRole('button', { name: /theme/i }));
  expect(onToggleTheme).toHaveBeenCalled();
});

test('il menu ⋯ si apre col click e si chiude col click fuori', async () => {
  render(
    <Header {...base} isAdmin onGuide={noop} onExport={noop} onImport={noop} onAccount={noop} />,
  );
  const more = screen.getByRole('button', { name: /more actions/i });
  expect(more.getAttribute('aria-expanded')).toBe('false');
  await userEvent.click(more);
  expect(more.getAttribute('aria-expanded')).toBe('true');
  // click fuori → si chiude (listener mousedown sul document)
  fireEvent.mouseDown(document.body);
  expect(more.getAttribute('aria-expanded')).toBe('false');
});
