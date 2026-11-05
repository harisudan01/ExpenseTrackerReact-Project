import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  FileDown,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../components/auth/AuthContext';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import ThemeToggle from '../components/theme/ThemeToggle';

type Mode = 'signin' | 'signup';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same rules the backend enforces */
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains a letter', test: (p: string) => /[A-Za-z]/.test(p) },
  { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
];

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

export default function AuthPage({ mode }: { mode: Mode }) {
  const isSignup = mode === 'signup';
  const { login, signup } = useAuth();
  const toast = useToast();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Switching between Sign In and Sign Up keeps the email but clears everything else
  useEffect(() => {
    setPassword('');
    setConfirm('');
    setTouched({});
    setServerError('');
    setShowPassword(false);
  }, [mode]);

  useEffect(() => {
    document.title = `${isSignup ? 'Sign Up' : 'Sign In'} · Expense Tracker`;
    return () => {
      document.title = 'Expense Tracker';
    };
  }, [isSignup]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (isSignup && !name.trim()) e.name = 'Please enter your name';
    if (!email.trim()) e.email = 'Please enter your email';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Please enter a valid email address';
    if (!password) e.password = 'Please enter your password';
    else if (isSignup && !PASSWORD_RULES.every((r) => r.test(password)))
      e.password = 'Password does not meet the requirements';
    if (isSignup && !confirm) e.confirm = 'Please confirm your password';
    else if (isSignup && confirm !== password) e.confirm = 'Passwords do not match';
    return e;
  }, [isSignup, name, email, password, confirm]);

  const show = (k: string) => (touched[k] ? errors[k] : undefined);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const pw = strength(password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    setServerError('');
    if (Object.keys(errors).length || submitting) return;
    setSubmitting(true);
    try {
      // On success the GuestOnly guard redirects to the app
      const user = isSignup
        ? await signup(name.trim(), email.trim(), password)
        : await login(email.trim(), password);
      toast(isSignup ? `Welcome, ${user.name}! Your account is ready.` : `Welcome back, ${user.name}!`);
    } catch (err) {
      setServerError(errorMessage(err, isSignup ? 'Sign up failed. Please try again.' : 'Sign in failed. Please try again.'));
      setSubmitting(false);
    }
  };

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

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-[15px] text-slate-500">
            {isSignup
              ? 'Start tracking your cash in and cash out in minutes.'
              : 'Sign in to continue to your expense books.'}
          </p>

          {/* Sign In / Sign Up switch */}
          <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <Link
                key={m}
                to={m === 'signin' ? '/signin' : '/signup'}
                state={location.state}
                replace
                className={clsx(
                  'rounded-lg py-2 text-center text-sm font-semibold transition',
                  mode === m ? 'bg-surface-raised text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </Link>
            ))}
          </div>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {serverError && (
              <div
                role="alert"
                className="flex animate-pop-in items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                <AlertCircle size={18} className="mt-px shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {isSignup && (
              <Field label="Full name" htmlFor="name" error={show('name')}>
                <IconInput icon={<UserIcon size={17} />}>
                  <input
                    id="name"
                    className={clsx('field pl-10', show('name') && 'field-error')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => touch('name')}
                    placeholder="Your name"
                    autoComplete="name"
                    maxLength={100}
                    autoFocus
                  />
                </IconInput>
              </Field>
            )}

            <Field label="Email" htmlFor="email" error={show('email')}>
              <IconInput icon={<Mail size={17} />}>
                <input
                  id="email"
                  type="email"
                  className={clsx('field pl-10', show('email') && 'field-error')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => touch('email')}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={255}
                  autoFocus={!isSignup}
                />
              </IconInput>
            </Field>

            <Field label="Password" htmlFor="password" error={show('password')}>
              <IconInput icon={<Lock size={17} />}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={clsx('field pr-11 pl-10', show('password') && 'field-error')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => touch('password')}
                  placeholder={isSignup ? 'Create a password' : 'Your password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  maxLength={72}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </IconInput>
            </Field>

            {isSignup && password && (
              <div className="-mt-1 animate-fade-in space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid flex-1 grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={clsx(
                          'h-1.5 rounded-full transition-colors',
                          i <= pw.score ? pw.color : 'bg-slate-200',
                        )}
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
                        className={clsx(
                          'flex items-center gap-1.5 text-xs font-medium',
                          ok ? 'text-emerald-600' : 'text-slate-400',
                        )}
                      >
                        <Check size={13} strokeWidth={3} className={ok ? 'opacity-100' : 'opacity-40'} />
                        {r.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {isSignup && (
              <Field label="Confirm password" htmlFor="confirm" error={show('confirm')}>
                <IconInput icon={<ShieldCheck size={17} />}>
                  <input
                    id="confirm"
                    type={showPassword ? 'text' : 'password'}
                    className={clsx('field pl-10', show('confirm') && 'field-error')}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onBlur={() => touch('confirm')}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    maxLength={72}
                  />
                </IconInput>
              </Field>
            )}

            <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {isSignup ? 'Creating account…' : 'Signing in…'}
                </>
              ) : (
                <>
                  {isSignup ? 'Create account' : 'Sign In'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <Link
              to={isSignup ? '/signin' : '/signup'}
              state={location.state}
              replace
              className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function IconInput({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

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
