import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, AtSign, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../components/auth/AuthContext';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import {
  AuthShell,
  EMAIL_RE,
  ErrorAlert,
  Field,
  IconInput,
  PasswordInput,
  PasswordStrength,
  passwordValid,
  Spinner,
  USERNAME_RE,
} from '../components/auth/AuthUI';

type Mode = 'signin' | 'signup';

export default function AuthPage({ mode }: { mode: Mode }) {
  const isSignup = mode === 'signup';
  const { login, signup } = useAuth();
  const toast = useToast();
  const location = useLocation();

  const [name, setName] = useState('');
  /** Sign In: email or username */
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Switching between Sign In and Sign Up carries the email / username across but clears everything else
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (isSignup) {
      const v = identifier.trim();
      if (v.includes('@')) setEmail(v);
      else if (v) setUsername(v);
    } else {
      setIdentifier(email.trim() || username.trim());
    }
    setPassword('');
    setConfirm('');
    setTouched({});
    setServerError('');
    setShowPassword(false);
    // Only react to the mode changing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    document.title = `${isSignup ? 'Sign Up' : 'Sign In'} · Expense Tracker`;
    return () => {
      document.title = 'Expense Tracker';
    };
  }, [isSignup]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (isSignup) {
      if (!name.trim()) e.name = 'Please enter your name';
      if (!username.trim()) e.username = 'Please choose a username';
      else if (!USERNAME_RE.test(username.trim()))
        e.username = "3-30 characters: letters, numbers, '_' or '.', starting with a letter or number";
      if (!email.trim()) e.email = 'Please enter your email';
      else if (!EMAIL_RE.test(email.trim())) e.email = 'Please enter a valid email address';
    } else {
      const v = identifier.trim();
      if (!v) e.identifier = 'Please enter your email or username';
      else if (v.includes('@') && !EMAIL_RE.test(v)) e.identifier = 'Please enter a valid email address';
    }
    if (!password) e.password = 'Please enter your password';
    else if (isSignup && !passwordValid(password)) e.password = 'Password does not meet the requirements';
    if (isSignup && !confirm) e.confirm = 'Please confirm your password';
    else if (isSignup && confirm !== password) e.confirm = 'Passwords do not match';
    return e;
  }, [isSignup, name, identifier, username, email, password, confirm]);

  const show = (k: string) => (touched[k] ? errors[k] : undefined);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, identifier: true, username: true, email: true, password: true, confirm: true });
    setServerError('');
    if (Object.keys(errors).length || submitting) return;
    setSubmitting(true);
    try {
      // On success the GuestOnly guard redirects to the app
      const user = isSignup
        ? await signup(name.trim(), username.trim().toLowerCase(), email.trim(), password)
        : await login(identifier.trim(), password);
      toast(isSignup ? `Welcome, ${user.name}! Your account is ready.` : `Welcome back, ${user.name}!`);
    } catch (err) {
      setServerError(errorMessage(err, isSignup ? 'Sign up failed. Please try again.' : 'Sign in failed. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
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
        {serverError && <ErrorAlert>{serverError}</ErrorAlert>}

        {isSignup ? (
          <>
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

            <Field label="Username" htmlFor="username" error={show('username')}>
              <IconInput icon={<AtSign size={17} />}>
                <input
                  id="username"
                  className={clsx('field pl-10', show('username') && 'field-error')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                  onBlur={() => touch('username')}
                  placeholder="e.g. asha_k"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={30}
                />
              </IconInput>
            </Field>

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
                />
              </IconInput>
            </Field>
          </>
        ) : (
          <Field label="Email or username" htmlFor="identifier" error={show('identifier')}>
            <IconInput icon={<UserIcon size={17} />}>
              <input
                id="identifier"
                className={clsx('field pl-10', show('identifier') && 'field-error')}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onBlur={() => touch('identifier')}
                placeholder="you@example.com or username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={255}
                autoFocus
              />
            </IconInput>
          </Field>
        )}

        <Field
          label="Password"
          htmlFor="password"
          error={show('password')}
          aside={
            !isSignup && (
              <Link
                to="/forgot-password"
                state={{ identifier: identifier.trim() }}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              >
                Forgot password?
              </Link>
            )
          }
        >
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            onBlur={() => touch('password')}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((s) => !s)}
            invalid={!!show('password')}
            placeholder={isSignup ? 'Create a password' : 'Your password'}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
        </Field>

        {isSignup && <PasswordStrength password={password} />}

        {isSignup && (
          <Field label="Confirm password" htmlFor="confirm" error={show('confirm')}>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={setConfirm}
              onBlur={() => touch('confirm')}
              visible={showPassword}
              invalid={!!show('confirm')}
              placeholder="Repeat your password"
              autoComplete="new-password"
              icon={<ShieldCheck size={17} />}
            />
          </Field>
        )}

        <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner />
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
    </AuthShell>
  );
}
