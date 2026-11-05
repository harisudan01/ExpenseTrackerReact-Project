import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from '../ui/Toast';
import { getToken, SESSION_EXPIRED_EVENT, setToken } from '../../lib/session';
import { mockApi, testUser } from '../../test/utils';

function Probe() {
  const { user, checking, login, signup, logout } = useAuth();
  return (
    <div>
      <p data-testid="state">{checking ? 'checking' : user ? `user:${user.name}` : 'guest'}</p>
      <button onClick={() => login('asha@test.dev', 'secret123').catch(() => {})}>login</button>
      <button onClick={() => signup('Asha Kumar', 'asha@test.dev', 'secret123')}>signup</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

const setup = () =>
  render(
    <ToastProvider>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </ToastProvider>,
  );

const authOk = { body: { access_token: 'new-token', token_type: 'bearer', user: testUser } };

describe('AuthProvider', () => {
  it('starts as a guest when there is no saved token', () => {
    mockApi({});
    setup();
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
  });

  it('restores the user from a saved token', async () => {
    setToken('saved');
    mockApi({ 'GET /auth/me': () => ({ body: testUser }) });
    setup();
    expect(screen.getByTestId('state')).toHaveTextContent('checking');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:Asha Kumar'));
  });

  it('drops a token the server rejects', async () => {
    setToken('stale');
    mockApi({ 'GET /auth/me': () => ({ status: 401, body: { detail: 'expired' } }) });
    setup();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('guest'));
    expect(getToken()).toBeNull();
  });

  it('keeps the token if the server is unreachable, and says so', async () => {
    setToken('saved');
    mockApi({ 'GET /auth/me': () => ({ status: 500, body: { detail: 'Database down' } }) });
    setup();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('guest'));
    expect(getToken()).toBe('saved');
    expect(screen.getByRole('status')).toHaveTextContent('Database down');
  });

  it('login stores the token and sets the user; logout clears both', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/login': () => authOk });
    setup();
    await user.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:Asha Kumar'));
    expect(getToken()).toBe('new-token');

    await user.click(screen.getByText('logout'));
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
    expect(getToken()).toBeNull();
  });

  it('signup signs the user in', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({ 'POST /auth/signup': () => ({ status: 201, ...authOk }) });
    setup();
    await user.click(screen.getByText('signup'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:Asha Kumar'));
    expect(calls[0].body).toEqual({ name: 'Asha Kumar', email: 'asha@test.dev', password: 'secret123' });
  });

  it('a failed login leaves the user signed out', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/login': () => ({ status: 401, body: { detail: 'Incorrect email or password' } }) });
    setup();
    await user.click(screen.getByText('login'));
    await waitFor(() => expect(getToken()).toBeNull());
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
  });

  it('signs out with a warning when the session expires', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/login': () => authOk });
    setup();
    await user.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:'));

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
    expect(screen.getByRole('status')).toHaveTextContent(/session has expired/i);
  });

  it('throws a helpful error when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside <AuthProvider>');
    spy.mockRestore();
  });
});
