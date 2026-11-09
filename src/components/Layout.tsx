import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { CalendarClock, ChevronDown, LibraryBig, LogOut, PiggyBank, ShieldCheck, Wallet } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from './ui/Toast';
import { useConfirm } from './ui/Confirm';
import { useAuth } from './auth/AuthContext';
import ThemeToggle from './theme/ThemeToggle';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

function UserMenu() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const signOut = async () => {
    setOpen(false);
    if (
      await confirm({
        title: 'Sign out?',
        message: 'You will need to sign in again to see your books.',
        confirmText: 'Sign out',
      })
    ) {
      logout();
      toast('You have been signed out', 'info');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          'flex cursor-pointer items-center gap-2.5 rounded-2xl border bg-surface py-1.5 pr-2.5 pl-1.5 shadow-xs transition hover:border-slate-300 hover:shadow-sm',
          open ? 'border-brand-500/40 ring-4 ring-brand-500/10' : 'border-slate-200',
        )}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-teal-brand text-sm font-extrabold text-white shadow-sm">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-36 text-left leading-tight md:block">
          <span className="block truncate text-sm font-bold text-slate-800">{user.name}</span>
          <span className="block truncate text-xs text-slate-500">{user.email}</span>
        </span>
        <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 animate-pop-in overflow-hidden rounded-2xl border border-slate-200 bg-surface text-slate-700 shadow-xl shadow-black/15"
        >
          <div className="flex items-center gap-3 bg-linear-to-br from-brand-ink via-[#145b75] to-teal-brand px-4 py-4 text-white">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 font-extrabold ring-1 ring-white/25">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              {user.username && <p className="truncate text-xs text-teal-100">@{user.username}</p>}
              <p className="truncate text-xs text-white/70">{user.email}</p>
            </div>
          </div>
          <div className="p-1.5">
            <button
              role="menuitem"
              onClick={signOut}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2.5 text-sm tabular-nums">
      <span className="hidden size-9 place-items-center rounded-xl bg-brand-50 text-brand-500 sm:grid">
        <CalendarClock size={18} />
      </span>
      <div className="leading-tight">
        <p className="hidden text-xs font-medium text-slate-500 sm:block">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <p className="font-bold text-slate-800">
          {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link to="/expenseApp/list" className="flex min-w-0 items-center gap-3">
      <span
        className={clsx(
          'grid size-10 shrink-0 place-items-center rounded-xl',
          dark
            ? 'bg-white/15 text-teal-100 ring-1 ring-white/20'
            : 'bg-linear-to-br from-brand-500 to-teal-brand text-white shadow-md shadow-brand-500/25',
        )}
      >
        <Wallet size={21} />
      </span>
      <span
        className={clsx(
          'truncate text-lg font-extrabold tracking-tight',
          // on very narrow phones the top bar shows just the icon, to leave room for the theme switch
          dark ? 'text-white' : 'hidden text-brand-700 min-[420px]:inline',
        )}
      >
        Expense Tracker
      </span>
    </Link>
  );
}

/** Dark brand sidebar, shown on large screens */
function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-hidden bg-linear-to-b from-brand-ink via-[#145b75] to-teal-brand p-6 text-white lg:flex">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-teal-300/10 blur-3xl" />

      <div className="relative">
        <Logo dark />
      </div>

      <nav className="relative mt-10 space-y-1">
        <p className="mb-2 px-3 text-[11px] font-bold tracking-widest text-white/50 uppercase">Menu</p>
        <NavLink
          to="/expenseApp/list"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              isActive ? 'bg-white text-brand-ink shadow-lg shadow-black/10' : 'text-white/80 hover:bg-white/10 hover:text-white',
            )
          }
        >
          <LibraryBig size={19} />
          My Books
        </NavLink>
      </nav>

      <div className="relative mt-auto space-y-3">
        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
          <span className="grid size-9 place-items-center rounded-xl bg-white/15 text-teal-100">
            <PiggyBank size={19} />
          </span>
          <p className="mt-3 text-sm font-bold">Let&apos;s make smart savings today 💰</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            Record every cash in and cash out the day it happens, and your balance will always be right.
          </p>
        </div>
        <p className="flex items-center gap-2 px-1 text-xs text-white/60">
          <ShieldCheck size={14} /> Your books are private to your account
        </p>
      </div>
    </aside>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-surface/75 backdrop-blur-xl">
          {/* Phone: logo · user. Tablet: logo · clock · user. Desktop (logo is in the sidebar): clock · user */}
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-10">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="ml-auto hidden sm:block lg:ml-0">
              <LiveClock />
            </div>
            <div className="ml-auto flex items-center gap-2.5 pl-2 sm:gap-3">
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
