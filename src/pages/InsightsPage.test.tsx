import { screen, waitFor } from '@testing-library/react';
import { Route, useLocation, useParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import InsightsPage from './InsightsPage';
import { decodeId, encodeId } from '../lib/crypto';
import { setSignedIn } from '../lib/session';
import { apiEntry, book, mockApi, renderWithProviders, testUser } from '../test/utils';
import type { ExpenseEntryApi } from '../types';

const ENTRIES: Record<number, ExpenseEntryApi[]> = {
  1: [
    apiEntry({ id: 2, book_id: 1, transaction_date: '2026-11-02', amount: 300, transaction_type: 'Cash Out', category: 'Food' }),
    apiEntry({ id: 1, book_id: 1, transaction_date: '2026-11-01', amount: 1000, transaction_type: 'Cash In', category: null }),
  ],
  2: [apiEntry({ id: 3, book_id: 2, transaction_date: '2026-10-15', amount: 500, transaction_type: 'Cash Out', category: 'Rent' })],
};

// Encoded ids differ on every call, so the stand-in book page shows the decoded one
function BookPage() {
  const { id, mode } = useParams();
  const { search } = useLocation();
  return <p>{`book ${decodeId(id)} ${mode}${search}`}</p>;
}

const renderInsights = (route = '/expenseApp/insights', books = [book({ id: 1, name: 'Household' }), book({ id: 2, name: 'Office' })]) => {
  setSignedIn(true);
  localStorage.clear();
  const api = mockApi({
    'GET /auth/me': () => ({ body: testUser }),
    'GET /books': () => ({ body: books }),
    'GET /books/:id/entries': (req) => ({ body: ENTRIES[Number(req.path.split('/')[2])] ?? [] }),
  });
  const utils = renderWithProviders(<InsightsPage />, {
    route,
    path: '/expenseApp/insights',
    withAuth: true,
    extraRoutes: <Route path="/expenseApp/:id/:mode" element={<BookPage />} />,
  });
  return { ...utils, ...api };
};

const legendValue = (label: string) => screen.getByText(label, { selector: 'span' }).nextElementSibling?.textContent;

describe('InsightsPage', () => {
  it('combines all books by default', async () => {
    const { calls } = renderInsights();
    expect(await screen.findByText('All books · all dates')).toBeInTheDocument();
    expect(calls.filter((c) => c.path.endsWith('/entries')).map((c) => c.path)).toEqual(['/books/1/entries', '/books/2/entries']);
    expect(legendValue('Cash In')).toBe('₹1,000');
    expect(legendValue('Cash Out')).toBe('₹800');
    // Category bars only link through to a single book
    expect(screen.queryByTitle('Show Food entries')).not.toBeInTheDocument();
  });

  it('shows one book picked in the menu, and links a category to that book', async () => {
    const { user } = renderInsights();
    await screen.findByText('All books · all dates');
    await user.selectOptions(screen.getByRole('combobox'), 'Household');

    expect(await screen.findByText('Household · all dates')).toBeInTheDocument();
    await waitFor(() => expect(legendValue('Cash Out')).toBe('₹300'));

    await user.click(screen.getByTitle('Show Food entries'));
    expect(screen.getByText('book 1 view?q=Food')).toBeInTheDocument();
  });

  it('opens on the book given in the link', async () => {
    renderInsights(`/expenseApp/insights?book=${encodeId(2)}`);
    expect(await screen.findByText('Office · all dates')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('2');
  });

  it('filters by date', async () => {
    const { user } = renderInsights();
    await screen.findByText('All books · all dates');
    await user.type(screen.getByLabelText('From date'), '2026-11-01');
    expect(screen.getByText('All books · selected dates')).toBeInTheDocument();
    expect(legendValue('Cash Out')).toBe('₹300');

    await user.click(screen.getByRole('button', { name: /clear dates/i }));
    expect(legendValue('Cash Out')).toBe('₹800');
  });

  it('points to My Books when there are no books', async () => {
    renderInsights('/expenseApp/insights', []);
    expect(await screen.findByText('No books yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to My Books' })).toHaveAttribute('href', '/expenseApp/list');
  });
});
