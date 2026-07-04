import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanShare } from './CanShare';

const can = { id: '1', nome: 'Alpha' };

test('apre la sheet e copia il link', async () => {
  const writeText = vi.fn();
  Object.assign(navigator, { clipboard: { writeText } });
  const onToast = vi.fn();
  render(<CanShare can={can} onToast={onToast} />);

  expect(screen.queryByText('Copy link')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: /share/i }));
  await userEvent.click(screen.getByText('Copy link'));

  expect(writeText).toHaveBeenCalled();
  expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/link copied/i));
});

test('mostra WhatsApp e Telegram nella sheet', async () => {
  render(<CanShare can={can} />);
  await userEvent.click(screen.getByRole('button', { name: /share/i }));
  expect(screen.getByText('WhatsApp')).toBeTruthy();
  expect(screen.getByText('Telegram')).toBeTruthy();
});

test('WhatsApp/Telegram aprono un link in una nuova scheda', async () => {
  const open = vi.fn();
  vi.stubGlobal('open', open);
  render(<CanShare can={{ id: '1', nome: 'Alpha', lingua: 'USA' }} />);

  await userEvent.click(screen.getByRole('button', { name: /share/i }));
  await userEvent.click(screen.getByText('WhatsApp'));
  expect(open).toHaveBeenCalledWith(expect.stringContaining('wa.me'), '_blank', 'noopener');

  await userEvent.click(screen.getByRole('button', { name: /share/i }));
  await userEvent.click(screen.getByText('Telegram'));
  expect(open).toHaveBeenCalledWith(expect.stringContaining('t.me'), '_blank', 'noopener');
});
