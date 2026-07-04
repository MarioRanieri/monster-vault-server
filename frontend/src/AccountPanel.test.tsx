import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountPanel } from './AccountPanel';
import { useAuthStore } from './authStore';

test('cambia password: chiama changePassword e mostra conferma', async () => {
  const changePassword = vi.fn().mockResolvedValue({ ok: true });
  useAuthStore.setState({ changePassword } as never);
  render(<AccountPanel onClose={() => {}} />);

  await userEvent.type(screen.getByLabelText('Current password'), 'oldpass12');
  await userEvent.type(screen.getByLabelText('New password'), 'newpass12');
  await userEvent.click(screen.getByRole('button', { name: /change password/i }));

  expect(changePassword).toHaveBeenCalledWith('oldpass12', 'newpass12');
  expect(await screen.findByText(/password changed/i)).toBeTruthy();
});

test('genera il codice di recupero e lo mostra una volta', async () => {
  const generateRecoveryCode = vi.fn().mockResolvedValue('MV-AAAA-BBBB-CCCC');
  useAuthStore.setState({ generateRecoveryCode } as never);
  render(<AccountPanel onClose={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /generate recovery code/i }));

  expect(await screen.findByText('MV-AAAA-BBBB-CCCC')).toBeTruthy();
});
