import { screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { GuestOnly, RequireAuth } from './RouteGuards';
import { setToken } from '../../lib/session';
import { mockApi, renderWithProviders, testUser } from '../../test/utils';

const signedIn = () => {
  setToken('tok');
  mockApi({ 'GET /auth/me': () => ({ body: testUser }) });
};

describe('RequireAuth', () => {
  it('redirects a guest to /signin', async () => {
    mockApi({});
    renderWithProviders(
      <RequireAuth>
        <p>secret page</p>
      </RequireAuth>,
      {
        route: '/expenseApp/list',
        path: '/expenseApp/list',
        withAuth: true,
        extraRoutes: <Route path="/signin" element={<p>sign in page</p>} />,
      },
    );
    expect(await screen.findByText('sign in page')).toBeInTheDocument();
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
  });

  it('shows a loader while checking, then the page for a signed-in user', async () => {
    signedIn();
    renderWithProviders(
      <RequireAuth>
        <p>secret page</p>
      </RequireAuth>,
      { route: '/expenseApp/list', path: '/expenseApp/list', withAuth: true },
    );
    expect(screen.getByText(/loading your account/i)).toBeInTheDocument();
    expect(await screen.findByText('secret page')).toBeInTheDocument();
  });
});

describe('GuestOnly', () => {
  it('shows the page to a guest', () => {
    mockApi({});
    renderWithProviders(
      <GuestOnly>
        <p>auth form</p>
      </GuestOnly>,
      { route: '/signin', path: '/signin', withAuth: true },
    );
    expect(screen.getByText('auth form')).toBeInTheDocument();
  });

  it('sends a signed-in user to their books', async () => {
    signedIn();
    renderWithProviders(
      <GuestOnly>
        <p>auth form</p>
      </GuestOnly>,
      {
        route: '/signin',
        path: '/signin',
        withAuth: true,
        extraRoutes: <Route path="/expenseApp/list" element={<p>books</p>} />,
      },
    );
    expect(await screen.findByText('books')).toBeInTheDocument();
  });

  it('returns the user to the page they originally asked for', async () => {
    signedIn();
    renderWithProviders(
      <GuestOnly>
        <p>auth form</p>
      </GuestOnly>,
      {
        route: { pathname: '/signin', state: { from: '/expenseApp/abc/view' } },
        path: '/signin',
        withAuth: true,
        extraRoutes: <Route path="/expenseApp/:id/:mode" element={<p>book detail</p>} />,
      },
    );
    expect(await screen.findByText('book detail')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/expenseApp/abc/view');
  });

  it('ignores a "from" outside the app (no open redirect)', async () => {
    signedIn();
    renderWithProviders(
      <GuestOnly>
        <p>auth form</p>
      </GuestOnly>,
      {
        route: { pathname: '/signin', state: { from: '//evil.example.com' } },
        path: '/signin',
        withAuth: true,
        extraRoutes: <Route path="/expenseApp/list" element={<p>books</p>} />,
      },
    );
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/expenseApp/list'));
  });
});
