import { render } from '@testing-library/react';
import { Flags } from './flags';

test('Flags rende bandiere ISO, custom-url, emoji e separatori', () => {
  // ITALY -> ISO img, UTAH -> custom url img, CARIBBEAN -> emoji, con separatori
  const { container } = render(<Flags lingua="ITALY / UTAH -> CARIBBEAN" />);
  expect(container.querySelectorAll('.flag-img').length).toBeGreaterThanOrEqual(2);
  expect(container.querySelector('.flag-emoji')).toBeTruthy();
  expect(container.querySelector('.flag-sep')).toBeTruthy();
});

test('Flags con valore sconosciuto mostra il testo', () => {
  const { getByText } = render(<Flags lingua="Zzz" />);
  expect(getByText('Zzz')).toBeTruthy();
});

test('Flags vuoto non rende nulla', () => {
  const { container } = render(<Flags lingua="" />);
  expect(container.firstChild).toBeNull();
});
