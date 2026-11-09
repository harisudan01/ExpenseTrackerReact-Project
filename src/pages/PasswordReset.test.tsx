import { screen } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';
import { mockApi, renderWithProviders } from '../test/utils';

const signinRoute = <Route path="/signin" element={<p>signin page</p>} />;

describe('Forgot password', () => {
  const renderForgot = (state?: unknown) =>
    renderWithProviders(<ForgotPasswordPage />, {
      route: { pathname: '/forgot-password', state },
      path: '/forgot-password',
      extraRoutes: signinRoute,
    });

  it('validates before calling the server', async () => {
    const { calls } = mockApi({});
    const { user } = renderForgot();
    expect(document.title).toBe('Forgot Password · Expense Tracker');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(screen.getByText('Please enter your email or username')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email or username'), 'bad@email');
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('pre-fills what was typed on Sign In and sends the request', async () => {
    const { calls } = mockApi({
      'POST /auth/forgot-password': () => ({ body: { message: 'If an account matches, we sent a link.' } }),
    });
    const { user } = renderForgot({ identifier: 'asha_k' });
    expect(screen.getByLabelText('Email or username')).toHaveValue('asha_k');

    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/If an account matches, we sent a link\./)).toBeInTheDocument();
    expect(calls[0].body).toEqual({ identifier: 'asha_k' });
    expect(screen.getByRole('button', { name: /send again/i })).toBeInTheDocument();
  });

  it('shows a server error', async () => {
    mockApi({ 'POST /auth/forgot-password': () => ({ status: 500, body: { detail: 'Mail server down' } }) });
    const { user } = renderForgot();
    await user.type(screen.getByLabelText('Email or username'), 'asha@test.dev');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mail server down');
  });

  it('links back to Sign In', async () => {
    mockApi({});
    const { user } = renderForgot();
    await user.click(screen.getByRole('link', { name: /back to sign in/i }));
    expect(await screen.findByText('signin page')).toBeInTheDocument();
  });
});

describe('Reset password', () => {
  const renderReset = (search = '?token=abc') =>
    renderWithProviders(<ResetPasswordPage />, {
      route: `/reset-password${search}`,
      path: '/reset-password',
      extraRoutes: (
        <>
          {signinRoute}
          <Route path="/forgot-password" element={<p>forgot page</p>} />
        </>
      ),
    });

  it('explains when the link has no token', async () => {
    mockApi({});
    const { user } = renderReset('');
    expect(screen.getByRole('heading', { name: 'Reset link missing' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Request a new link' }));
    expect(await screen.findByText('forgot page')).toBeInTheDocument();
  });

  it('validates the new password', async () => {
    const { calls } = mockApi({});
    const { user } = renderReset();
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'other');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText('Password does not meet the requirements')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('resets the password and goes to Sign In', async () => {
    const { calls } = mockApi({ 'POST /auth/reset-password': () => ({ body: { message: 'Password reset!' } }) });
    const { user } = renderReset();
    await user.type(screen.getByLabelText('New password'), 'newpass123');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('signin page')).toBeInTheDocument();
    expect(calls[0].body).toEqual({ token: 'abc', password: 'newpass123' });
    expect(screen.getByRole('status')).toHaveTextContent('Password reset!');
  });

  it('shows an expired-link error with a way to request a new one', async () => {
    mockApi({
      'POST /auth/reset-password': () => ({ status: 400, body: { detail: 'This reset link is invalid or has expired.' } }),
    });
    const { user } = renderReset();
    await user.type(screen.getByLabelText('New password'), 'newpass123');
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This reset link is invalid or has expired.');
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });
});
