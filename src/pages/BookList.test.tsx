import { screen, waitFor, within } from '@testing-library/react';
import { Route, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookList from './BookList';
import { decodeId } from '../lib/crypto';
import { setSignedIn } from '../lib/session';
import { apiEntry, book, mockApi, renderWithProviders, testUser, type FakeRequest } from '../test/utils';
import type { ExpenseBook } from '../types';

vi.mock('../lib/pdf', () => ({ previewPdf: vi.fn(), downloadPdf: vi.fn() }));
const pdf = await import('../lib/pdf');

/** Stands in for the book detail page so we can see which book/mode was opened */
function OpenedBook() {
  const { id, mode } = useParams();
  return (
    <p>
      opened book {decodeId(id)} in {mode}
    </p>
  );
}

type Routes = Parameters<typeof mockApi>[0];

const renderList = (books: ExpenseBook[], extra: Routes = {}) => {
  setSignedIn(true);
  const api = mockApi({
    'GET /auth/me': () => ({ body: testUser }),
    'GET /books': () => ({ body: books }),
    ...extra,
  });
  const utils = renderWithProviders(<BookList />, {
    route: '/expenseApp/list',
    path: '/expenseApp/list',
    withAuth: true,
    extraRoutes: <Route path="/expenseApp/:id/:mode" element={<OpenedBook />} />,
  });
  return { ...utils, ...api };
};

const twoBooks = [book({ id: 1, name: 'Household' }), book({ id: 2, name: 'Travel', description: null })];
const row = (name: string) => screen.getByText(name).closest('li')!;

describe('BookList', () => {
  beforeEach(() => {
    vi.mocked(pdf.previewPdf).mockReset();
    vi.mocked(pdf.downloadPdf).mockReset();
  });

  it('greets the user by first name and lists their books', async () => {
    renderList(twoBooks);
    expect(await screen.findByText('Household')).toBeInTheDocument();
    expect(screen.getByText('Welcome back, Asha!')).toBeInTheDocument();
    expect(screen.getByText('Home expenses')).toBeInTheDocument();
    expect(screen.getByText('No description')).toBeInTheDocument();
    expect(screen.getByText('Drag the handle to reorder')).toBeInTheDocument();
  });

  describe('totals', () => {
    const summaries: Record<string, object> = {
      '1': { book_id: 1, total_entries: 3, cash_in: 1000, cash_out: 400, net_balance: 600 },
      '2': { book_id: 2, total_entries: 1, cash_in: 0, cash_out: 250, net_balance: -250 },
    };
    const summaryRoute = (req: FakeRequest) => ({ body: summaries[req.path.split('/')[2]] });
    const heroStat = (label: string) => screen.getByText(label).parentElement!.parentElement!;

    it('adds up all books in the hero', async () => {
      renderList(twoBooks, { 'GET /books/:id/entries/summary': summaryRoute });
      await waitFor(() => expect(heroStat('Net Balance')).toHaveTextContent('₹350'));
      expect(heroStat('Total Cash In')).toHaveTextContent('₹1,000');
      expect(heroStat('Total Cash Out')).toHaveTextContent('₹650');
      expect(heroStat('Books')).toHaveTextContent('2');
      expect(heroStat('Books')).toHaveTextContent('4 entries');
    });

    it('shows each book’s own figures on its card', async () => {
      renderList(twoBooks, { 'GET /books/:id/entries/summary': summaryRoute });
      await waitFor(() => expect(row('Travel')).toHaveTextContent('1 entry'));
      expect(within(row('Travel')).getByText('-₹250')).toHaveClass('text-rose-600');
      expect(row('Household')).toHaveTextContent('₹600');
      expect(row('Household')).toHaveTextContent('3 entries');
    });

    it('shows "—" for a book whose totals failed, and still totals the rest', async () => {
      renderList(twoBooks, {
        'GET /books/:id/entries/summary': (req: FakeRequest) =>
          req.path.startsWith('/books/2/') ? { status: 500, body: { detail: 'x' } } : summaryRoute(req),
      });
      await waitFor(() => expect(heroStat('Net Balance')).toHaveTextContent('₹600'));
      expect(within(row('Travel')).getAllByText('—')).toHaveLength(3);
      expect(screen.queryByText('x')).not.toBeInTheDocument(); // no error toast for this
    });
  });

  it('shows loading skeletons, then an empty state', async () => {
    renderList([]);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(await screen.findByText('No books yet')).toBeInTheDocument();
  });

  it('shows an error toast if books fail to load', async () => {
    renderList([], { 'GET /books': () => ({ status: 500, body: { detail: 'DB offline' } }) });
    expect(await screen.findByText('DB offline')).toBeInTheDocument();
  });

  it('disables dragging when there is only one book', async () => {
    renderList([book()]);
    await screen.findByText('Household');
    expect(screen.getByTitle('Drag to reorder')).toBeDisabled();
  });

  it('opens a book in edit or view mode', async () => {
    const { user } = renderList(twoBooks);
    await screen.findByText('Travel');
    await user.click(within(row('Travel')).getByTitle('Edit entries'));
    expect(screen.getByText('opened book 2 in edit')).toBeInTheDocument();
  });

  it('opens a book in view mode from its title', async () => {
    const { user } = renderList(twoBooks);
    await user.click(await screen.findByText('Household'));
    expect(screen.getByText('opened book 1 in view')).toBeInTheDocument();
  });

  describe('add book', () => {
    it('requires a name', async () => {
      const { user, calls } = renderList([]);
      // empty state shows two "Add New Book" buttons (hero + empty card); either opens the dialog
      await user.click((await screen.findAllByRole('button', { name: /add new book/i }))[0]);
      const name = screen.getByLabelText(/Book Name/);
      await user.click(name);
      await user.tab();
      expect(screen.getByText('Book name is required')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Book' })).toBeDisabled();
      expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    });

    it('creates a book and opens it for editing', async () => {
      const { user, calls } = renderList([], {
        'POST /books': (req: FakeRequest) => ({ status: 201, body: book({ id: 9, ...(req.body as object) }) }),
      });
      await user.click((await screen.findAllByRole('button', { name: /add new book/i }))[0]);
      await user.type(screen.getByLabelText(/Book Name/), '  Office  ');
      await user.type(screen.getByLabelText('Description'), 'Work costs');
      await user.click(screen.getByRole('button', { name: 'Save Book' }));

      expect(await screen.findByText('opened book 9 in edit')).toBeInTheDocument();
      expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ name: 'Office', description: 'Work costs' });
    });

    it('shows a server error (e.g. duplicate name) and keeps the dialog open', async () => {
      const { user } = renderList([], {
        'POST /books': () => ({ status: 409, body: { detail: 'Expense book already exists' } }),
      });
      await user.click((await screen.findAllByRole('button', { name: /add new book/i }))[0]);
      await user.type(screen.getByLabelText(/Book Name/), 'Household');
      await user.click(screen.getByRole('button', { name: 'Save Book' }));
      expect(await screen.findByText('Expense book already exists')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Add New Book' })).toBeInTheDocument();
    });

    it('asks before closing with unsaved changes', async () => {
      const { user } = renderList([]);
      await user.click((await screen.findAllByRole('button', { name: /add new book/i }))[0]);
      await user.type(screen.getByLabelText(/Book Name/), 'Draft');
      await user.click(screen.getByText('Close', { selector: 'button' }));
      // the confirm dialog opens on top of the book dialog
      const confirm = screen.getAllByRole('dialog').at(-1)!;
      expect(confirm).toHaveTextContent('unsaved changes');
      await user.click(within(confirm).getByRole('button', { name: 'Yes' }));
      expect(screen.queryByRole('heading', { name: 'Add New Book' })).not.toBeInTheDocument();
    });

    it('closes immediately when nothing was typed', async () => {
      const { user } = renderList([]);
      await user.click((await screen.findAllByRole('button', { name: /add new book/i }))[0]);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('renames a book in place', async () => {
    const { user, calls } = renderList(twoBooks, {
      'PUT /books/:id': (req: FakeRequest) => ({ body: book({ id: 2, ...(req.body as object) }) }),
    });
    await screen.findByText('Travel');
    await user.click(within(row('Travel')).getByTitle('Rename book'));
    const name = screen.getByLabelText(/Book Name/);
    expect(name).toHaveValue('Travel');
    await user.clear(name);
    await user.type(name, 'Trips');
    await user.click(screen.getByRole('button', { name: 'Save Book' }));

    expect(await screen.findByText('Trips')).toBeInTheDocument();
    expect(screen.queryByText('Travel')).not.toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ path: '/books/2' });
    expect(screen.getByText('Book updated successfully')).toBeInTheDocument();
  });

  describe('delete book', () => {
    it('rejects a wrong name and clears the input', async () => {
      const { user, calls } = renderList(twoBooks);
      await screen.findByText('Travel');
      await user.click(within(row('Travel')).getByTitle('Delete book'));
      const input = screen.getByLabelText('Type the book name to confirm');
      await user.type(input, 'Trav');
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete book/i }));

      expect(screen.getByText('Entered book name is wrong')).toBeInTheDocument();
      expect(input).toHaveValue('');
      expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    });

    it('deletes after typing the exact name and confirming', async () => {
      const { user, calls } = renderList(twoBooks, { 'DELETE /books/:id': () => ({ body: { message: 'ok' } }) });
      await screen.findByText('Travel');
      await user.click(within(row('Travel')).getByTitle('Delete book'));
      await user.type(screen.getByLabelText('Type the book name to confirm'), 'Travel');
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete book/i }));
      await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByText('Travel')).not.toBeInTheDocument());
      expect(calls.find((c) => c.method === 'DELETE')!.path).toBe('/books/2');
      expect(screen.getByText('Your book "Travel" was deleted')).toBeInTheDocument();
    });

    it('does nothing if the final confirmation is cancelled', async () => {
      const { user, calls } = renderList(twoBooks);
      await screen.findByText('Travel');
      await user.click(within(row('Travel')).getByTitle('Delete book'));
      await user.type(screen.getByLabelText('Type the book name to confirm'), 'Travel');
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete book/i }));
      await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Cancel' }));
      expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    });

    it('shows an error if the delete fails', async () => {
      const { user } = renderList(twoBooks, {
        'DELETE /books/:id': () => ({ status: 500, body: { detail: 'Could not delete' } }),
      });
      await screen.findByText('Travel');
      await user.click(within(row('Travel')).getByTitle('Delete book'));
      await user.type(screen.getByLabelText('Type the book name to confirm'), 'Travel');
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete book/i }));
      await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('Could not delete')).toBeInTheDocument();
    });
  });

  describe('PDF report', () => {
    it('tells the user when a book has no entries', async () => {
      const { user } = renderList(twoBooks, { 'GET /books/:id/entries': () => ({ body: [] }) });
      await screen.findByText('Travel');
      await user.click(within(row('Travel')).getByTitle('Report'));
      await user.click(screen.getByRole('menuitem', { name: 'Preview PDF' }));
      expect(await screen.findByText(/No entries added for this book/)).toBeInTheDocument();
      expect(pdf.previewPdf).not.toHaveBeenCalled();
    });

    it('previews and downloads with the book name and entries', async () => {
      const { user } = renderList(twoBooks, { 'GET /books/:id/entries': () => ({ body: [apiEntry()] }) });
      await screen.findByText('Travel');

      await user.click(within(row('Travel')).getByTitle('Report'));
      await user.click(screen.getByRole('menuitem', { name: 'Preview PDF' }));
      await waitFor(() => expect(pdf.previewPdf).toHaveBeenCalledWith('Travel', expect.any(Array)));

      await user.click(within(row('Travel')).getByTitle('Report'));
      await user.click(screen.getByRole('menuitem', { name: 'Download PDF' }));
      await waitFor(() => expect(pdf.downloadPdf).toHaveBeenCalledTimes(1));
      expect(vi.mocked(pdf.downloadPdf).mock.calls[0][1]).toHaveLength(1);
    });

    it('shows an error if entries cannot be loaded', async () => {
      const { user } = renderList(twoBooks, {
        'GET /books/:id/entries': () => ({ status: 500, body: { detail: 'Entries unavailable' } }),
      });
      await screen.findByText('Travel');
      await user.click(within(row('Travel')).getByTitle('Report'));
      await user.click(screen.getByRole('menuitem', { name: 'Download PDF' }));
      expect(await screen.findByText('Entries unavailable')).toBeInTheDocument();
    });
  });

  describe('reorder', () => {
    // jsdom has no layout (every rect is 0x0), so give each book row a fake position:
    // row i sits at y = i * 100 and is 80px tall. Anything inside a row uses the row's rect.
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const li = this.closest('li');
        const index = li ? [...li.parentElement!.children].indexOf(li) : 0;
        const top = index * 100;
        return { x: 0, y: top, top, left: 0, right: 600, bottom: top + 80, width: 600, height: 80, toJSON: () => ({}) } as DOMRect;
      });
    });

    const dragDown = async (user: ReturnType<typeof renderList>['user']) => {
      const handle = within(row('Household')).getByTitle('Drag to reorder');
      handle.focus();
      await user.keyboard('[Space]');
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Space]');
    };

    it('moves a book with the keyboard and saves the new order', async () => {
      const { user, calls } = renderList(twoBooks, { 'PUT /books/reorder': () => ({ body: [] }) });
      await screen.findByText('Household');
      await dragDown(user);
      await waitFor(() => expect(calls.find((c) => c.path === '/books/reorder')?.body).toEqual({ book_ids: [2, 1] }));
      const names = screen.getAllByRole('listitem').map((li) => li.textContent);
      expect(names[0]).toContain('Travel');
    });

    it('rolls back the order if the server rejects it', async () => {
      const { user } = renderList(twoBooks, {
        'PUT /books/reorder': () => ({ status: 500, body: { detail: 'Order not saved' } }),
      });
      await screen.findByText('Household');
      await dragDown(user);
      expect(await screen.findByText('Order not saved')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Household');
    });
  });
});
