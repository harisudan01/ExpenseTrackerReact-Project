import { screen, waitFor, within } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import BookDetail from './BookDetail';
import { encodeId } from '../lib/crypto';
import { setToken } from '../lib/session';
import { apiEntry, book, mockApi, renderWithProviders, testUser, type FakeRequest } from '../test/utils';
import type { ExpenseEntryApi } from '../types';

type Routes = Parameters<typeof mockApi>[0];

// Newest first, as the API returns them
const ENTRIES: ExpenseEntryApi[] = [
  apiEntry({ id: 3, transaction_date: '2026-11-03', amount: 200, transaction_type: 'Cash Out', category: 'Fuel', party: 'Pump', remarks: 'Petrol' }),
  apiEntry({ id: 2, transaction_date: '2026-11-02', amount: 300, transaction_type: 'Cash Out', category: 'Food', party: 'Cafe', remarks: 'Dinner' }),
  apiEntry({ id: 1, transaction_date: '2026-11-01', amount: 1000, transaction_type: 'Cash In', category: null, party: null, remarks: 'Salary', transaction_time: null }),
];

const renderDetail = (
  { mode = 'edit', entries = ENTRIES, extra = {}, token }: { mode?: string; entries?: ExpenseEntryApi[]; extra?: Routes; token?: string } = {},
) => {
  setToken('tok');
  const api = mockApi({
    'GET /auth/me': () => ({ body: testUser }),
    'GET /books/:id': () => ({ body: book({ id: 1, name: 'Household' }) }),
    'GET /books/:id/entries': () => ({ body: entries }),
    ...extra,
  });
  const utils = renderWithProviders(<BookDetail />, {
    route: `/expenseApp/${token ?? encodeId(1)}/${mode}`,
    path: '/expenseApp/:id/:mode',
    withAuth: true,
    extraRoutes: <Route path="/expenseApp/list" element={<p>books page</p>} />,
  });
  return { ...utils, ...api };
};

const table = () => screen.getByRole('table');
const bodyRows = () => within(table()).getAllByRole('row').slice(1);
const card = (label: string) => screen.getByText(label).closest('.card') as HTMLElement;

