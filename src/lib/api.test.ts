import { describe, expect, it, vi } from 'vitest';
import { apiEntry, book, mockApi } from '../test/utils';
import { ApiError, authApi, bookApi, entryApi, errorMessage } from './api';
import { isSignedIn, SESSION_EXPIRED_EVENT, setSignedIn } from './session';

describe('request basics', () => {
  it('sends the session cookie and never an Authorization header', async () => {
    setSignedIn(true);
    const { fetchMock, calls } = mockApi({ 'GET /books': () => ({ body: [] }) });
    await bookApi.getAll();
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include');
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it('calls the API on this site under /api by default', async () => {
    const { fetchMock } = mockApi({ 'GET /books': () => ({ body: [] }) });
    await bookApi.getAll();
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/books');
  });

  it('turns a string FastAPI detail into the error message', async () => {
    mockApi({ 'POST /books': () => ({ status: 409, body: { detail: 'Expense book already exists' } }) });
    await expect(bookApi.create({ name: 'x' })).rejects.toMatchObject({
      message: 'Expense book already exists',
      status: 409,
    });
  });

  it('uses the first validation message from a 422 list', async () => {
    mockApi({ 'POST /auth/signup': () => ({ status: 422, body: { detail: [{ msg: 'Bad email' }, { msg: 'x' }] } }) });
    await expect(authApi.signup('a', 'u', 'b', 'c')).rejects.toThrow('Bad email');
  });

  it('falls back to the default message for an unknown error body', async () => {
    mockApi({ 'GET /books': () => ({ status: 500, body: { oops: true } }) });
    await expect(bookApi.getAll()).rejects.toThrow('Failed to load books');
  });

  it('reports an unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await bookApi.getAll().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Cannot reach the server/);
  });

  it('handles 204 No Content', async () => {
    mockApi({ 'DELETE /books/:id': () => ({ status: 204 }) });
    await expect(bookApi.delete(1)).resolves.toBeNull();
  });
});

describe('session expiry', () => {
  it('forgets the session and fires the expired event on a 401', async () => {
    setSignedIn(true);
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    mockApi({ 'GET /books': () => ({ status: 401, body: { detail: 'expired' } }) });

    await expect(bookApi.getAll()).rejects.toThrow('expired');
    expect(isSignedIn()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it('does not treat a wrong-password 401 on login as an expired session', async () => {
    setSignedIn(true);
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    mockApi({ 'POST /auth/login': () => ({ status: 401, body: { detail: 'Incorrect email or password' } }) });

    await expect(authApi.login('a@b.co', 'x')).rejects.toThrow('Incorrect email or password');
    expect(isSignedIn()).toBe(true);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});

describe('errorMessage', () => {
  it('uses the ApiError message, else the fallback', () => {
    expect(errorMessage(new ApiError('boom', 400), 'fb')).toBe('boom');
    expect(errorMessage(new ApiError('', 400), 'fb')).toBe('fb');
    expect(errorMessage(new Error('plain'), 'fb')).toBe('fb');
  });
});

describe('authApi', () => {
  it('posts to /auth/logout', async () => {
    const { calls } = mockApi({ 'POST /auth/logout': () => ({ body: { message: 'bye' } }) });
    await expect(authApi.logout()).resolves.toEqual({ message: 'bye' });
    expect(calls[0].method).toBe('POST');
  });

  it('posts credentials to login, signup and reads /me', async () => {
    const res = { user: { id: 1, name: 'A', email: 'a@b.co' } };
    const { calls } = mockApi({
      'POST /auth/login': () => ({ body: res }),
      'POST /auth/signup': () => ({ status: 201, body: res }),
      'GET /auth/me': () => ({ body: res.user }),
    });
    await authApi.login('a@b.co', 'pw');
    await authApi.signup('A', 'aa', 'a@b.co', 'pw');
    expect(await authApi.me()).toEqual(res.user);
    expect(calls[0].body).toEqual({ identifier: 'a@b.co', password: 'pw' });
    expect(calls[1].body).toEqual({ name: 'A', username: 'aa', email: 'a@b.co', password: 'pw' });
  });

  it('requests a reset link and resets the password', async () => {
    const { calls } = mockApi({
      'POST /auth/forgot-password': () => ({ body: { message: 'sent' } }),
      'POST /auth/reset-password': () => ({ body: { message: 'done' } }),
    });
    expect(await authApi.forgotPassword('asha_k')).toEqual({ message: 'sent' });
    expect(await authApi.resetPassword('tok', 'secret123')).toEqual({ message: 'done' });
    expect(calls[0].body).toEqual({ identifier: 'asha_k' });
    expect(calls[1].body).toEqual({ token: 'tok', password: 'secret123' });
  });
});

describe('bookApi', () => {
  it('calls the right endpoints', async () => {
    const { calls } = mockApi({
      'GET /books/:id': () => ({ body: book() }),
      'POST /books': () => ({ status: 201, body: book() }),
      'PUT /books/reorder': () => ({ body: [book()] }),
      'PUT /books/:id': () => ({ body: book() }),
    });
    await bookApi.getById(1);
    await bookApi.create({ name: 'N' });
    await bookApi.update(1, { name: 'N2' });
    await bookApi.reorder([3, 1, 2]);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /books/1',
      'POST /books',
      'PUT /books/1',
      'PUT /books/reorder',
    ]);
    expect(calls[3].body).toEqual({ book_ids: [3, 1, 2] });
  });
});

describe('entryApi', () => {
  it('maps API rows to UI entries with running balances', async () => {
    mockApi({
      'GET /books/:id/entries': () => ({
        body: [
          apiEntry({ id: 2, transaction_type: 'Cash Out', amount: 40, transaction_time: null }),
          apiEntry({ id: 1, transaction_type: 'Cash In', amount: 100, transaction_time: '08:15:00' }),
        ],
      }),
    });
    const [newest, oldest] = await entryApi.getByBook(1);
    expect(oldest).toMatchObject({ id: 1, paymode: 'Cash In', time: '08:15', balance: 100 });
    expect(newest).toMatchObject({ id: 2, paymode: 'Cash Out', time: '', balance: 60, bookId: 1 });
    expect(newest.date).toBeInstanceOf(Date);
  });

  it('loads a book summary', async () => {
    const summary = { book_id: 3, total_entries: 2, cash_in: 10, cash_out: 4, net_balance: 6 };
    const { calls } = mockApi({ 'GET /books/:id/entries/summary': () => ({ body: summary }) });
    expect(await entryApi.getSummary(3)).toEqual(summary);
    expect(calls[0].path).toBe('/books/3/entries/summary');
  });

  it('only sends filters that have a value', async () => {
    const { calls } = mockApi({ 'GET /books/:id/entries': () => ({ body: [] }) });
    await entryApi.getByBook(5, { transaction_type: 'Cash In', search: '', start_date: '2026-01-01' });
    expect(Object.fromEntries(calls[0].query)).toEqual({ transaction_type: 'Cash In', start_date: '2026-01-01' });
  });

  it('creates, updates and deletes entries', async () => {
    const { calls } = mockApi({
      'POST /books/:id/entries': () => ({ status: 201, body: apiEntry({ id: 9 }) }),
      'PUT /entries/:id': () => ({ body: apiEntry({ id: 9, amount: 5 }) }),
      'DELETE /entries/:id': () => ({ body: { message: 'ok' } }),
    });
    const payload = {
      transaction_date: '2026-11-01',
      transaction_time: '10:00',
      amount: 5,
      category: null,
      transaction_type: 'Cash In' as const,
      party: null,
      remarks: null,
    };
    expect((await entryApi.create(1, payload)).id).toBe(9);
    expect((await entryApi.update(9, payload)).amount).toBe(5);
    await entryApi.delete(9);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /books/1/entries',
      'PUT /entries/9',
      'DELETE /entries/9',
    ]);
  });
});
