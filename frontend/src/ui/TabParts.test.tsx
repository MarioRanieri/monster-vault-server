import { render, screen } from '@testing-library/react';
import { TabBadge, TabParts } from './TabParts';
import { colorizeTab } from './colorizeTab';

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

test('TabBadge: riquadro sempre, col fondo del top quando esiste', () => {
  const { container, rerender } = render(<TabBadge tab={colorizeTab('BLACK/PINK')} />);
  const badge = container.querySelector('.tab-badge') as HTMLElement;
  expect(badge).toBeTruthy();
  expect(badge.style.background).toBe('rgb(17, 17, 17)');
  expect(badge.textContent).toBe('BLACK/PINK');

  // tappo senza fondo noto: resta un riquadro, ma senza colore di sfondo
  rerender(<TabBadge tab={colorizeTab('SILVER/GOLD')} />);
  const plain = container.querySelector('.tab-badge') as HTMLElement;
  expect(plain).toBeTruthy();
  expect(plain.style.background).toBe('');
  expect(plain.textContent).toBe('SILVER/GOLD');
});

test('TabBadge: tappo vuoto non rende nulla', () => {
  const { container } = render(<TabBadge tab={colorizeTab('')} />);
  expect(container.textContent).toBe('');
});
