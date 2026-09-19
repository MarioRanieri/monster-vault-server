import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValueCalc } from './ValueCalc';

test('mostra conteggio e valore totale delle lattine filtrate', () => {
  render(
    <ValueCalc
      cans={[
        { id: '1', nome: 'a', valore: '10' },
        { id: '2', nome: 'b', valore: '30' },
        { id: '3', nome: 'c' },
      ]}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText('3')).toBeTruthy(); // cans totali (filtrate)
  expect(screen.getByText('â‚¬40')).toBeTruthy(); // valore totale
});

test('Close chiama onClose', async () => {
  const onClose = vi.fn();
  render(<ValueCalc cans={[]} onClose={onClose} />);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

test('ESC chiama onClose', async () => {
  const onClose = vi.fn();
  render(<ValueCalc cans={[]} onClose={onClose} />);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});

test('la modale è un <dialog> nativo', () => {
  render(<ValueCalc cans={[]} onClose={() => {}} />);
  expect(screen.getByRole('dialog').tagName).toBe('DIALOG');
});
