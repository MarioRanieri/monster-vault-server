import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

test('inviando il form chiama onLogin con le credenziali', async () => {
  const onLogin = vi.fn();
  render(<LoginForm onLogin={onLogin} />);

  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.type(screen.getByLabelText('Password'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  expect(onLogin).toHaveBeenCalledWith('admin', 'pw');
});

test('mostra un errore quando passato', () => {
  render(<LoginForm onLogin={() => {}} error="Credenziali non valide" />);
  expect(screen.getByRole('alert')).toBeTruthy();
});
