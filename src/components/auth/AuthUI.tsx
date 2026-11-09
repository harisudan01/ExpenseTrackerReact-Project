import type { ReactNode } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileDown,
  Lock,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import ThemeToggle from '../theme/ThemeToggle';

/** Building blocks shared by the Sign In / Sign Up / Forgot / Reset password screens */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same rules the backend enforces: 3-30 chars, letters/numbers/_/., starting with a letter or number */
export const USERNAME_RE = /^[a-z0-9][a-z0-9_.]{2,29}$/i;

/** Same rules the backend enforces */
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains a letter', test: (p: string) => /[A-Za-z]/.test(p) },
  { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
];

export const passwordValid = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

function strength(p: string): { score: number; label: string; color: string } {
  if (!p) return { score: 0, label: '', color: '' };
  let s = PASSWORD_RULES.filter((r) => r.test(p)).length; // 0-3
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  if (s <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (s <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
  if (s <= 4) return { score: 3, label: 'Good', color: 'bg-sky-500' };
  return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
}

/** Full-page layout: brand panel on the left (large screens), the form on the right */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <main className="relative flex flex-1 items-center justify-center px-4 pt-20 pb-10 sm:px-8 lg:pt-10">
        <ThemeToggle className="absolute top-5 right-5" />
        <div className="w-full max-w-md animate-rise">
          {/* Logo for small screens, where the brand panel is hidden */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-teal-brand text-white shadow-md shadow-brand-500/25">
              <Wallet size={22} />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-brand-700">Expense Tracker</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex animate-pop-in items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
    >
      <AlertCircle size={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex animate-pop-in items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700"
    >
      <CheckCircle2 size={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  /** Shown at the right of the label row, e.g. a "Forgot password?" link */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="field-label">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function IconInput({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

/** Password input with a lock icon and a show/hide button */
export function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  visible,
  onToggleVisible,
  invalid,
  placeholder,
  autoComplete,
  autoFocus,
  icon = <Lock size={17} />,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  visible: boolean;
  /** Omit to hide the show/hide button */
  onToggleVisible?: () => void;
  invalid?: boolean;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  icon?: ReactNode;
}) {
  return (
    <IconInput icon={icon}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={clsx('field pl-10', onToggleVisible && 'pr-11', invalid && 'field-error')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={72}
      />
      {onToggleVisible && (
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      )}
    </IconInput>
  );
}

/** Strength bar and rule checklist for a new password */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const pw = strength(password);
  return (
    <div className="-mt-1 animate-fade-in space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex items-center gap-2.5">
        <div className="grid flex-1 grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={clsx('h-1.5 rounded-full transition-colors', i <= pw.score ? pw.color : 'bg-slate-200')}
            />
          ))}
        </div>
        <span className="w-12 text-right text-xs font-bold text-slate-600">{pw.label}</span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-3">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li
              key={r.label}
              className={clsx('flex items-center gap-1.5 text-xs font-medium', ok ? 'text-emerald-600' : 'text-slate-400')}
            >
              <Check size={13} strokeWidth={3} className={ok ? 'opacity-100' : 'opacity-40'} />
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

// ---------------------------------------------------------------------------

/** Left-hand brand panel with a small illustrative preview of the app (large screens only) */
function BrandPanel() {
  return (
    <aside className="relative hidden w-[46%] max-w-2xl overflow-hidden bg-linear-to-br from-brand-ink via-[#145b75] to-teal-brand p-12 text-white lg:flex lg:flex-col">
      <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 size-[28rem] rounded-full bg-teal-300/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-white/15 text-teal-100 ring-1 ring-white/20">
          <Wallet size={22} />
        </span>
        <span className="text-xl font-extrabold tracking-tight">Expense Tracker</span>
      </div>

      <div className="relative my-auto py-10">
        <h2 className="text-4xl leading-tight font-extrabold tracking-tight xl:text-5xl">
          Every rupee,
          <br />
          <span className="text-teal-200">accounted for.</span>
        </h2>
        <p className="mt-4 max-w-md text-lg text-white/75">
          Keep separate books for home, business and travel, with running balances that update as you go.
        </p>

        {/* Preview card. Illustrative sample figures, not the user's data */}
        <div className="mt-10 max-w-md rounded-2xl bg-white/95 p-5 text-slate-800 dark:bg-surface/95 shadow-2xl shadow-black/20 ring-1 ring-white/40 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-brand-700">Sample book</p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Preview</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <PreviewStat label="Cash In" value="₹48,500" className="text-emerald-600" />
            <PreviewStat label="Cash Out" value="₹31,240" className="text-rose-600" />
            <PreviewStat label="Balance" value="₹17,260" className="text-brand-700" />
          </div>
          <ul className="mt-4 space-y-2">
            <PreviewRow icon={<ArrowDownLeft size={14} />} name="Salary" amount="+₹45,000" incoming />
            <PreviewRow icon={<ArrowUpRight size={14} />} name="Groceries" amount="−₹2,340" />
            <PreviewRow icon={<ArrowUpRight size={14} />} name="Fuel" amount="−₹1,500" />
          </ul>
        </div>
      </div>

      <ul className="relative grid grid-cols-3 gap-4 text-sm text-white/80">
        <Feature icon={<BarChart3 size={18} />} text="Live balances" />
        <Feature icon={<FileDown size={18} />} text="PDF reports" />
        <Feature icon={<ShieldCheck size={18} />} text="Private to you" />
      </ul>
    </aside>
  );
}

function PreviewStat({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2.5">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={clsx('mt-0.5 text-sm font-extrabold tabular-nums', className)}>{value}</p>
    </div>
  );
}

function PreviewRow({ icon, name, amount, incoming }: { icon: ReactNode; name: string; amount: string; incoming?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <span
        className={clsx(
          'grid size-7 place-items-center rounded-lg',
          incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
        )}
      >
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium text-slate-700">{name}</span>
      <span className={clsx('text-sm font-bold tabular-nums', incoming ? 'text-emerald-600' : 'text-rose-600')}>
        {amount}
      </span>
    </li>
  );
}

function Feature({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-teal-200">{icon}</span>
      {text}
    </li>
  );
}
