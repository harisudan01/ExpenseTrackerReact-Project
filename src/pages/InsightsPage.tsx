import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChartColumn, FilterX, LibraryBig } from 'lucide-react';
import BookCharts from '../components/BookCharts';
import { useToast } from '../components/ui/Toast';
import { bookApi, entryApi, errorMessage } from '../lib/api';
import { decodeId, encodeId } from '../lib/crypto';
import { withBalances } from '../lib/format';
import type { ExpenseBook, ExpenseEntry } from '../types';

/** Charts for one book, or for all books combined (?book=<encoded id> picks one) */
export default function InsightsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [books, setBooks] = useState<ExpenseBook[] | null>(null);
  const [entries, setEntries] = useState<ExpenseEntry[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const requested = decodeId(params.get('book') ?? undefined);
  const book = books?.find((b) => b.id === requested) ?? null; // null = all books

  useEffect(() => {
    bookApi
      .getAll()
      .then(setBooks)
      .catch((err) => {
        toast(errorMessage(err, 'Failed to load books'), 'error');
        setBooks([]);
      });
  }, [toast]);

  const bookId = book?.id;
  useEffect(() => {
    if (!books) return;
    const ids = bookId ? [bookId] : books.map((b) => b.id);
    let stale = false;
    setEntries(null);
    Promise.all(ids.map((id) => entryApi.getByBook(id)))
      .then((lists) => {
        if (stale) return;
        // Newest first across all books; the running balance then covers every selected book
        const merged = lists.flat().sort((a, b) => b.date.getTime() - a.date.getTime());
        setEntries(withBalances(merged));
      })
      .catch((err) => {
        if (stale) return;
        toast(errorMessage(err, 'Failed to load entries'), 'error');
        setEntries([]);
      });
    return () => {
      stale = true;
    };
  }, [books, bookId, toast]);

  const inRange = useMemo(
    () =>
      (entries ?? []).filter(
        (e) => !(from && e.date < new Date(from + 'T00:00')) && !(to && e.date > new Date(to + 'T00:00')),
      ),
    [entries, from, to],
  );

  const selectBook = (value: string) =>
    setParams(value === 'all' ? {} : { book: encodeId(Number(value)) }, { replace: true });

  const subtitle = `${book ? book.name : 'All books'} · ${from || to ? 'selected dates' : 'all dates'}`;

  return (
    <div className="animate-rise space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-ink via-[#145b75] to-teal-brand px-6 py-6 text-white shadow-xl shadow-brand-ink/20 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-teal-300/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/85 ring-1 ring-white/20">
            <ChartColumn size={13} /> Insights
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Where your money goes</h1>
          <p className="mt-2 max-w-xl text-sm text-white/75">
            Monthly cash flow, spending by category and your balance over time, for one book or all of them.
          </p>
        </div>
      </section>

      {books && books.length === 0 ? (
        <section className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="mb-4 grid size-16 place-items-center rounded-3xl bg-slate-100 text-slate-400">
            <LibraryBig size={30} />
          </span>
          <h2 className="text-lg font-bold text-slate-800">No books yet</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Create a book and add a few entries to see your charts.</p>
          <Link to="/expenseApp/list" className="btn-primary mt-5">
            Go to My Books
          </Link>
        </section>
      ) : (
        <>
          <section className="card flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1">
              <span className="field-label">Book</span>
              <select
                className="field"
                value={book ? String(book.id) : 'all'}
                onChange={(e) => selectBook(e.target.value)}
                disabled={!books}
              >
                <option value="all">All books</option>
                {books?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="field-label">Dates</span>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={16} className="hidden text-slate-400 sm:block" />
                <input
                  type="date"
                  className="field w-auto"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="From date"
                />
                <span className="text-sm text-slate-400">to</span>
                <input
                  type="date"
                  className="field w-auto"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="To date"
                />
              </div>
            </div>
            {(from || to) && (
              <button
                className="btn-secondary"
                onClick={() => {
                  setFrom('');
                  setTo('');
                }}
              >
                <FilterX size={16} /> Clear dates
              </button>
            )}
          </section>

          {entries === null ? (
            <section className="card space-y-4 p-5" aria-busy="true">
              <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
            </section>
          ) : (
            <BookCharts
              entries={inRange}
              subtitle={subtitle}
              emptyText={
                entries.length === 0
                  ? `${book ? 'This book has' : 'Your books have'} no entries yet.`
                  : 'No entries in the selected dates.'
              }
              onCategory={
                book
                  ? (category) => navigate(`/expenseApp/${encodeId(book.id)}/view?q=${encodeURIComponent(category)}`)
                  : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}
