import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from '../ui/Toast';
import { isSignedIn, SESSION_EXPIRED_EVENT, setSignedIn } from '../../lib/session';
import { mockApi, testUser } from '../../test/utils';

function Probe() {
  const { user, checking, login, signup, logout } = useAuth();
  return (
    <div>
      <p data-testid="state">{checking ? 'checking' : user ? `user:${user.name}` : 'guest'}</p>
      <button onClick={() => login('asha@test.dev', 'secret123').catch(() => {})}>login</button>
      <button onClick={() => signup('Asha Kumar', 'asha_k', 'asha@test.dev', 'secret123')}>signup</button>
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

const authOk = { body: { user: testUser } };

describe('AuthProvider', () => {
  it('starts as a guest when not signed in', () => {
    mockApi({});
    setup();
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
  });

  it('restores the user from the session cookie', async () => {
    setSignedIn(true);
    mockApi({ 'GET /auth/me': () => ({ body: testUser }) });
    setup();
    expect(screen.getByTestId('state')).toHaveTextContent('checking');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:Asha Kumar'));
  });

  it('forgets a session the server rejects', async () => {
    setSignedIn(true);
    mockApi({ 'GET /auth/me': () => ({ status: 401, body: { detail: 'expired' } }) });
    setup();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('guest'));
    expect(isSignedIn()).toBe(false);
  });

  it('keeps the session if the server is unreachable, and says so', async () => {
    setSignedIn(true);
    mockApi({ 'GET /auth/me': () => ({ status: 500, body: { detail: 'Database down' } }) });
    setup();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('guest'));
    expect(isSignedIn()).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Database down');
  });

  it('login marks the session and sets the user; logout ends the session on the server too', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'POST /auth/login': () => authOk,
      'POST /auth/logout': () => ({ body: { message: 'You have been signed out.' } }),
    });
    setup();
    await user.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:Asha Kumar'));
    expect(isSignedIn()).toBe(true);

    await user.click(screen.getByText('logout'));
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
    expect(isSignedIn()).toBe(false);
    await waitFor(() => expect(calls.map((c) => `${c.method} ${c.path}`)).toContain('POST /auth/logout'));
  });

  it('signs out locally even if the logout request fails', async () => {
    const user = userEvent.setup();
    mockApi({
      'POST /auth/login': () => authOk,
      'POST /auth/logout': () => ({ status: 500, body: { detail: 'down' } }),
    });
    setup();
    await user.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:'));
    await user.click(screen.getByText('logout'));
    expect(screen.getByTestId('state')).toHaveTextContent('guest');
    expect(isSignedIn()).toBe(false);
  });

  it('removes a login token saved by an older version', () => {
    localStorage.setItem('et_token', 'old-jwt');
    mockApi({});
    setup();
    expect(localStorage.getItem('et_token')).toBeNull();
  });

  it('signup signs the user in', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({ 'POST /auth/signup': () => ({ status: 201, ...authOk }) });
    setup();
    await user.click(screen.getByText('signup'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:Asha Kumar'));
    expect(calls[0].body).toEqual({ name: 'Asha Kumar', username: 'asha_k', email: 'asha@test.dev', password: 'secret123' });
  });

  it('a failed login leaves the user signed out', async () => {
    const user = userEvent.setup();
    mockApi({ 'POST /auth/login': () => ({ status: 401, body: { detail: 'Incorrect email or password' } }) });
    setup();
    await user.click(screen.getByText('login'));
    await waitFor(() => expect(isSignedIn()).toBe(false));
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
