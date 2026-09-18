import { render, screen } from '@testing-library/react';
import { TabParts } from './TabParts';

test('rende ogni parte, separate da "/"', () => {
  const { container } = render(
    <TabParts
      parts={[
        { text: 'GOLD', color: '#caa62e' },
        { text: 'BLACK', color: undefined },
      ]}
    />,
  );
  expect(container.textContent).toBe('GOLD/BLACK');
});

test('la parte colorata prende il colore, quella senza no', () => {
  render(
    <TabParts
      parts={[
        { text: 'GOLD', color: 'rgb(202, 166, 46)' },
        { text: 'BLACK', color: undefined },
      ]}
    />,
  );
  expect(screen.getByText('GOLD').style.color).toBe('rgb(202, 166, 46)');
  expect(screen.getByText('BLACK').getAttribute('style')).toBeNull();
});

test('parti con lo stesso testo non generano avvisi di chiave duplicata', () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<TabParts parts={[{ text: 'RED' }, { text: 'RED' }]} />);
  expect(err).not.toHaveBeenCalled();
  err.mockRestore();
});
