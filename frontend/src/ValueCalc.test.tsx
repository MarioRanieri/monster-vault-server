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
  expect(screen.getByText('€40')).toBeTruthy(); // valore totale
});

test('Close chiama onClose', async () => {
  const onClose = vi.fn();
  render(<ValueCalc cans={[]} onClose={onClose} />);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});
