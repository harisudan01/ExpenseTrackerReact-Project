import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from './AuthContext';

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4">
        <span className="grid size-14 animate-pulse place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-teal-brand text-white shadow-lg shadow-brand-500/25">
          <Wallet size={28} />
        </span>
        <p className="text-sm font-medium text-slate-500">Loading your account…</p>
      </div>
    </div>
  );
}

/** Only for signed-in users; others are sent to Sign In and brought back afterwards */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <FullScreenLoader />;
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/**
 * Sign In / Sign Up pages. Once a user is signed in (already, or just now) they are sent to
 * the page they originally asked for, or to their books.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <FullScreenLoader />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith('/expenseApp') ? from : '/expenseApp/list'} replace />;
  }
  return <>{children}</>;
}
