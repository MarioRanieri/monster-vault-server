import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';

test('digitando nella ricerca chiama onQuery', async () => {
  const onQuery = vi.fn();
  render(<FilterBar query="" onQuery={onQuery} chips={[]} />);
  await userEvent.type(screen.getByRole('searchbox'), 'x');
  expect(onQuery).toHaveBeenCalled();
});

test('un chip mostra label + count e chiama onToggle al clic', async () => {
  const onToggle = vi.fn();
  render(
    <FilterBar
      query=""
      onQuery={() => {}}
      chips={[
        {
          key: 'promo',
          label: 'Promo',
          cls: 'filter-chip-promo',
          active: false,
          count: 7,
          onToggle,
        },
      ]}
    />,
  );
  const chip = screen.getByRole('button', { name: /promo/i });
  expect(chip.textContent).toContain('7');
  await userEvent.click(chip);
  expect(onToggle).toHaveBeenCalled();
});

test('un select mostra le opzioni e chiama onChange', async () => {
  const onChange = vi.fn();
  render(
    <FilterBar
      query=""
      onQuery={() => {}}
      chips={[]}
      selects={[
        {
          key: 'c',
          allLabel: 'ALL COUNTRIES',
          value: '',
          options: ['USA', 'Italy'],
          onChange,
        },
      ]}
    />,
  );
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /all countries/i }), 'USA');
  expect(onChange).toHaveBeenCalledWith('USA');
});

test('un range chiama onMin/onMax e il reset chiama onReset', async () => {
  const onMin = vi.fn();
  const onReset = vi.fn();
  render(
    <FilterBar
      query=""
      onQuery={() => {}}
      chips={[]}
      ranges={[{ key: 'price', sep: '€', min: '', max: '', onMin, onMax: () => {} }]}
      onReset={onReset}
    />,
  );
  await userEvent.type(screen.getByLabelText('price min'), '5');
  expect(onMin).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /reset/i }));
  expect(onReset).toHaveBeenCalled();
});

test('il view-toggle chiama onChange', async () => {
  const onChange = vi.fn();
  render(<FilterBar query="" onQuery={() => {}} chips={[]} view={{ value: 'grid', onChange }} />);
  await userEvent.click(screen.getByRole('button', { name: /list view/i }));
  expect(onChange).toHaveBeenCalledWith('list');
});

test('il sort chiama onChange', async () => {
  const onChange = vi.fn();
  render(
    <FilterBar
      query=""
      onQuery={() => {}}
      chips={[]}
      sort={{
        value: 'nome-asc',
        options: [
          { value: 'nome-asc', label: 'NAME' },
          { value: 'valore-desc', label: 'VALUE' },
        ],
        onChange,
      }}
    />,
  );
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'valore-desc');
  expect(onChange).toHaveBeenCalledWith('valore-desc');
});

test('il bottone Reset è fuori dal pannello filtri avanzati (sempre cliccabile)', () => {
  render(<FilterBar query="" onQuery={() => {}} chips={[]} onReset={() => {}} />);
  const reset = screen.getByRole('button', { name: /reset/i });
  expect(reset.closest('.filter-advanced')).toBeNull();
});

test('senza noValueToggle il bottone "No value" non compare (solo admin)', () => {
  render(<FilterBar query="" onQuery={() => {}} chips={[]} />);
  expect(screen.queryByRole('button', { name: /no value/i })).toBeNull();
});

test('"No value" mostra il count, è fuori dal pannello filtri avanzati e chiama onToggle', async () => {
  const onToggle = vi.fn();
  render(
    <FilterBar
      query=""
      onQuery={() => {}}
      chips={[]}
      noValueToggle={{ active: false, count: 7, onToggle }}
    />,
  );
  const btn = screen.getByRole('button', { name: /no value/i });
  expect(btn.closest('.filter-advanced')).toBeNull();
  expect(btn).toHaveTextContent('7');
  await userEvent.click(btn);
  expect(onToggle).toHaveBeenCalled();
});

test('il pulsante Filters apre/chiude il pannello filtri avanzati', async () => {
  const user = userEvent.setup();
  render(<FilterBar query="" onQuery={() => {}} chips={[]} />);
  const toggle = screen.getByRole('button', { name: /filters/i });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
