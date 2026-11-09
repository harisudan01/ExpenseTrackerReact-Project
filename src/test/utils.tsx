import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';
import { ConfirmProvider } from '../components/ui/Confirm';
import { AuthProvider } from '../components/auth/AuthContext';
import { ThemeProvider } from '../components/theme/ThemeContext';
import type { ExpenseBook, ExpenseEntryApi } from '../types';

// ---------------------------------------------------------------------------
// Fake backend: tests register handlers per "METHOD /path" and fetch is stubbed
// ---------------------------------------------------------------------------

export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Record<string, string>;
}

type Handler = (req: FakeRequest) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;

/**
 * Stubs global fetch. Keys look like "GET /books" or "PUT /books/:id" (the /api prefix is stripped).
 * Unknown routes answer 404 so a missing handler fails loudly.
 */
export function mockApi(routes: Record<string, Handler>) {
  const calls: FakeRequest[] = [];
  const compiled = Object.entries(routes).map(([key, handler]) => {
    const [method, pattern] = key.split(' ');
    const re = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
    return { method, re, handler };
  });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://test.local');
    const path = url.pathname.replace(/^\/api/, '');
    const method = (init.method ?? 'GET').toUpperCase();
    const req: FakeRequest = {
      method,
      path,
      query: url.searchParams,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    calls.push(req);
    const route = compiled.find((r) => r.method === method && r.re.test(path));
    const res = route ? await route.handler(req) : { status: 404, body: { detail: `No mock for ${method} ${path}` } };
    const status = res.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(res.body ?? null), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Shows the current URL so tests can assert on navigation */
export function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

interface RenderOptions {
  /** Starting URL, optionally with router state */
  route?: string | { pathname: string; state?: unknown };
  /** Route pattern the element is mounted on (defaults to "*") */
  path?: string;
  withAuth?: boolean;
  extraRoutes?: ReactNode;
}

export function renderWithProviders(ui: ReactElement, opts: RenderOptions = {}) {
  const { route = '/', path = '*', withAuth = false, extraRoutes } = opts;
  const routes = (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
        {extraRoutes}
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
  return {
    user: userEvent.setup(),
    ...render(
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>{withAuth ? <AuthProvider>{routes}</AuthProvider> : routes}</ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>,
    ),
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const book = (over: Partial<ExpenseBook> = {}): ExpenseBook => ({
  id: 1,
  name: 'Household',
  description: 'Home expenses',
  display_order: 0,
  ...over,
});

export const apiEntry = (over: Partial<ExpenseEntryApi> = {}): ExpenseEntryApi => ({
  id: 1,
  book_id: 1,
  transaction_date: '2026-11-01',
  transaction_time: '09:30:00',
  amount: 100,
  category: 'Food',
  transaction_type: 'Cash Out',
  party: 'Shop',
  remarks: 'Lunch',
  created_at: '2026-11-01T09:30:00Z',
  updated_at: '2026-11-01T09:30:00Z',
  ...over,
});

export const testUser = { id: 7, name: 'Asha Kumar', username: 'asha_k', email: 'asha@test.dev' };
