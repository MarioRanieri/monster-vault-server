import { render, screen } from '@testing-library/react';
import { StatsBar } from './StatsBar';

test('mostra etichette e valori delle statistiche', () => {
  render(<StatsBar stats={{ total: 10, withPhoto: 7, promo: 3 }} />);
  expect(screen.getByText('Totale')).toBeTruthy();
  expect(screen.getByText('10')).toBeTruthy();
  expect(screen.getByText('Con foto')).toBeTruthy();
  expect(screen.getByText('7')).toBeTruthy();
  expect(screen.getByText('In promo')).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy();
});
