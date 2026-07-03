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
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /ordina/i }), 'valore-desc');
  expect(onChange).toHaveBeenCalledWith('valore-desc');
});
