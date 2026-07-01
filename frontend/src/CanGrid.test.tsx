import { render, screen } from '@testing-library/react';
import { CanGrid } from './CanGrid';
import type { Can } from './types';

test('renderizza una card per ogni can col suo nome', () => {
  const cans: Can[] = [
    { id: '1', nome: 'Alpha' },
    { id: '2', nome: 'Beta' },
  ];

  render(<CanGrid cans={cans} />);

  expect(screen.getByText('Alpha')).toBeTruthy();
  expect(screen.getByText('Beta')).toBeTruthy();
});
