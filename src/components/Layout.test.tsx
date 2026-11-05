import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Layout from './Layout';
import { getToken, setToken } from '../lib/session';
import { mockApi, renderWithProviders, testUser } from '../test/utils';

const renderSignedIn = async () => {
  setToken('tok');
  mockApi({ 'GET /auth/me': () => ({ body: testUser }) });
  const utils = renderWithProviders(<Layout />, { route: '/expenseApp/list', withAuth: true });
  await screen.findByText('AK'); // initials appear once /me resolves
  return utils;
};

describe('Layout', () => {
  it('shows the app name and a ticking clock', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 5, 9, 0, 0));
    mockApi({});
    renderWithProviders(<Layout />, { withAuth: true });
    // logo is in the desktop sidebar and in the phone top bar
    expect(screen.getAllByText('Expense Tracker')).toHaveLength(2);
    expect(screen.getByText('Thursday, November 5, 2026')).toBeInTheDocument();
    expect(screen.getByText(/9:00:00 AM/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/9:00:01 AM/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows the user menu with name and email', async () => {
    const { user } = await renderSignedIn();
    await user.click(screen.getByRole('button', { expanded: false }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Asha Kumar')).toBeInTheDocument();
    expect(within(menu).getByText('asha@test.dev')).toBeInTheDocument();
  });

  it('closes the menu on Escape and outside click', async () => {
    const { user } = await renderSignedIn();
    await user.click(screen.getByRole('button', { expanded: false }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByText(/smart savings today/));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('has a sidebar with the active "My Books" link', async () => {
    await renderSignedIn();
    const link = screen.getByRole('link', { name: 'My Books' });
    expect(link).toHaveAttribute('href', '/expenseApp/list');
    expect(link).toHaveClass('bg-white'); // active style on the books route
  });

  it('signs out after confirmation', async () => {
    const { user } = await renderSignedIn();
    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sign out' }));

    expect(getToken()).toBeNull();
    expect(screen.queryByText('AK')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You have been signed out');
  });

  it('stays signed in if sign out is cancelled', async () => {
    const { user } = await renderSignedIn();
    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(getToken()).toBe('tok');
    expect(screen.getByText('AK')).toBeInTheDocument();
  });
});
