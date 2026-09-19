import { render, screen } from '@testing-library/react';
import { Hero } from './Hero';

test('mostra il conteggio grande una sola volta, senza ripetere "Total"', () => {
  render(<Hero stats={{ total: 1866, withPhoto: 355, promo: 315, countries: 99, full: 281 }} />);
  expect(screen.getByText(/cans/i)).toBeTruthy();
  expect(screen.getAllByText('1866').length).toBe(1); // un solo posto, non più hero-count + Total
  expect(screen.queryByText('Total')).toBeNull(); // stat-item "Total" rimosso: ridondante col numero grande
  expect(screen.getByText('99')).toBeTruthy(); // Countries
  expect(screen.getByText('355')).toBeTruthy(); // With Photo
  expect(screen.getByText('281')).toBeTruthy(); // Full
});

test('colora il numero With Photo come il chip (viola)', () => {
  render(<Hero stats={{ total: 1866, withPhoto: 355, promo: 315, countries: 99, full: 281 }} />);
  const val = screen.getByText('355'); // With Photo
  expect(val.style.color.replace(/\s/g, '')).toMatch(/168,85,247|a855f7/i);
});