describe('BookDetail', () => {
  it('shows the book name, mode, entry count and totals', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Household' })).toBeInTheDocument();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    expect(screen.getByText(/Editing entries/)).toBeInTheDocument();
    expect(screen.getByText(/3 entries/)).toBeInTheDocument();
    expect(card('Total Cash In')).toHaveTextContent('₹1,000');
    expect(card('Total Cash Out')).toHaveTextContent('₹500');
    expect(card('Net Balance')).toHaveTextContent('₹500');
  });

  it('lists entries newest first with running balances', async () => {
    renderDetail();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    const [petrol, dinner, salary] = bodyRows();
    expect(petrol).toHaveTextContent('03 Nov 2026');
    expect(petrol).toHaveTextContent('−₹200');
    expect(petrol).toHaveTextContent('₹500'); // balance after all three
    expect(dinner).toHaveTextContent('₹700');
    expect(salary).toHaveTextContent('+₹1,000');
    expect(salary).toHaveTextContent('—'); // no time / category / party
  });

  it('shows a negative balance in red', async () => {
    renderDetail({ entries: [apiEntry({ id: 1, amount: 50, transaction_type: 'Cash Out' })] });
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(card('Net Balance')).toHaveTextContent('-₹50');
    expect(within(card('Net Balance')).getByText('-₹50')).toHaveClass('text-rose-600');
  });

  it('goes back to the book list', async () => {
    const { user } = renderDetail();
    await user.click(await screen.findByTitle('Back to books'));
    expect(screen.getByText('books page')).toBeInTheDocument();
  });

  describe('view-only mode', () => {
    it('hides add buttons and disables edit/delete', async () => {
      renderDetail({ mode: 'view' });
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      expect(screen.getByText(/View only/)).toBeInTheDocument();
      // the green add buttons are gone; only the type-filter tabs remain
      expect(document.querySelector('.btn-in, .btn-out')).toBeNull();
      const first = bodyRows()[0];
      expect(within(first).getByTitle(/edit mode to change/)).toBeDisabled();
      expect(within(first).getByTitle(/edit mode to delete/)).toBeDisabled();
      expect(within(first).getByTitle('View entry')).toBeEnabled();
    });

    it('says the book has no entries', async () => {
      renderDetail({ mode: 'view', entries: [] });
      expect(await screen.findByText('This book has no entries.')).toBeInTheDocument();
    });
  });

  describe('bad links and errors', () => {
    it('redirects an invalid link back to the list', async () => {
      renderDetail({ token: 'garbage' });
      expect(await screen.findByText('books page')).toBeInTheDocument();
      expect(screen.getByText('Invalid book link')).toBeInTheDocument();
    });

    it('redirects when the book does not exist (or is not yours)', async () => {
      renderDetail({ extra: { 'GET /books/:id': () => ({ status: 404, body: { detail: 'Expense book not found' } }) } });
      expect(await screen.findByText('books page')).toBeInTheDocument();
      expect(screen.getByText('Expense book not found')).toBeInTheDocument();
    });

    it('stays on the page for other book errors', async () => {
      renderDetail({ extra: { 'GET /books/:id': () => ({ status: 500, body: { detail: 'Server hiccup' } }) } });
      expect(await screen.findByText('Server hiccup')).toBeInTheDocument();
      expect(screen.queryByText('books page')).not.toBeInTheDocument();
    });

    it('shows an error when entries fail to load', async () => {
      renderDetail({ extra: { 'GET /books/:id/entries': () => ({ status: 500, body: { detail: 'Entries down' } }) } });
      expect(await screen.findByText('Entries down')).toBeInTheDocument();
    });
  });

  describe('empty book', () => {
    it('offers Cash In / Cash Out buttons that open the drawer', async () => {
      const { user } = renderDetail({ entries: [] });
      expect(await screen.findByText('No entries yet')).toBeInTheDocument();
      const emptyCard = screen.getByText('No entries yet').parentElement!;
      await user.click(within(emptyCard).getByRole('button', { name: /cash out/i }));
      expect(screen.getByRole('heading', { name: 'Add Cash Out Entry' })).toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('searches remarks, category, party and amount', async () => {
      const { user } = renderDetail();
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      const search = screen.getByPlaceholderText(/search remarks/i);

      await user.type(search, 'cafe');
      expect(bodyRows()).toHaveLength(1);
      expect(bodyRows()[0]).toHaveTextContent('Dinner');

      await user.clear(search);
      await user.type(search, '1000');
      expect(bodyRows()[0]).toHaveTextContent('Salary');
    });

    it('filters by Cash In / Cash Out', async () => {
      const { user } = renderDetail();
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      const typeFilter = screen.getByRole('button', { name: 'All' }).parentElement!;
      await user.click(within(typeFilter).getByRole('button', { name: 'Cash Out' }));
      expect(bodyRows()).toHaveLength(2);
      await user.click(within(typeFilter).getByRole('button', { name: 'Cash In' }));
      expect(bodyRows()).toHaveLength(1);
      // balances stay the book's real running balance even when filtered
      expect(bodyRows()[0]).toHaveTextContent('₹1,000');
    });

    it('filters by date range and can be cleared', async () => {
      const { user } = renderDetail();
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      await user.type(screen.getByLabelText('From date'), '2026-11-02');
      expect(bodyRows()).toHaveLength(2);
      await user.type(screen.getByLabelText('To date'), '2026-11-02');
      expect(bodyRows()).toHaveLength(1);

      await user.click(screen.getByTitle('Clear filters'));
      expect(bodyRows()).toHaveLength(3);
    });

    it('shows "no matching entries" with a clear button', async () => {
      const { user } = renderDetail();
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      await user.type(screen.getByPlaceholderText(/search remarks/i), 'zzz');
      expect(screen.getByText('No matching entries')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /clear filters/i }));
      expect(bodyRows()).toHaveLength(3);
    });
  });

  describe('pagination', () => {
    const many = Array.from({ length: 23 }, (_, i) =>
      apiEntry({ id: 100 - i, transaction_date: `2026-10-${String(28 - i).padStart(2, '0')}`, remarks: `Item ${i + 1}` }),
    );

    it('pages through entries and changes page size', async () => {
      const { user } = renderDetail({ entries: many });
      await waitFor(() => expect(bodyRows()).toHaveLength(10));
      expect(screen.getByText('1–10 of 23')).toBeInTheDocument();
      expect(screen.getByLabelText('Previous page')).toBeDisabled();

      await user.click(screen.getByLabelText('Next page'));
      expect(screen.getByText('11–20 of 23')).toBeInTheDocument();
      expect(bodyRows()[0]).toHaveTextContent('Item 11');

      await user.click(screen.getByLabelText('Next page'));
      expect(screen.getByText('21–23 of 23')).toBeInTheDocument();
      expect(screen.getByLabelText('Next page')).toBeDisabled();

      await user.click(screen.getByLabelText('Previous page'));
      expect(screen.getByText('11–20 of 23')).toBeInTheDocument();

      await user.selectOptions(screen.getByRole('combobox'), '40');
      expect(bodyRows()).toHaveLength(23);
      expect(screen.getByText('1–23 of 23')).toBeInTheDocument();
    });

    it('jumps back to page 1 when a filter changes', async () => {
      const { user } = renderDetail({ entries: many });
      await waitFor(() => expect(bodyRows()).toHaveLength(10));
      await user.click(screen.getByLabelText('Next page'));
      await user.type(screen.getByPlaceholderText(/search remarks/i), 'Item');
      expect(screen.getByText('1–10 of 23')).toBeInTheDocument();
    });
  });

  describe('entry actions', () => {
    it('deletes an entry after confirmation and recalculates', async () => {
      const { user, calls } = renderDetail({ extra: { 'DELETE /entries/:id': () => ({ body: { message: 'ok' } }) } });
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      await user.click(within(bodyRows()[1]).getByTitle('Delete entry'));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('Cash Out entry of ₹300');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(bodyRows()).toHaveLength(2));
      expect(calls.find((c) => c.method === 'DELETE')!.path).toBe('/entries/2');
      expect(card('Total Cash Out')).toHaveTextContent('₹200');
      expect(bodyRows()[0]).toHaveTextContent('₹800'); // 1000 - 200
      expect(screen.getByText('Entry deleted successfully')).toBeInTheDocument();
    });

    it('keeps the entry when deletion is cancelled', async () => {
      const { user, calls } = renderDetail();
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      await user.click(within(bodyRows()[0]).getByTitle('Delete entry'));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(bodyRows()).toHaveLength(3);
      expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    });

    it('shows an error if deleting fails', async () => {
      const { user } = renderDetail({
        extra: { 'DELETE /entries/:id': () => ({ status: 500, body: { detail: 'Delete failed' } }) },
      });
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      await user.click(within(bodyRows()[0]).getByTitle('Delete entry'));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('Delete failed')).toBeInTheDocument();
      expect(bodyRows()).toHaveLength(3);
    });

    it('opens an entry in view mode, then switches to edit', async () => {
      const { user } = renderDetail();
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      await user.click(within(bodyRows()[1]).getByTitle('View entry'));
      expect(screen.getByRole('heading', { name: 'View Cash Out Entry' })).toBeInTheDocument();
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /edit entry/i }));
      expect(screen.getByRole('heading', { name: 'Edit Cash Out Entry' })).toBeInTheDocument();
    });

    it('reloads entries after adding one from the header button', async () => {
      let saved = false;
      const { user, calls } = renderDetail({
        extra: {
          'GET /books/:id/entries': () => ({
            body: saved ? [apiEntry({ id: 9, transaction_type: 'Cash In', amount: 50, remarks: 'Gift' }), ...ENTRIES] : ENTRIES,
          }),
          'POST /books/:id/entries': (req: FakeRequest) => {
            saved = true;
            return { status: 201, body: apiEntry({ id: 9, ...(req.body as object) }) };
          },
        },
      });
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      await user.click(screen.getAllByRole('button', { name: /cash in/i })[0]);
      await user.type(screen.getByLabelText(/Amount/), '50');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(bodyRows()).toHaveLength(4));
      expect(bodyRows()[0]).toHaveTextContent('Gift');
      expect(calls.filter((c) => c.path === '/books/1/entries' && c.method === 'GET')).toHaveLength(2);
    });

    it('opens the edit drawer from a row', async () => {
      const { user } = renderDetail();
      await waitFor(() => expect(bodyRows()).toHaveLength(3));
      await user.click(within(bodyRows()[2]).getByTitle('Edit entry'));
      expect(screen.getByRole('heading', { name: 'Edit Cash In Entry' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Amount/)).toHaveValue(1000);
    });
  });

  it('also renders the mobile card list', async () => {
    renderDetail();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    const mobileList = document.querySelector('ul.lg\\:hidden')!;
    expect(within(mobileList as HTMLElement).getAllByRole('listitem')).toHaveLength(3);
    expect(mobileList).toHaveTextContent('Bal ₹500');
  });
});
