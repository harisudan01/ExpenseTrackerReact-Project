import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilterX,
  Inbox,
  Lock,
  Minus,
  Pencil,
  Plus,
  Scale,
  Search,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { bookApi, entryApi, errorMessage } from '../lib/api';
import { decodeId } from '../lib/crypto';
import { formatDate, formatMoney, formatTime, totals, withBalances } from '../lib/format';
import type { ExpenseEntry, TransactionType } from '../types';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/Confirm';
import EntryDrawer, { type DrawerState } from '../components/EntryDrawer';

type TypeFilter = 'all' | TransactionType;
const PAGE_SIZES = [10, 20, 40];

export default function BookDetail() {
  const { id, mode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const bookId = useMemo(() => decodeId(id), [id]);
  const canEdit = mode === 'edit';

  const [bookName, setBookName] = useState('');
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  // filters + paging (client side, so running balances stay correct).
  // ?q= pre-fills the search, e.g. when coming from a category on the Insights page.
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [type, setType] = useState<TypeFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const back = useCallback(() => navigate('/expenseApp/list'), [navigate]);

  const loadEntries = useCallback(async () => {
    if (!bookId) return;
    try {
      setEntries(await entryApi.getByBook(bookId));
    } catch (err) {
      toast(errorMessage(err, 'Failed to load entries'), 'error');
    } finally {
      setLoading(false);
    }
  }, [bookId, toast]);

  useEffect(() => {
    if (!bookId) {
      toast('Invalid book link', 'error');
      back();
      return;
    }
    bookApi
      .getById(bookId)
      .then((b) => setBookName(b.name))
      .catch((err) => {
        toast(errorMessage(err, 'Failed to load book'), 'error');
        if (err?.status === 404) back();
      });
    loadEntries();
  }, [bookId, back, loadEntries, toast]);

  const summary = useMemo(() => totals(entries), [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (type !== 'all' && e.paymode !== type) return false;
      if (from && e.date < new Date(from + 'T00:00')) return false;
      if (to && e.date > new Date(to + 'T00:00')) return false;
      if (q) {
        const hay = [e.remarks, e.category, e.party, String(e.amount)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, type, from, to]);

  const hasFilters = !!(search || type !== 'all' || from || to);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  useEffect(() => setPage(0), [search, type, from, to, pageSize]);

  const clearFilters = () => {
    setSearch('');
    setType('all');
    setFrom('');
    setTo('');
  };

  const onDelete = async (entry: ExpenseEntry) => {
    const ok = await confirm({
      title: 'Delete entry?',
      message: `Delete this ${entry.paymode} entry of ${formatMoney(entry.amount)}? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await entryApi.delete(entry.id);
      setEntries((list) => withBalances(list.filter((e) => e.id !== entry.id)));
      toast('Entry deleted successfully');
    } catch (err) {
      toast(errorMessage(err, 'Failed to delete entry'), 'error');
    }
  };

  if (!bookId) return null;

  const inCount = entries.filter((e) => e.paymode === 'Cash In').length;
  const outCount = entries.length - inCount;

  return (
    <div className="animate-rise">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-ink via-[#145b75] to-teal-brand px-6 pt-6 pb-20 text-white shadow-xl shadow-brand-ink/20 sm:px-8 sm:pt-7">
        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-teal-300/15 blur-3xl" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <button
              onClick={back}
              title="Back to books"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white/85 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft size={16} /> My Books
            </button>
            <h1 className="mt-4 truncate text-3xl font-extrabold tracking-tight sm:text-4xl">
              {bookName || <span className="inline-block h-9 w-56 animate-pulse rounded-lg bg-white/20 align-middle" />}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1',
                  canEdit ? 'bg-emerald-400/20 text-emerald-50 ring-emerald-200/30' : 'bg-white/10 text-white/85 ring-white/20',
                )}
              >
                {canEdit ? (
                  <>
                    <Pencil size={12} /> Editing entries
                  </>
                ) : (
                  <>
                    <Lock size={12} /> View only
                  </>
                )}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/85 ring-1 ring-white/20">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </span>
              <Link
                to={`/expenseApp/insights?book=${id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-white/85 ring-1 ring-white/20 transition hover:bg-white/20 hover:text-white"
              >
                <ChartColumn size={12} /> Charts
              </Link>
            </div>
          </div>
          {canEdit && (
            <div className="grid grid-cols-2 gap-2.5 sm:flex">
              <button
                className="btn-in px-5 py-3 ring-1 ring-white/25"
                onClick={() => setDrawer({ kind: 'new', type: 'Cash In' })}
              >
                <Plus size={18} strokeWidth={2.5} /> Cash In
              </button>
              <button
                className="btn-out px-5 py-3 ring-1 ring-white/25"
                onClick={() => setDrawer({ kind: 'new', type: 'Cash Out' })}
              >
                <Minus size={18} strokeWidth={2.5} /> Cash Out
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Summary — overlaps the bottom of the hero */}
      <section className="relative -mt-14 grid gap-3 px-3 sm:grid-cols-3 sm:gap-4 sm:px-6">
        <SummaryCard
          label="Total Cash In"
          sub={`${inCount} cash in ${inCount === 1 ? 'entry' : 'entries'}`}
          value={summary.cashIn}
          icon={<ArrowDownLeft size={20} />}
          tone="in"
        />
        <SummaryCard
          label="Total Cash Out"
          sub={`${outCount} cash out ${outCount === 1 ? 'entry' : 'entries'}`}
          value={summary.cashOut}
          icon={<ArrowUpRight size={20} />}
          tone="out"
        />
        <SummaryCard
          label="Net Balance"
          sub={
            <>
              <span className="text-emerald-600">Cash In</span> − <span className="text-rose-600">Cash Out</span>
            </>
          }
          value={summary.net}
          icon={<Scale size={20} />}
          tone="net"
        />
      </section>

      {/* Transactions */}
      <section className="card mt-6 overflow-hidden">
        <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Transactions</h2>
              <p className="text-sm text-slate-500">
                {hasFilters ? `Showing ${filtered.length} of ${entries.length}` : 'Newest first, with running balance'}
              </p>
            </div>
            {hasFilters && (
              <button className="btn-secondary px-3 py-2" onClick={clearFilters} title="Clear filters">
                <FilterX size={16} /> Clear
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
              />
              <input
                className="field bg-slate-50 pl-10 focus:bg-white"
                placeholder="Search remarks, category, party or amount…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-slate-100 p-1">
                {(['all', 'Cash In', 'Cash Out'] as TypeFilter[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={clsx(
                      'cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                      type === t
                        ? clsx(
                            'bg-surface-raised shadow-sm',
                            t === 'Cash In' ? 'text-emerald-700' : t === 'Cash Out' ? 'text-rose-700' : 'text-slate-800',
                          )
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {t === 'all' ? 'All' : t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={16} className="hidden text-slate-400 sm:block" />
                <input
                  type="date"
                  className="field w-auto bg-slate-50 py-2 focus:bg-white"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="From date"
                />
                <span className="text-sm text-slate-400">to</span>
                <input
                  type="date"
                  className="field w-auto bg-slate-50 py-2 focus:bg-white"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="To date"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="h-4 flex-1 rounded bg-slate-100" />
                <div className="h-4 w-16 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-4 grid size-16 place-items-center rounded-3xl bg-slate-100 text-slate-400">
              <Inbox size={30} />
            </span>
            <h3 className="text-lg font-bold text-slate-800">
              {hasFilters ? 'No matching entries' : 'No entries yet'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {hasFilters
                ? 'Try changing or clearing your filters.'
                : canEdit
                  ? 'Add your first Cash In or Cash Out entry to get started.'
                  : 'This book has no entries.'}
            </p>
            {hasFilters ? (
              <button className="btn-secondary mt-5" onClick={clearFilters}>
                <FilterX size={16} /> Clear filters
              </button>
            ) : (
              canEdit && (
                <div className="mt-5 flex gap-2.5">
                  <button className="btn-in" onClick={() => setDrawer({ kind: 'new', type: 'Cash In' })}>
                    <Plus size={17} /> Cash In
                  </button>
                  <button className="btn-out" onClick={() => setDrawer({ kind: 'new', type: 'Cash Out' })}>
                    <Minus size={17} /> Cash Out
                  </button>
                </div>
              )
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
                    <th className="px-5 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Details</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Mode</th>
                    <th className="px-4 py-3.5">Party</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5 text-right">Balance</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{formatDate(e.date)}</div>
                        <div className="text-xs text-slate-400">{formatTime(e.time) || '—'}</div>
                      </td>
                      <td className="max-w-56 px-4 py-3.5">
                        <p className="truncate text-slate-700" title={e.remarks ?? ''}>
                          {e.remarks || <Dash />}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        {e.category ? (
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {e.category}
                          </span>
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <TypeBadge type={e.paymode} />
                      </td>
                      <td className="max-w-40 truncate px-4 py-3.5 text-slate-600">{e.party || <Dash />}</td>
                      <td
                        className={clsx(
                          'px-4 py-3.5 text-right font-bold whitespace-nowrap tabular-nums',
                          e.paymode === 'Cash In' ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {e.paymode === 'Cash In' ? '+' : '−'}
                        {formatMoney(e.amount)}
                      </td>
                      <td
                        className={clsx(
                          'px-4 py-3.5 text-right font-semibold whitespace-nowrap tabular-nums',
                          (e.balance ?? 0) < 0 ? 'text-rose-600' : 'text-slate-700',
                        )}
                      >
                        {formatMoney(e.balance ?? 0)}
                      </td>
                      <td className="px-5 py-3.5">
                        <RowActions
                          canEdit={canEdit}
                          onEdit={() => setDrawer({ kind: 'edit', entry: e })}
                          onView={() => setDrawer({ kind: 'view', entry: e })}
                          onDelete={() => onDelete(e)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {pageRows.map((e) => (
                <li key={e.id} className="flex gap-3 p-4">
                  <span
                    className={clsx(
                      'grid size-10 shrink-0 place-items-center rounded-xl',
                      e.paymode === 'Cash In' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
                    )}
                  >
                    {e.paymode === 'Cash In' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {e.remarks || e.category || e.paymode}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDate(e.date)}
                          {e.time && ` • ${formatTime(e.time)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={clsx(
                            'font-bold tabular-nums',
                            e.paymode === 'Cash In' ? 'text-emerald-600' : 'text-rose-600',
                          )}
                        >
                          {e.paymode === 'Cash In' ? '+' : '−'}
                          {formatMoney(e.amount)}
                        </p>
                        <p className="text-xs text-slate-400 tabular-nums">Bal {formatMoney(e.balance ?? 0)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        {e.category && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {e.category}
                          </span>
                        )}
                        {e.party && (
                          <span className="truncate rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                            {e.party}
                          </span>
                        )}
                      </div>
                      <RowActions
                        canEdit={canEdit}
                        onEdit={() => setDrawer({ kind: 'edit', entry: e })}
                        onView={() => setDrawer({ kind: 'view', entry: e })}
                        onDelete={() => onDelete(e)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:px-5">
              <div className="flex items-center gap-2">
                Rows per page
                <select
                  className="field w-auto py-1.5 pr-8"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">
                  {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of{' '}
                  {filtered.length}
                </span>
                <div className="flex gap-1">
                  <button
                    className="icon-btn border border-slate-200 bg-surface"
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    className="icon-btn border border-slate-200 bg-surface"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <EntryDrawer
        state={drawer}
        bookId={bookId}
        canEdit={canEdit}
        knownParties={entries.map((e) => e.party).filter((p): p is string => !!p)}
        onClose={() => setDrawer(null)}
        onSwitchToEdit={(entry) => setDrawer({ kind: 'edit', entry })}
        onSaved={loadEntries}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

const Dash = () => <span className="text-slate-300">—</span>;

function TypeBadge({ type }: { type: TransactionType }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap',
        type === 'Cash In' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      )}
    >
      {type === 'Cash In' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
      {type}
    </span>
  );
}

function RowActions({
  canEdit,
  onEdit,
  onView,
  onDelete,
}: {
  canEdit: boolean;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 justify-end gap-0.5">
      <button
        className="icon-btn text-emerald-600 hover:bg-emerald-50"
        title={canEdit ? 'Edit entry' : 'Open the book in edit mode to change entries'}
        disabled={!canEdit}
        onClick={onEdit}
      >
        <Pencil size={16} />
      </button>
      <button className="icon-btn text-sky-600 hover:bg-sky-50" title="View entry" onClick={onView}>
        <Eye size={16} />
      </button>
      <button
        className="icon-btn text-red-600 hover:bg-red-50"
        title={canEdit ? 'Delete entry' : 'Open the book in edit mode to delete entries'}
        disabled={!canEdit}
        onClick={onDelete}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  sub,
  value,
  icon,
  tone,
}: {
  label: string;
  sub: ReactNode;
  value: number;
  icon: ReactNode;
  tone: 'in' | 'out' | 'net';
}) {
  const styles = {
    in: { bar: 'bg-emerald-500', icon: 'bg-emerald-500 shadow-emerald-500/30', value: 'text-emerald-600' },
    out: { bar: 'bg-rose-500', icon: 'bg-rose-500 shadow-rose-500/30', value: 'text-rose-600' },
    net: {
      bar: 'bg-linear-to-r from-brand-500 to-teal-brand',
      icon: 'bg-linear-to-br from-brand-500 to-teal-brand shadow-brand-500/30',
      value: value < 0 ? 'text-rose-600' : 'text-brand-700',
    },
  }[tone];
  return (
    <div className="card relative overflow-hidden p-5 shadow-lg shadow-black/5">
      <span className={clsx('absolute inset-x-0 top-0 h-1', styles.bar)} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <span className={clsx('grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-md', styles.icon)}>
          {icon}
        </span>
      </div>
      <p className={clsx('mt-1 text-2xl font-extrabold tracking-tight tabular-nums sm:text-[28px]', styles.value)}>
        {formatMoney(value)}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-400">{sub}</p>
    </div>
  );
}
