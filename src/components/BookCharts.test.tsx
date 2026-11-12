import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookCharts, { balancePoints, categoryTotals, monthlyTotals } from './BookCharts';
import { withBalances } from '../lib/format';
import type { ExpenseEntry, TransactionType } from '../types';

let nextId = 1;
const entry = (date: string, amount: number, paymode: TransactionType, category: string | null = null): ExpenseEntry => {
  const [y, m, d] = date.split('-').map(Number);
  return { id: nextId++, bookId: 1, date: new Date(y, m - 1, d), time: '', amount, category, paymode, party: null, remarks: null };
};

// newest first, like the API returns
const sample = () =>
  withBalances([
    entry('2026-03-10', 200, 'Cash Out', 'Food'),
    entry('2026-03-02', 50, 'Cash Out', 'Travel'),
    entry('2026-01-20', 300, 'Cash Out', 'Food'),
    entry('2026-01-05', 1000, 'Cash In'),
  ]);

describe('monthlyTotals', () => {
  it('sums per month and fills empty months', () => {
    expect(monthlyTotals(sample())).toEqual([
      { key: '2026-01', label: 'Jan 26', cashIn: 1000, cashOut: 300 },
      { key: '2026-02', label: 'Feb 26', cashIn: 0, cashOut: 0 },
      { key: '2026-03', label: 'Mar 26', cashIn: 0, cashOut: 250 },
    ]);
  });

  it('returns nothing for no entries', () => {
    expect(monthlyTotals([])).toEqual([]);
  });
});

describe('categoryTotals', () => {
  it('ranks Cash Out categories and ignores Cash In', () => {
    const rows = categoryTotals(sample());
    expect(rows.map((r) => [r.name, r.amount])).toEqual([
      ['Food', 500],
      ['Travel', 50],
    ]);
    expect(rows[0].share).toBeCloseTo(500 / 550);
  });

  it('labels missing categories and folds the tail into Other', () => {
    const list = ['A', 'B', 'C', null, 'E', 'F', 'G'].map((c, i) => entry('2026-01-01', 100 - i, 'Cash Out', c));
    const rows = categoryTotals(list, 4);
    expect(rows.map((r) => r.name)).toEqual(['A', 'B', 'C', 'Other (4)']);
    expect(rows[3].filterable).toBe(false);
    expect(categoryTotals([entry('2026-01-01', 5, 'Cash Out')])[0]).toMatchObject({ name: 'Uncategorised', filterable: false });
  });
});

describe('balancePoints', () => {
  it('keeps the closing balance of each day, oldest first', () => {
    const list = withBalances([
      entry('2026-01-02', 30, 'Cash Out'),
      entry('2026-01-01', 20, 'Cash Out'),
      entry('2026-01-01', 100, 'Cash In'),
    ]);
    expect(balancePoints(list).map((p) => p.balance)).toEqual([80, 50]);
  });
});

describe('BookCharts', () => {
  it('filters by category when a bar is clicked and can switch to tables', async () => {
    localStorage.clear();
    const onCategory = vi.fn();
    render(<BookCharts entries={sample()} subtitle="All books" onCategory={onCategory} />);

    await userEvent.click(screen.getByTitle('Show Food entries'));
    expect(onCategory).toHaveBeenCalledWith('Food');

    await userEvent.click(screen.getByRole('button', { name: /table/i }));
    expect(screen.getByRole('columnheader', { name: 'Month' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Jan 26' })).toBeInTheDocument();
  });
});
