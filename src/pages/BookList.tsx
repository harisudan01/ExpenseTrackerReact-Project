import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BookPlus,
  Download,
  Eye,
  GripVertical,
  LibraryBig,
  NotebookPen,
  PencilLine,
  Plus,
  Scale,
  SquarePen,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import clsx from 'clsx';
import { bookApi, entryApi, errorMessage, type BookSummary } from '../lib/api';
import { encodeId } from '../lib/crypto';
import { formatMoney } from '../lib/format';
import { downloadPdf, previewPdf } from '../lib/pdf';
import type { ExpenseBook } from '../types';
import { Modal } from '../components/ui/Modal';
import { Menu } from '../components/ui/Menu';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/Confirm';
import { useAuth } from '../components/auth/AuthContext';

/** Accent per card: [icon gradient, top bar gradient] */
const ACCENTS = [
  'from-brand-500 to-teal-brand',
  'from-violet-500 to-indigo-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
];

/** undefined = still loading, null = could not be loaded */
type SummaryMap = Record<number, BookSummary | null | undefined>;

const emptySummary = (bookId: number): BookSummary => ({
  book_id: bookId,
  total_entries: 0,
  cash_in: 0,
  cash_out: 0,
  net_balance: 0,
});

export default function BookList() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const firstName = user?.name.split(/\s+/)[0] || 'Saver';

  const [books, setBooks] = useState<ExpenseBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<SummaryMap>({});

  // add / rename modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseBook | null>(null);

  // delete modal
  const [deleting, setDeleting] = useState<ExpenseBook | null>(null);

  useEffect(() => {
    bookApi
      .getAll()
      .then((list) => {
        setBooks(list);
        // Totals per book load in the background; a failure just shows "—" on that card
        list.forEach((b) =>
          entryApi
            .getSummary(b.id)
            .then((s) => setSummaries((m) => ({ ...m, [b.id]: s })))
            .catch(() => setSummaries((m) => ({ ...m, [b.id]: null }))),
        );
      })
      .catch((err) => toast(errorMessage(err, 'Failed to load books'), 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  /** Totals across every book whose summary has loaded */
  const overall = useMemo(() => {
    const loaded = books.map((b) => summaries[b.id]).filter((s): s is BookSummary => !!s);
    const sum = (k: 'cash_in' | 'cash_out' | 'net_balance') =>
      Math.round(loaded.reduce((a, s) => a + Number(s[k]), 0) * 100) / 100;
    return {
      ready: !loading && books.every((b) => summaries[b.id] !== undefined),
      cashIn: sum('cash_in'),
      cashOut: sum('cash_out'),
      net: sum('net_balance'),
      entries: loaded.reduce((a, s) => a + s.total_entries, 0),
    };
  }, [books, summaries, loading]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const previous = books;
    const next = arrayMove(
      books,
      books.findIndex((b) => b.id === active.id),
      books.findIndex((b) => b.id === over.id),
    );
    setBooks(next);
    bookApi.reorder(next.map((b) => b.id)).catch((err) => {
      // Roll back the UI if the server rejected the new order
      setBooks(previous);
      toast(errorMessage(err, 'Failed to save book order'), 'error');
    });
  };

  const openBook = (id: number, mode: 'edit' | 'view') => navigate(`/expenseApp/${encodeId(id)}/${mode}`);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const report = async (book: ExpenseBook, action: 'preview' | 'download') => {
    try {
      const data = await entryApi.getByBook(book.id);
      if (data.length === 0) {
        toast('No entries added for this book. Please add entries first.', 'info');
        return;
      }
      await (action === 'preview' ? previewPdf : downloadPdf)(book.name, data);
    } catch (err) {
      toast(errorMessage(err, 'Failed to load entries for report'), 'error');
    }
  };

  const onSaved = (saved: ExpenseBook, isNew: boolean) => {
    setFormOpen(false);
    if (isNew) {
      setBooks((b) => [saved, ...b]);
      setSummaries((m) => ({ ...m, [saved.id]: emptySummary(saved.id) }));
      toast('Book created successfully. Add your entries here!');
      openBook(saved.id, 'edit');
    } else {
      setBooks((b) => b.map((x) => (x.id === saved.id ? saved : x)));
      toast('Book updated successfully');
    }
  };

  const onDeleted = (book: ExpenseBook) => {
    setBooks((b) => b.filter((x) => x.id !== book.id));
    setDeleting(null);
    toast(`Your book "${book.name}" was deleted`);
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="animate-rise space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-ink via-[#145b75] to-teal-brand p-6 text-white shadow-xl shadow-brand-ink/20 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-teal-300/15 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-100/90">{today}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome back, {firstName}!</h1>
            <p className="mt-1.5 text-base text-white/75">Track your expenses effortlessly</p>
          </div>
          <button
            className="btn shrink-0 bg-white px-5 py-3 text-[15px] text-brand-ink shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:bg-[#e9fbf8]"
            onClick={openAdd}
          >
            <Plus size={19} strokeWidth={2.5} />
            Add New Book
          </button>
        </div>

        <div className="relative mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <HeroStat label="Books" icon={<LibraryBig size={17} />} loading={loading}>
            {books.length}
            <span className="ml-1.5 text-xs font-semibold text-white/60">
              {overall.ready ? `${overall.entries} entries` : ''}
            </span>
          </HeroStat>
          <HeroStat label="Total Cash In" icon={<ArrowDownLeft size={17} />} loading={!overall.ready}>
            {formatMoney(overall.cashIn)}
          </HeroStat>
          <HeroStat label="Total Cash Out" icon={<ArrowUpRight size={17} />} loading={!overall.ready}>
            {formatMoney(overall.cashOut)}
          </HeroStat>
          <HeroStat label="Net Balance" icon={<Scale size={17} />} loading={!overall.ready} highlight>
            {formatMoney(overall.net)}
          </HeroStat>
        </div>
      </section>

      {/* Books */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-900">
              Your Books
              {!loading && (
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-600">
                  {books.length}
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Open a book to add or review its entries.</p>
          </div>
          {books.length > 1 && (
            <p className="hidden items-center gap-1.5 text-xs font-medium text-slate-400 sm:flex">
              <GripVertical size={14} /> Drag the handle to reorder
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card animate-pulse p-5">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-2xl bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-5 h-16 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="card flex flex-col items-center border-dashed px-6 py-16 text-center">
            <span className="mb-4 grid size-16 place-items-center rounded-3xl bg-linear-to-br from-brand-500 to-teal-brand text-white shadow-lg shadow-brand-500/25">
              <BookPlus size={30} />
            </span>
            <h3 className="text-lg font-bold text-slate-800">No books yet</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Create your first expense book to start tracking cash in and cash out.
            </p>
            <button className="btn-primary mt-6" onClick={openAdd}>
              <Plus size={18} /> Add New Book
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={books.map((b) => b.id)} strategy={rectSortingStrategy}>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {books.map((book, i) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    summary={summaries[book.id]}
                    accent={ACCENTS[i % ACCENTS.length]}
                    dragDisabled={books.length <= 1}
                    onRename={() => {
                      setEditing(book);
                      setFormOpen(true);
                    }}
                    onEdit={() => openBook(book.id, 'edit')}
                    onView={() => openBook(book.id, 'view')}
                    onPreview={() => report(book, 'preview')}
                    onDownload={() => report(book, 'download')}
                    onDelete={() => setDeleting(book)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <BookFormModal
        open={formOpen}
        book={editing}
        onClose={() => setFormOpen(false)}
        onSaved={onSaved}
        confirm={confirm}
        toast={toast}
      />
      <DeleteBookModal book={deleting} onClose={() => setDeleting(null)} onDeleted={onDeleted} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function HeroStat({
  label,
  icon,
  loading,
  highlight,
  children,
}: {
  label: string;
  icon: ReactNode;
  loading: boolean;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl p-4 ring-1 backdrop-blur',
        highlight ? 'bg-white text-brand-ink ring-white dark:bg-white/20 dark:text-white dark:ring-white/40' : 'bg-white/10 ring-white/15',
      )}
    >
      <div className={clsx('flex items-center gap-2 text-xs font-semibold', highlight ? 'text-slate-500' : 'text-white/70')}>
        <span className={clsx('grid size-7 place-items-center rounded-lg', highlight ? 'bg-brand-50 text-brand-500' : 'bg-white/15')}>
          {icon}
        </span>
        {label}
      </div>
      {loading ? (
        <div className={clsx('mt-3 h-7 w-24 animate-pulse rounded-lg', highlight ? 'bg-slate-200' : 'bg-white/20')} />
      ) : (
        <p className="mt-2.5 truncate text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl">{children}</p>
      )}
    </div>
  );
}

interface CardProps {
  book: ExpenseBook;
  summary: BookSummary | null | undefined;
  accent: string;
  dragDisabled: boolean;
  onRename: () => void;
  onEdit: () => void;
  onView: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

function BookCard({ book, summary, accent, dragDisabled, ...a }: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
    disabled: dragDisabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'card group relative flex flex-col overflow-hidden transition-shadow',
        isDragging
          ? 'z-10 shadow-2xl shadow-brand-ink/20 ring-2 ring-brand-500/40'
          : 'hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5',
      )}
    >
      <div className={clsx('h-1.5 bg-linear-to-r', accent)} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3.5">
          <button
            type="button"
            onClick={a.onView}
            className={clsx(
              'grid size-12 shrink-0 cursor-pointer place-items-center rounded-2xl bg-linear-to-br text-white shadow-md',
              accent,
            )}
            title="Open book"
          >
            <NotebookPen size={22} />
          </button>
          <div className="min-w-0 flex-1 pt-0.5">
            <button type="button" onClick={a.onView} className="block max-w-full cursor-pointer text-left">
              <p className="truncate text-base font-bold text-slate-800 group-hover:text-brand-600">{book.name}</p>
            </button>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {book.description || <span className="text-slate-400 italic">No description</span>}
            </p>
          </div>
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            disabled={dragDisabled}
            className="icon-btn -mt-1 -mr-2 size-8 cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical size={17} />
          </button>
        </div>

        {/* Totals */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3 text-center">
          <MiniStat label="In" value={summary?.cash_in} loading={summary === undefined} className="text-emerald-600" />
          <MiniStat label="Out" value={summary?.cash_out} loading={summary === undefined} className="text-rose-600" />
          <MiniStat
            label="Balance"
            value={summary?.net_balance}
            loading={summary === undefined}
            className={summary && summary.net_balance < 0 ? 'text-rose-600' : 'text-brand-700'}
          />
        </div>
        <p className="mt-2.5 text-xs font-medium text-slate-400">
          {summary ? `${summary.total_entries} ${summary.total_entries === 1 ? 'entry' : 'entries'}` : ' '}
        </p>
      </div>

      <div className="flex items-center gap-1 border-t border-slate-100 bg-slate-50/50 px-3 py-2.5">
        <button
          className="btn px-3 py-1.5 text-violet-700 hover:bg-violet-50"
          title="Edit entries"
          onClick={a.onEdit}
        >
          <SquarePen size={16} /> Edit
        </button>
        <button className="btn px-3 py-1.5 text-teal-700 hover:bg-teal-50" title="View entries" onClick={a.onView}>
          <Eye size={16} /> View
        </button>
        <div className="ml-auto flex items-center">
          <button className="icon-btn text-blue-600 hover:bg-blue-50" title="Rename book" onClick={a.onRename}>
            <PencilLine size={17} />
          </button>
          <Menu
            title="Report"
            trigger={<BarChart3 size={17} className="text-amber-600" />}
            items={[
              { label: 'Preview PDF', icon: <Eye size={16} />, onClick: a.onPreview, className: 'text-amber-700' },
              { label: 'Download PDF', icon: <Download size={16} />, onClick: a.onDownload, className: 'text-amber-700' },
            ]}
          />
          <button className="icon-btn text-red-600 hover:bg-red-50" title="Delete book" onClick={a.onDelete}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    </li>
  );
}

function MiniStat({
  label,
  value,
  loading,
  className,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  className: string;
}) {
  return (
    <div className="min-w-0 px-2">
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      {loading ? (
        <div className="mx-auto mt-1.5 h-4 w-14 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className={clsx('mt-0.5 truncate text-sm font-extrabold tabular-nums', className)}>
          {value === undefined ? '—' : formatMoney(value)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function BookFormModal({
  open,
  book,
  onClose,
  onSaved,
  confirm,
  toast,
}: {
  open: boolean;
  book: ExpenseBook | null;
  onClose: () => void;
  onSaved: (b: ExpenseBook, isNew: boolean) => void;
  confirm: ReturnType<typeof useConfirm>;
  toast: ReturnType<typeof useToast>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(book?.name ?? '');
      setDescription(book?.description ?? '');
      setTouched(false);
    }
  }, [open, book]);

  const dirty = name !== (book?.name ?? '') || description !== (book?.description ?? '');
  const nameError = touched && !name.trim();

  const requestClose = useCallback(async () => {
    if (saving) return;
    if (!dirty || (await confirm({ message: 'You have unsaved changes. Are you sure you want to leave?' }))) {
      onClose();
    }
  }, [dirty, saving, confirm, onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || saving) return;
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null };
    try {
      const saved = book ? await bookApi.update(book.id, payload) : await bookApi.create(payload);
      onSaved(saved, !book);
    } catch (err) {
      toast(errorMessage(err, book ? 'Failed to update book' : 'Failed to create book'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={book ? 'Rename Book' : 'Add New Book'}
      subtitle={book ? 'Update the name or description of this book.' : 'Create a book to group related entries.'}
      icon={
        <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          {book ? <PencilLine size={21} /> : <BookPlus size={21} />}
        </span>
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={requestClose}>
            Close
          </button>
          <button type="submit" form="book-form" className="btn-primary" disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : 'Save Book'}
          </button>
        </>
      }
    >
      <form id="book-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="book-name" className="field-label">
            Book Name <span className="text-red-500">*</span>
          </label>
          <input
            id="book-name"
            className={clsx('field', nameError && 'field-error')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Monthly Household"
            maxLength={100}
            autoFocus
          />
          {nameError && <p className="mt-1.5 text-xs font-medium text-red-600">Book name is required</p>}
        </div>
        <div>
          <label htmlFor="book-desc" className="field-label">
            Description
          </label>
          <input
            id="book-desc"
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this book for?"
            maxLength={255}
          />
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function DeleteBookModal({
  book,
  onClose,
  onDeleted,
}: {
  book: ExpenseBook | null;
  onClose: () => void;
  onDeleted: (b: ExpenseBook) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setTyped(''), [book]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!book || busy) return;
    if (typed !== book.name) {
      toast('Entered book name is wrong', 'info');
      setTyped('');
      return;
    }
    const ok = await confirm({
      title: 'Delete this book?',
      message: 'This book and all its entries will be permanently deleted. Once deleted it cannot be restored.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await bookApi.delete(book.id);
      onDeleted(book);
    } catch (err) {
      toast(errorMessage(err, 'Failed to delete book'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!book}
      onClose={onClose}
      title="Delete Book"
      icon={
        <span className="grid size-11 place-items-center rounded-2xl bg-red-50 text-red-600">
          <TriangleAlert size={21} />
        </span>
      }
      subtitle="This action cannot be undone."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="submit" form="delete-form" className="btn-danger" disabled={!typed || busy}>
            <Trash2 size={16} /> {busy ? 'Deleting…' : 'Delete Book'}
          </button>
        </>
      }
    >
      <form id="delete-form" onSubmit={submit} className="space-y-3">
        <p className="rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-3 text-sm text-red-700">
          To delete this expense book, type <strong className="font-bold break-all">{book?.name}</strong> below.
        </p>
        <input
          className="field"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Book name"
          aria-label="Type the book name to confirm"
          autoFocus
        />
      </form>
    </Modal>
  );
}
