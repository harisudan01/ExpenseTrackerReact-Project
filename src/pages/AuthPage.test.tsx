import { screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AuthPage from './AuthPage';
import { GuestOnly } from '../components/auth/RouteGuards';
import { getToken } from '../lib/session';
import { mockApi, renderWithProviders, testUser } from '../test/utils';

/** Same routing as main.tsx for the auth screens */
const renderAuth = (start: '/signin' | '/signup') =>
  renderWithProviders(
    <GuestOnly>
      <AuthPage mode="signin" />
    </GuestOnly>,
    {
      route: start,
      path: '/signin',
      withAuth: true,
      extraRoutes: (
        <>
          <Route
            path="/signup"
            element={
              <GuestOnly>
                <AuthPage mode="signup" />
              </GuestOnly>
            }
          />
          <Route path="/expenseApp/list" element={<p>books page</p>} />
          <Route path="/forgot-password" element={<p>forgot page</p>} />
        </>
      ),
    },
  );

const authOk = { body: { access_token: 'tok', token_type: 'bearer', user: testUser } };

describe('Sign In', () => {
  it('renders the sign-in form and sets the page title', () => {
    mockApi({});
    renderAuth('/signin');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
    expect(document.title).toBe('Sign In · Expense Tracker');
  });

  it('shows validation errors instead of calling the server', async () => {
    const { calls } = mockApi({});
    const { user } = renderAuth('/signin');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(screen.getByText('Please enter your email or username')).toBeInTheDocument();
    expect(screen.getByText('Please enter your password')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email or username'), 'not@an-email');
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('signs in, stores the token, greets the user and opens their books', async () => {
    const { calls } = mockApi({ 'POST /auth/login': () => authOk });
    const { user } = renderAuth('/signin');
    await user.type(screen.getByLabelText('Email or username'), '  asha@test.dev ');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('books page')).toBeInTheDocument();
    expect(calls[0].body).toEqual({ identifier: 'asha@test.dev', password: 'secret123' });
    expect(getToken()).toBe('tok');
    expect(screen.getByRole('status')).toHaveTextContent('Welcome back, Asha Kumar!');
  });

  it('signs in with a username', async () => {
    const { calls } = mockApi({ 'POST /auth/login': () => authOk });
    const { user } = renderAuth('/signin');
    await user.type(screen.getByLabelText('Email or username'), 'asha_k');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('books page')).toBeInTheDocument();
    expect(calls[0].body).toEqual({ identifier: 'asha_k', password: 'secret123' });
  });

  it('links to Forgot password', async () => {
    mockApi({});
    const { user } = renderAuth('/signin');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));
    expect(await screen.findByText('forgot page')).toBeInTheDocument();
  });

  it('shows the server error when sign-in fails', async () => {
    mockApi({ 'POST /auth/login': () => ({ status: 401, body: { detail: 'Incorrect email or password' } }) });
    const { user } = renderAuth('/signin');
    await user.type(screen.getByLabelText('Email or username'), 'asha@test.dev');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled();
  });

  it('toggles password visibility', async () => {
    mockApi({});
    const { user } = renderAuth('/signin');
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('switches to Sign Up, keeping the email but clearing the password', async () => {
    mockApi({});
    const { user } = renderAuth('/signin');
    await user.type(screen.getByLabelText('Email or username'), 'asha@test.dev');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('link', { name: 'Create one' }));

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/signup');
    expect(screen.getByLabelText('Email')).toHaveValue('asha@test.dev');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('switches to Sign Up, putting a typed username in the Username field', async () => {
    mockApi({});
    const { user } = renderAuth('/signin');
    await user.type(screen.getByLabelText('Email or username'), 'asha_k');
    await user.click(screen.getByRole('link', { name: 'Create one' }));

    expect(screen.getByLabelText('Username')).toHaveValue('asha_k');
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });
});

describe('Sign Up', () => {
  it('shows the password checklist and strength as you type', async () => {
    mockApi({});
    const { user } = renderAuth('/signup');
    const password = screen.getByLabelText('Password');

    await user.type(password, 'abc');
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('Contains a letter')).toHaveClass('text-emerald-600');
    expect(screen.getByText('Contains a number')).toHaveClass('text-slate-400');

    await user.clear(password);
    await user.type(password, 'abcdefg1');
    expect(screen.getByText('Fair')).toBeInTheDocument();

    await user.clear(password);
    await user.type(password, 'Abcdefgh1234!');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('requires name, a valid password and a matching confirmation', async () => {
    const { calls } = mockApi({});
    const { user } = renderAuth('/signup');
    await user.type(screen.getByLabelText('Email'), 'asha@test.dev');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('Please enter your name')).toBeInTheDocument();
    expect(screen.getByText('Please choose a username')).toBeInTheDocument();
    expect(screen.getByText('Password does not meet the requirements')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('rejects an invalid username', async () => {
    const { calls } = mockApi({});
    const { user } = renderAuth('/signup');
    await user.type(screen.getByLabelText('Username'), '_x');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/3-30 characters/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('asks to confirm the password when it is left empty', async () => {
    mockApi({});
    const { user } = renderAuth('/signup');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
  });

  it('creates the account and signs the user in', async () => {
    const { calls } = mockApi({ 'POST /auth/signup': () => ({ status: 201, ...authOk }) });
    const { user } = renderAuth('/signup');
    await user.type(screen.getByLabelText('Full name'), '  Asha Kumar ');
    await user.type(screen.getByLabelText('Username'), 'Asha_K');
    await user.type(screen.getByLabelText('Email'), 'asha@test.dev');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('books page')).toBeInTheDocument();
    expect(calls[0].body).toEqual({ name: 'Asha Kumar', username: 'asha_k', email: 'asha@test.dev', password: 'secret123' });
    expect(screen.getByRole('status')).toHaveTextContent('Welcome, Asha Kumar! Your account is ready.');
  });

  it('shows "email already exists" from the server', async () => {
    mockApi({
      'POST /auth/signup': () => ({ status: 409, body: { detail: 'An account with this email already exists' } }),
    });
    const { user } = renderAuth('/signup');
    await user.type(screen.getByLabelText('Full name'), 'Asha');
    await user.type(screen.getByLabelText('Username'), 'asha');
    await user.type(screen.getByLabelText('Email'), 'asha@test.dev');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists');
  });

  it('links back to Sign In', async () => {
    mockApi({});
    const { user } = renderAuth('/signup');
    await user.click(screen.getByRole('link', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/signin'));
  });
});
