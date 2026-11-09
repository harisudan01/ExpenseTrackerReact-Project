import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { authApi, errorMessage } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import {
  AuthShell,
  ErrorAlert,
  Field,
  PasswordInput,
  PasswordStrength,
  passwordValid,
  Spinner,
} from '../components/auth/AuthUI';

/** Opened from the link in the reset email: /reset-password?token=... */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    document.title = 'Reset Password · Expense Tracker';
    return () => {
      document.title = 'Expense Tracker';
    };
  }, []);

  const errors: Record<string, string> = {};
  if (!password) errors.password = 'Please enter a new password';
  else if (!passwordValid(password)) errors.password = 'Password does not meet the requirements';
  if (!confirm) errors.confirm = 'Please confirm your new password';
  else if (confirm !== password) errors.confirm = 'Passwords do not match';

  const show = (k: string) => (touched[k] ? errors[k] : undefined);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    setServerError('');
    if (Object.keys(errors).length || submitting) return;
    setSubmitting(true);
    try {
      const res = await authApi.resetPassword(token, password);
      toast(res.message);
      navigate('/signin', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not reset your password. Please try again.'));
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Reset link missing</h1>
        <p className="mt-2 text-[15px] text-slate-500">
          This page needs the link from your password reset email. Request a new link to continue.
        </p>
        <Link to="/forgot-password" className="btn-primary mt-7 w-full py-3 text-[15px]">
          Request a new link
        </Link>
        <BackToSignIn />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-2 text-[15px] text-slate-500">After this you can sign in with your new password.</p>

      <form onSubmit={submit} noValidate className="mt-7 space-y-4">
        {serverError && (
          <ErrorAlert>
            {serverError}{' '}
            <Link to="/forgot-password" className="font-semibold underline">
              Request a new link
            </Link>
          </ErrorAlert>
        )}

        <Field label="New password" htmlFor="password" error={show('password')}>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            onBlur={() => touch('password')}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((s) => !s)}
            invalid={!!show('password')}
            placeholder="Create a new password"
            autoComplete="new-password"
            autoFocus
          />
        </Field>

        <PasswordStrength password={password} />

        <Field label="Confirm new password" htmlFor="confirm" error={show('confirm')}>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={setConfirm}
            onBlur={() => touch('confirm')}
            visible={showPassword}
            invalid={!!show('confirm')}
            placeholder="Repeat your new password"
            autoComplete="new-password"
            icon={<ShieldCheck size={17} />}
          />
        </Field>

        <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : (
            <>
              Reset password
              <KeyRound size={17} />
            </>
          )}
        </button>
      </form>

      <BackToSignIn />
    </AuthShell>
  );
}

function BackToSignIn() {
  return (
    <p className="mt-6 text-center text-sm text-slate-500">
      <Link
        to="/signin"
        className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700 hover:underline"
      >
        <ArrowLeft size={15} />
        Back to Sign In
      </Link>
    </p>
  );
}
