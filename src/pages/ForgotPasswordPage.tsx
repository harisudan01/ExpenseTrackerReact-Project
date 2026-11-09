import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import { authApi, errorMessage } from '../lib/api';
import { AuthShell, EMAIL_RE, ErrorAlert, Field, IconInput, Spinner, SuccessNote } from '../components/auth/AuthUI';

/** Ask for a password reset link by email or username */
export default function ForgotPasswordPage() {
  const location = useLocation();
  const [identifier, setIdentifier] = useState(
    () => (location.state as { identifier?: string } | null)?.identifier ?? '',
  );
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  useEffect(() => {
    document.title = 'Forgot Password · Expense Tracker';
    return () => {
      document.title = 'Expense Tracker';
    };
  }, []);

  const value = identifier.trim();
  const error = !value
    ? 'Please enter your email or username'
    : value.includes('@') && !EMAIL_RE.test(value)
      ? 'Please enter a valid email address'
      : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError('');
    if (error || submitting) return;
    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword(value);
      setSentMessage(res.message);
    } catch (err) {
      setServerError(errorMessage(err, 'Could not send the reset link. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Forgot your password?</h1>
      <p className="mt-2 text-[15px] text-slate-500">
        Enter your email or username and we'll email you a link to choose a new password.
      </p>

      <form onSubmit={submit} noValidate className="mt-7 space-y-4">
        {serverError && <ErrorAlert>{serverError}</ErrorAlert>}
        {sentMessage && (
          <SuccessNote>
            {sentMessage} The link expires soon, so use it shortly. Don't forget to check your spam folder.
          </SuccessNote>
        )}

        <Field label="Email or username" htmlFor="identifier" error={touched ? error || undefined : undefined}>
          <IconInput icon={<UserIcon size={17} />}>
            <input
              id="identifier"
              className={clsx('field pl-10', touched && error && 'field-error')}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="you@example.com or username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={255}
              autoFocus
            />
          </IconInput>
        </Field>

        <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner />
              Sending link…
            </>
          ) : (
            <>
              {sentMessage ? 'Send again' : 'Send reset link'}
              <Send size={17} />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link
          to="/signin"
          className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700 hover:underline"
        >
          <ArrowLeft size={15} />
          Back to Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
