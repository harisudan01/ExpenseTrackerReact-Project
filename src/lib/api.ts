import type {
  EntryFilters,
  ExpenseBook,
  ExpenseBookPayload,
  ExpenseEntry,
  ExpenseEntryApi,
  ExpenseEntryPayload,
} from '../types';
import { parseDate, withBalances } from './format';
import { getToken, SESSION_EXPIRED_EVENT, setToken } from './session';

const configuredApiUrl =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://expensetrackerbackend-project-1.onrender.com/api' : '/api');
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '');
const BASE_URL = normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Turn a FastAPI error body into a readable message */
function detailMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) return detail[0]?.msg ?? fallback;
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}, fallback = 'Something went wrong'): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Please check the backend is running.', 0);
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    // A rejected token anywhere except the login/signup forms means the session is over
    if (res.status === 401 && token && !path.startsWith('/auth/login') && !path.startsWith('/auth/signup')) {
      setToken(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(detailMessage(body, fallback), res.status);
  }
  return body as T;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message || fallback : fallback;
}

// ---------- auth ----------

export interface User {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, 'Sign in failed'),
  signup: (name: string, email: string, password: string) =>
    request<AuthResponse>(
      '/auth/signup',
      { method: 'POST', body: JSON.stringify({ name, email, password }) },
      'Sign up failed',
    ),
  me: () => request<User>('/auth/me', {}, 'Failed to load your account'),
};

// ---------- books ----------

export const bookApi = {
  getAll: () => request<ExpenseBook[]>('/books', {}, 'Failed to load books'),
  getById: (id: number) => request<ExpenseBook>(`/books/${id}`, {}, 'Failed to load book'),
  create: (book: ExpenseBookPayload) =>
    request<ExpenseBook>('/books', { method: 'POST', body: JSON.stringify(book) }, 'Failed to create book'),
  update: (id: number, book: ExpenseBookPayload) =>
    request<ExpenseBook>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(book) }, 'Failed to update book'),
  reorder: (bookIds: number[]) =>
    request<ExpenseBook[]>(
      '/books/reorder',
      { method: 'PUT', body: JSON.stringify({ book_ids: bookIds }) },
      'Failed to save book order',
    ),
  delete: (id: number) => request<{ message: string }>(`/books/${id}`, { method: 'DELETE' }, 'Failed to delete book'),
};

// ---------- entries ----------

export interface BookSummary {
  book_id: number;
  total_entries: number;
  cash_in: number;
  cash_out: number;
  net_balance: number;
}

function toView(e: ExpenseEntryApi): ExpenseEntry {
  return {
    id: e.id,
    bookId: e.book_id,
    date: parseDate(e.transaction_date),
    time: e.transaction_time ? e.transaction_time.slice(0, 5) : '',
    amount: Number(e.amount),
    category: e.category,
    paymode: e.transaction_type,
    party: e.party,
    remarks: e.remarks,
  };
}

export const entryApi = {
  /** Entries of a book, newest first, with running balance */
  async getByBook(bookId: number, filters: EntryFilters = {}): Promise<ExpenseEntry[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    const list = await request<ExpenseEntryApi[]>(
      `/books/${bookId}/entries${qs ? `?${qs}` : ''}`,
      {},
      'Failed to load entries',
    );
    return withBalances(list.map(toView));
  },
  /** Totals for one book, calculated by the server */
  getSummary: (bookId: number) =>
    request<BookSummary>(`/books/${bookId}/entries/summary`, {}, 'Failed to load book totals'),
  create: async (bookId: number, payload: ExpenseEntryPayload) =>
    toView(
      await request<ExpenseEntryApi>(
        `/books/${bookId}/entries`,
        { method: 'POST', body: JSON.stringify(payload) },
        'Failed to add entry',
      ),
    ),
  update: async (entryId: number, payload: ExpenseEntryPayload) =>
    toView(
      await request<ExpenseEntryApi>(
        `/entries/${entryId}`,
        { method: 'PUT', body: JSON.stringify(payload) },
        'Failed to update entry',
      ),
    ),
  delete: (entryId: number) =>
    request<{ message: string }>(`/entries/${entryId}`, { method: 'DELETE' }, 'Failed to delete entry'),
};
