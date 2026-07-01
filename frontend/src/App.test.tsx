import { render, screen } from '@testing-library/react';
import App from './App';

test('mostra il titolo "Monster Vault"', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /monster vault/i })).toBeTruthy();
});
