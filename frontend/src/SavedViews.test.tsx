import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavedViews } from './SavedViews';
import type { ShareFilters } from './shareView';

const f: ShareFilters = {
  query: 'ripper',
  lingua: '',
  size: '',
  produttore: '',
  top: '',
  promo: false,
  full: false,
  withPhoto: false,
  noPhoto: false,
  vmin: '',
  vmax: '',
  ymin: '',
  ymax: '',
  sort: 'added-desc',
};

beforeEach(() => localStorage.clear());

test('salva la vista corrente e la riapplica', async () => {
  vi.stubGlobal(
    'prompt',
    vi.fn(() => 'My view'),
  );
  const onApply = vi.fn();
  render(<SavedViews current={f} onApply={onApply} />);

  await userEvent.click(screen.getByRole('button', { name: /views/i }));
  await userEvent.click(screen.getByRole('button', { name: /save current view/i }));
  await userEvent.click(screen.getByRole('button', { name: 'My view' }));

  expect(onApply).toHaveBeenCalledWith(f);
});

test('elimina una vista salvata', async () => {
  vi.stubGlobal(
    'prompt',
    vi.fn(() => 'V1'),
  );
  render(<SavedViews current={f} onApply={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: /views/i }));
  await userEvent.click(screen.getByRole('button', { name: /save current view/i }));
  await userEvent.click(screen.getByRole('button', { name: /delete v1/i }));

  expect(screen.getByText(/no saved views/i)).toBeTruthy();
});
