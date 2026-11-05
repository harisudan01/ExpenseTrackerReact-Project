/** Expense book as returned by the backend */
export interface ExpenseBook {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ExpenseBookPayload {
  name: string;
  description?: string | null;
  display_order?: number;
}

export type TransactionType = 'Cash In' | 'Cash Out';

/** Expense entry as returned by the backend */
export interface ExpenseEntryApi {
  id: number;
  book_id: number;
  transaction_date: string; // 'YYYY-MM-DD'
  transaction_time: string | null; // 'HH:mm:ss'
  amount: number;
  category: string | null;
  transaction_type: TransactionType;
  party: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseEntryPayload {
  transaction_date: string;
  transaction_time: string | null;
  amount: number;
  category: string | null;
  transaction_type: TransactionType;
  party: string | null;
  remarks: string | null;
}

/** Entry shape used by the UI and the PDF report */
export interface ExpenseEntry {
  id: number;
  bookId: number;
  date: Date;
  time: string; // 'HH:mm'
  amount: number;
  category: string | null;
  paymode: TransactionType;
  party: string | null;
  remarks: string | null;
  balance?: number;
}

export interface EntryFilters {
  transaction_type?: TransactionType;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export const CATEGORIES = [
  'Food',
  'Travel',
  'Shopping',
  'Entertainment',
  'Health',
  'Groceries',
  'Bills & Utilities',
  'Education',
  'Rent',
  'Fuel',
  'Other Expenses',
] as const;
