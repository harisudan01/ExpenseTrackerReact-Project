import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Pencil, X } from 'lucide-react';
import clsx from 'clsx';
import { entryApi, errorMessage } from '../lib/api';
import { toIsoDate } from '../lib/format';
import { CATEGORIES, type ExpenseEntry, type ExpenseEntryPayload, type TransactionType } from '../types';
import { Drawer } from './ui/Drawer';
import { useToast } from './ui/Toast';
import { useConfirm } from './ui/Confirm';

export type DrawerState =
  | { kind: 'new'; type: TransactionType }
  | { kind: 'edit'; entry: ExpenseEntry }
  | { kind: 'view'; entry: ExpenseEntry };

interface FormValues {
  type: TransactionType;
  date: string;
  time: string;
  amount: string;
  category: string;
  party: string;
  remarks: string;
}

const DEFAULT_PARTIES = ['Sudan', 'Customer', 'Other'];
const MAX_AMOUNT = 1_000_000;

function initialValues(state: DrawerState): FormValues {
  if (state.kind === 'new') {
    const now = new Date();
    return {
      type: state.type,
      date: toIsoDate(now),
      time: now.toTimeString().slice(0, 5),
      amount: '',
      category: '',
      party: '',
      remarks: '',
    };
  }
  const e = state.entry;
  return {
    type: e.paymode,
    date: toIsoDate(e.date),
    time: e.time,
    amount: String(e.amount),
    category: e.category ?? '',
    party: e.party ?? '',
    remarks: e.remarks ?? '',
  };
}

function validate(v: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!v.date) errors.date = 'Date is required';
  if (!v.time) errors.time = 'Time is required';
  const n = Number(v.amount);
  if (v.amount === '') errors.amount = 'Amount is required';
  else if (isNaN(n) || n < 1) errors.amount = 'Amount must be at least 1';
  else if (n > MAX_AMOUNT) errors.amount = `Amount cannot be greater than ${MAX_AMOUNT.toLocaleString('en-IN')}`;
  return errors;
}

function toPayload(v: FormValues): ExpenseEntryPayload {
  return {
    transaction_date: v.date,
    transaction_time: v.time || null,
    amount: Number(v.amount),
    category: v.category || null,
    transaction_type: v.type,
    party: v.party.trim() || null,
    remarks: v.remarks.trim() || null,
  };
}

interface Props {
  state: DrawerState | null;
  bookId: number;
  canEdit: boolean;
  knownParties: string[];
  onClose: () => void;
  onSwitchToEdit: (entry: ExpenseEntry) => void;
  onSaved: () => void;
}

