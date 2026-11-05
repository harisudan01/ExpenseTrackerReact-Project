import type { ExpenseEntry } from '../types';

/** 'YYYY-MM-DD' -> local Date (avoids the UTC off-by-one-day shift) */
export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> 'YYYY-MM-DD' in local time */
export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Running balance, oldest -> newest (list is newest first) */
export function withBalances(entries: ExpenseEntry[]): ExpenseEntry[] {
  let running = 0;
  const result = [...entries];
  for (let i = result.length - 1; i >= 0; i--) {
    running += result[i].paymode === 'Cash In' ? result[i].amount : -result[i].amount;
    result[i] = { ...result[i], balance: Math.round(running * 100) / 100 };
  }
  return result;
}

export function totals(entries: ExpenseEntry[]) {
  const sum = (t: ExpenseEntry['paymode']) =>
    Math.round(entries.filter((e) => e.paymode === t).reduce((a, e) => a + e.amount, 0) * 100) / 100;
  const cashIn = sum('Cash In');
  const cashOut = sum('Cash Out');
  return { cashIn, cashOut, net: Math.round((cashIn - cashOut) * 100) / 100 };
}

const money = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const formatMoney = (n: number) => `${n < 0 ? '-' : ''}₹${money.format(Math.abs(n))}`;

/** 'HH:mm' -> 'h:mm AM/PM' */
export function formatTime(value: string): string {
  if (!value) return '';
  const [h, m] = value.split(':').map((x) => parseInt(x, 10));
  if (isNaN(h) || isNaN(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
