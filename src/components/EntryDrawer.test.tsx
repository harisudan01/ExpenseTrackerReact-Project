import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EntryDrawer, { type DrawerState } from './EntryDrawer';
import type { ExpenseEntry } from '../types';
import { apiEntry, mockApi, renderWithProviders } from '../test/utils';

const existing: ExpenseEntry = {
  id: 5,
  bookId: 1,
  date: new Date(2026, 10, 1),
  time: '09:30',
  amount: 250,
  category: 'Food',
  paymode: 'Cash Out',
  party: 'Cafe',
  remarks: 'Breakfast',
};

const renderDrawer = (state: DrawerState | null, canEdit = true) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onSwitchToEdit = vi.fn();
  const utils = renderWithProviders(
    <EntryDrawer
      state={state}
      bookId={1}
      canEdit={canEdit}
      knownParties={['Cafe', 'Cafe', 'Landlord']}
      onClose={onClose}
      onSaved={onSaved}
      onSwitchToEdit={onSwitchToEdit}
    />,
  );
  return { ...utils, onClose, onSaved, onSwitchToEdit };
};

const panel = () => screen.getAllByRole('dialog')[0];

describe('EntryDrawer', () => {
  it('renders nothing without a state', () => {
    renderDrawer(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a new Cash In entry with today prefilled', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 5, 14, 7));
    renderDrawer({ kind: 'new', type: 'Cash In' });
    expect(screen.getByRole('heading', { name: 'Add Cash In Entry' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date/)).toHaveValue('2026-11-05');
    expect(screen.getByLabelText(/^Time/)).toHaveValue('14:07');
    expect(screen.getByLabelText(/Amount/)).toHaveValue(null);
    vi.useRealTimers();
  });

  it('validates the amount', async () => {
    const { user, calls } = { ...renderDrawer({ kind: 'new', type: 'Cash Out' }), calls: mockApi({}).calls };
    const amount = screen.getByLabelText(/Amount/);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Amount is required')).toBeInTheDocument();

    await user.type(amount, '0.5');
    expect(screen.getByText('Amount must be at least 1')).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, '1000001');
    expect(screen.getByText(/cannot be greater than 10,00,000/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('creates an entry with the form values and closes', async () => {
    const { calls } = mockApi({ 'POST /books/:id/entries': () => ({ status: 201, body: apiEntry() }) });
    const { user, onSaved, onClose } = renderDrawer({ kind: 'new', type: 'Cash In' });

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.type(screen.getByLabelText(/Amount/), '499.5');
    await user.clear(screen.getByLabelText(/^Date/));
    await user.type(screen.getByLabelText(/^Date/), '2026-10-31');
    await user.selectOptions(screen.getByLabelText('Category'), 'Fuel');
    await user.type(screen.getByLabelText('Party Name'), '  Pump  ');
    await user.type(screen.getByLabelText('Remarks'), 'Full tank');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
    expect(calls[0].path).toBe('/books/1/entries');
    expect(calls[0].body).toMatchObject({
      transaction_date: '2026-10-31',
      amount: 499.5,
      category: 'Fuel',
      transaction_type: 'Cash Out',
      party: 'Pump',
      remarks: 'Full tank',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Entry added successfully');
  });

  it('"Save & Add New" keeps the drawer open with a fresh form of the same type', async () => {
    mockApi({ 'POST /books/:id/entries': () => ({ status: 201, body: apiEntry() }) });
    const { user, onClose, onSaved } = renderDrawer({ kind: 'new', type: 'Cash Out' });
    await user.type(screen.getByLabelText(/Amount/), '20');
    await user.click(screen.getByRole('button', { name: 'Save & Add New' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Amount/)).toHaveValue(null);
    expect(screen.getByRole('heading', { name: 'Add Cash Out Entry' })).toBeInTheDocument();
  });

  it('edits an existing entry', async () => {
    const { calls } = mockApi({ 'PUT /entries/:id': () => ({ body: apiEntry({ id: 5 }) }) });
    const { user, onClose } = renderDrawer({ kind: 'edit', entry: existing });
    expect(screen.getByRole('heading', { name: 'Edit Cash Out Entry' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/)).toHaveValue(250);
    expect(screen.getByLabelText('Category')).toHaveValue('Food');
    expect(screen.queryByRole('button', { name: 'Save & Add New' })).not.toBeInTheDocument();

    const amount = screen.getByLabelText(/Amount/);
    await user.clear(amount);
    await user.type(amount, '300');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls[0]).toMatchObject({ method: 'PUT', path: '/entries/5' });
    expect(calls[0].body).toMatchObject({ amount: 300, transaction_time: '09:30', party: 'Cafe' });
    expect(screen.getByRole('status')).toHaveTextContent('Entry updated successfully');
  });

  it('keeps an unknown category from older data selectable', () => {
    renderDrawer({ kind: 'edit', entry: { ...existing, category: 'Pets' } });
    expect(screen.getByLabelText('Category')).toHaveValue('Pets');
  });

  it('shows a server error and stays open', async () => {
    mockApi({ 'PUT /entries/:id': () => ({ status: 422, body: { detail: 'Amount too large' } }) });
    const { user, onClose } = renderDrawer({ kind: 'edit', entry: existing });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Amount too large');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('view mode is read-only and offers Edit when allowed', async () => {
    const { user, onSwitchToEdit } = renderDrawer({ kind: 'view', entry: existing });
    expect(screen.getByRole('heading', { name: 'View Cash Out Entry' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /cash in/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit entry/i }));
    expect(onSwitchToEdit).toHaveBeenCalledWith(existing);
  });

  it('view mode in a view-only book has no Edit button', () => {
    renderDrawer({ kind: 'view', entry: existing }, false);
    expect(screen.queryByRole('button', { name: /edit entry/i })).not.toBeInTheDocument();
  });

  it('closes straight away when nothing changed', async () => {
    const { user, onClose } = renderDrawer({ kind: 'edit', entry: existing });
    await user.click(within(panel()).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('asks before discarding unsaved changes', async () => {
    const { user, onClose } = renderDrawer({ kind: 'new', type: 'Cash In' });
    await user.type(screen.getByLabelText(/Amount/), '5');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    const confirm = screen.getAllByRole('dialog').at(-1)!;
    expect(confirm).toHaveTextContent('unsaved changes');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}'); // drawer is topmost again
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Yes' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('suggests known parties without duplicates', () => {
    renderDrawer({ kind: 'new', type: 'Cash In' });
    const options = [...document.querySelectorAll('#party-options option')].map((o) => o.getAttribute('value'));
    expect(options).toEqual(['Cafe', 'Landlord', 'Sudan', 'Customer', 'Other']);
  });
});