export default function EntryDrawer({ state, bookId, canEdit, knownParties, onClose, onSwitchToEdit, onSaved }: Props) {
  const toast = useToast();
  const confirm = useConfirm();

  const [values, setValues] = useState<FormValues | null>(null);
  const [initial, setInitial] = useState<FormValues | null>(null);
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [saving, setSaving] = useState(false);

  const reset = useCallback((s: DrawerState) => {
    const v = initialValues(s);
    setValues(v);
    setInitial(v);
    setTouched({});
  }, []);

  useEffect(() => {
    if (state) reset(state);
  }, [state, reset]);

  const readOnly = state?.kind === 'view';
  const isNew = state?.kind === 'new';
  const errors = useMemo(() => (values ? validate(values) : {}), [values]);
  const valid = Object.keys(errors).length === 0;
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const parties = useMemo(() => [...new Set([...knownParties, ...DEFAULT_PARTIES])], [knownParties]);

  const requestClose = useCallback(async () => {
    if (saving) return;
    if (readOnly || !dirty || (await confirm({ message: 'You have unsaved changes. Are you sure you want to leave?' }))) {
      onClose();
    }
  }, [saving, readOnly, dirty, confirm, onClose]);

  const save = async (addAnother: boolean) => {
    if (!state || !values || readOnly) return;
    setTouched({ date: true, time: true, amount: true });
    if (!valid || saving) return;
    setSaving(true);
    const editing = state.kind === 'edit';
    try {
      if (editing) await entryApi.update(state.entry.id, toPayload(values));
      else await entryApi.create(bookId, toPayload(values));
      toast(editing ? 'Entry updated successfully' : 'Entry added successfully');
      onSaved();
      if (addAnother) reset({ kind: 'new', type: values.type });
      else onClose();
    } catch (err) {
      toast(errorMessage(err, editing ? 'Failed to update entry' : 'Failed to add entry'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save(false);
  };

  if (!state || !values) return null;

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => setValues((p) => (p ? { ...p, [k]: v } : p));
  const touch = (k: keyof FormValues) => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k: keyof FormValues) => (touched[k] ? errors[k] : undefined);

  const isIn = values.type === 'Cash In';
  const title = `${isNew ? 'Add' : readOnly ? 'View' : 'Edit'} ${values.type} Entry`;

  return (
    <Drawer open onRequestClose={requestClose}>
      {/* Header */}
      <div
        className={clsx(
          'flex items-center gap-3 border-b px-6 py-5',
          isIn ? 'border-emerald-100 bg-emerald-50/50' : 'border-rose-100 bg-rose-50/50',
        )}
      >
        <span
          className={clsx(
            'grid size-10 place-items-center rounded-xl text-white shadow-md',
            isIn ? 'bg-solid-in shadow-solid-in/25' : 'bg-solid-out shadow-solid-out/25',
          )}
        >
          {isIn ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
        </span>
        <h2 className={clsx('flex-1 text-lg font-bold', isIn ? 'text-emerald-800' : 'text-rose-800')}>{title}</h2>
        <button className="icon-btn" onClick={requestClose} aria-label="Close">
          <X size={19} />
        </button>
      </div>

      <form id="entry-form" onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(['Cash In', 'Cash Out'] as TransactionType[]).map((t) => {
            const active = values.type === t;
            return (
              <button
                key={t}
                type="button"
                disabled={readOnly}
                onClick={() => set('type', t)}
                className={clsx(
                  'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold transition disabled:cursor-default',
                  active
                    ? t === 'Cash In'
                      ? 'bg-solid-in text-white shadow-md shadow-solid-in/25'
                      : 'bg-solid-out text-white shadow-md shadow-solid-out/25'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {t === 'Cash In' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                {t}
              </button>
            );
          })}
        </div>

        <fieldset disabled={readOnly} className="space-y-4">
          {/* Amount — the most important field, shown first and large */}
          <div>
            <label htmlFor="amount" className="field-label">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg font-bold text-slate-400">
                ₹
              </span>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={1}
                max={MAX_AMOUNT}
                className={clsx(
                  'field py-3 pl-9 text-lg font-bold tabular-nums',
                  isIn ? 'text-emerald-700' : 'text-rose-700',
                  err('amount') && 'field-error',
                )}
                value={values.amount}
                onChange={(e) => set('amount', e.target.value)}
                onBlur={() => touch('amount')}
                placeholder="0.00"
                autoFocus={!readOnly}
              />
            </div>
            {err('amount') && <p className="mt-1.5 text-xs font-medium text-red-600">{err('amount')}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="date" className="field-label">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                className={clsx('field', err('date') && 'field-error')}
                value={values.date}
                onChange={(e) => set('date', e.target.value)}
                onBlur={() => touch('date')}
              />
              {err('date') && <p className="mt-1.5 text-xs font-medium text-red-600">{err('date')}</p>}
            </div>
            <div>
              <label htmlFor="time" className="field-label">
                Time <span className="text-red-500">*</span>
              </label>
              <input
                id="time"
                type="time"
                className={clsx('field', err('time') && 'field-error')}
                value={values.time}
                onChange={(e) => set('time', e.target.value)}
                onBlur={() => touch('time')}
              />
              {err('time') && <p className="mt-1.5 text-xs font-medium text-red-600">{err('time')}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="category" className="field-label">
              Category
            </label>
            <select
              id="category"
              className="field"
              value={values.category}
              onChange={(e) => set('category', e.target.value)}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {values.category && !(CATEGORIES as readonly string[]).includes(values.category) && (
                <option value={values.category}>{values.category}</option>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="party" className="field-label">
              Party Name
            </label>
            <input
              id="party"
              list="party-options"
              className="field"
              value={values.party}
              onChange={(e) => set('party', e.target.value)}
              placeholder="Who was this with?"
              maxLength={100}
            />
            <datalist id="party-options">
              {parties.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="remarks" className="field-label">
              Remarks
            </label>
            <textarea
              id="remarks"
              rows={3}
              className="field resize-none"
              value={values.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              placeholder="Add a note"
              maxLength={500}
            />
          </div>
        </fieldset>
      </form>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
        {readOnly ? (
          <>
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Close
            </button>
            {canEdit && state.kind === 'view' && (
              <button type="button" className="btn-primary flex-1" onClick={() => onSwitchToEdit(state.entry)}>
                <Pencil size={16} /> Edit Entry
              </button>
            )}
          </>
        ) : (
          <>
            {isNew && (
              <button
                type="button"
                className="btn-secondary w-full sm:w-auto"
                disabled={saving}
                onClick={() => save(true)}
              >
                Save & Add New
              </button>
            )}
            <div className="flex flex-1 justify-end gap-2.5">
              <button type="button" className="btn-secondary" onClick={requestClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" form="entry-form" className={isIn ? 'btn-in' : 'btn-out'} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
