import { describe, expect, it } from 'vitest';
import type { ExpenseEntry } from '../types';
import { formatDate, formatMoney, formatTime, parseDate, toIsoDate, totals, withBalances } from './format';

const entry = (id: number, paymode: ExpenseEntry['paymode'], amount: number): ExpenseEntry => ({
  id,
  bookId: 1,
  date: new Date(2026, 0, id),
  time: '10:00',
  amount,
  category: null,
  paymode,
  party: null,
  remarks: null,
});

describe('parseDate / toIsoDate', () => {
  it('parses YYYY-MM-DD as a local date (no UTC day shift)', () => {
    const d = parseDate('2026-03-09');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 9]);
  });

  it('round-trips a date and pads month/day', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(parseDate('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('withBalances', () => {
  it('computes the running balance from oldest (last) to newest (first)', () => {
    // newest first, like the API returns
    const list = [entry(3, 'Cash Out', 30), entry(2, 'Cash In', 50), entry(1, 'Cash In', 100)];
    expect(withBalances(list).map((e) => e.balance)).toEqual([120, 150, 100]);
  });

  it('does not mutate the input and rounds to 2 decimals', () => {
    const list = [entry(2, 'Cash In', 0.2), entry(1, 'Cash In', 0.1)];
    const out = withBalances(list);
    expect(list[0].balance).toBeUndefined();
    expect(out[0].balance).toBe(0.3);
  });

  it('handles an empty list', () => {
    expect(withBalances([])).toEqual([]);
  });
});

describe('totals', () => {
  it('sums cash in, cash out and net', () => {
    const t = totals([entry(1, 'Cash In', 500), entry(2, 'Cash Out', 120.5), entry(3, 'Cash Out', 79.5)]);
    expect(t).toEqual({ cashIn: 500, cashOut: 200, net: 300 });
  });

  it('allows a negative net balance', () => {
    expect(totals([entry(1, 'Cash Out', 10)]).net).toBe(-10);
  });
});

describe('formatMoney', () => {
  it('uses ₹ and Indian digit grouping', () => {
    expect(formatMoney(1234567)).toBe('₹12,34,567');
    expect(formatMoney(12.5)).toBe('₹12.5');
  });

  it('puts the minus sign before the currency symbol', () => {
    expect(formatMoney(-250)).toBe('-₹250');
  });
});

describe('formatTime', () => {
  it.each([
    ['00:05', '12:05 AM'],
    ['09:30', '9:30 AM'],
    ['12:00', '12:00 PM'],
    ['18:07', '6:07 PM'],
  ])('%s -> %s', (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });

  it('returns empty for empty input and the raw value when invalid', () => {
    expect(formatTime('')).toBe('');
    expect(formatTime('ab:cd')).toBe('ab:cd');
  });
});

describe('formatDate', () => {
  it('formats as "DD Mon YYYY"', () => {
    expect(formatDate(new Date(2026, 10, 5))).toBe('05 Nov 2026');
  });
});
