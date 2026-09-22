import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { matchSuggestions, SuggestInput } from './SuggestInput';

test('matchSuggestions: sottostringa case-insensitive, prima i prefissi, esclude il valore esatto', () => {
  const values = ['BALL', 'CROWN', 'REXAM BALL', 'Ball Corp'];
  expect(matchSuggestions(values, 'ball')).toEqual(['Ball Corp', 'REXAM BALL']);
  expect(matchSuggestions(values, 'row')).toEqual(['CROWN']);
  expect(matchSuggestions(values, '')).toEqual(values);
  expect(matchSuggestions(values, 'a', 2)).toHaveLength(2);
});

function Harness({ multiline = false }: Readonly<{ multiline?: boolean }>) {
  const [v, setV] = useState('');
  return (
    <>
      <label htmlFor="f">Field</label>
      <SuggestInput
        id="f"
        value={v}
        onChange={setV}
        suggestions={['Small logo 0920 design', 'Silver symbols design', 'First sku']}
        multiline={multiline}
      />
      <output>{v}</output>
    </>
  );
}

test('digitando mostra i suggerimenti che contengono il testo e il click ne sceglie uno', async () => {
  render(<Harness />);
  await userEvent.type(screen.getByLabelText('Field'), 'design');
  const opts = screen.getAllByRole('option').map((o) => o.textContent);
  expect(opts).toEqual(['Small logo 0920 design', 'Silver symbols design']);
  await userEvent.click(screen.getByRole('option', { name: 'Silver symbols design' }));
  expect(screen.getByRole('status').textContent).toBe('Silver symbols design');
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('frecce + Invio scelgono; Escape chiude la lista senza propagarsi', async () => {
  const onWindowEsc = vi.fn();
  globalThis.addEventListener('keydown', onWindowEsc);
  render(<Harness />);
  const input = screen.getByLabelText('Field');
  await userEvent.type(input, 's');
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  expect(screen.getByRole('status').textContent).toBe('Silver symbols design');

  await userEvent.clear(input);
  await userEvent.type(input, 'sku');
  expect(screen.getByRole('listbox')).toBeTruthy();
  onWindowEsc.mockClear();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(onWindowEsc).not.toHaveBeenCalled();
  globalThis.removeEventListener('keydown', onWindowEsc);
});

test('input a riga singola: al focus da vuoto mostra tutti i valori', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByLabelText('Field'));
  expect(screen.getAllByRole('option')).toHaveLength(3);
});

test('multiline (More Info): da vuoto non mostra nulla, digitando sì', async () => {
  render(<Harness multiline />);
  const ta = screen.getByLabelText('Field');
  expect(ta.tagName).toBe('TEXTAREA');
  await userEvent.click(ta);
  expect(screen.queryByRole('listbox')).toBeNull();
  await userEvent.type(ta, 'logo');
  expect(screen.getAllByRole('option')).toHaveLength(1);
});
