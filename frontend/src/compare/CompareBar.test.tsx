import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompareBar } from './CompareBar';

test('vuota non renderizza nulla', () => {
  const { container } = render(
    <CompareBar cans={[]} onRemove={() => {}} onOpen={() => {}} onClear={() => {}} />,
  );
  expect(container).toBeEmptyDOMElement();
});

test('con 1 sola can il bottone Compare è disabilitato', () => {
  render(
    <CompareBar
      cans={[{ id: '1', nome: 'Alpha' }]}
      onRemove={() => {}}
      onOpen={() => {}}
      onClear={() => {}}
    />,
  );
  expect(screen.getByRole('button', { name: /compare \(1\)/i })).toBeDisabled();
});

test('rimuove uno slot e apre il confronto con >=2', async () => {
  const onRemove = vi.fn();
  const onOpen = vi.fn();
  render(
    <CompareBar
      cans={[
        { id: '1', nome: 'Alpha' },
        { id: '2', nome: 'Beta' },
      ]}
      onRemove={onRemove}
      onOpen={onOpen}
      onClear={() => {}}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /remove alpha/i }));
  expect(onRemove).toHaveBeenCalledWith('1');
  await userEvent.click(screen.getByRole('button', { name: /compare \(2\)/i }));
  expect(onOpen).toHaveBeenCalled();
});
