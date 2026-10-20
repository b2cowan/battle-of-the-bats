'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth';
import { safeNextPath } from '@/lib/safe-redirect';
import VerifyEmailSent from '@/components/auth/VerifyEmailSent';
import { AccountFields, StartColumn, StartFoot, StartHead, accountForm, type AccountValues } from '@/components/auth/AccountForm';

/**
 * The account-only sign-up (`/auth/signup?account=1`: fans, the follow nudge, "I was invited") — the one account step
 * (The first look, Stage 1c, 2026-10-19): the start column, the shared fields, "Create account", and the one
 * check-your-email. No door and no step line: the account is the whole job.
 */
function AccountOnlyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Fan / account-only signups can carry a return path (e.g. /discover or /following) so they
  // don't land on the org-oriented /home. Validated to a same-origin relative path so it can
  // never become an open redirect (safeNextPath handles tab/backslash/protocol-relative smuggling).
  const safeNext = safeNextPath(searchParams.get('next'), null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  // Back from "Use a different email": the form opens with the cursor in the email field.
  const [changingEmail, setChangingEmail] = useState(false);
  // An existing account answers with a tappable Sign-in notice instead of a bare error string.
  const [accountExists, setAccountExists] = useState(false);
  const setField: Record<keyof AccountValues, (value: string) => void> = {
    firstName: setFirstName,
    lastName: setLastName,
    email: value => { setEmail(value); if (accountExists) setAccountExists(false); },
    password: setPassword,
  };
  const loginHref = safeNext ? `/auth/login?next=${encodeURIComponent(safeNext)}` : '/auth/login';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError('');
    setLoading(true);

    // No organization name and no door: the server makes the account alone.
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(safeNext ? { next: safeNext } : {}),
      }),
    });

    const json = await res.json();

    if (res.status === 409) {
      setAccountExists(true);
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    if (json.requiresEmailVerification) {
      // The entries stay for "Use a different email"; the password is cleared, as at every door.
      setPassword('');
      setVerificationEmail(json.email ?? email);
      setLoading(false);
      return;
    }

    const { error: signInErr } = await signIn(email, password);
    if (signInErr) {
      setError(signInErr);
      setLoading(false);
      return;
    }

    // Dev / verification-off: land on Home (/discover), where reconciliation + the
    // pending-invitations card take over.
    router.push(safeNext ?? '/discover');
    router.refresh();
  }

  return (
    <StartColumn>
      {/* Fans are this mode's main audience now (conversion sweep 2026-07-14, Journey B finding 3) — no invitation is
          implied. */}
      <StartHead title="Create your account" sub="Your teams, scores and alerts in one place." />

      {verificationEmail ? (
        <VerifyEmailSent
          tone="start"
          email={verificationEmail}
          // Neutral for both audiences of account-only signup: fans (the common case) and invited users — Home
          // surfaces any pending invitation.
          lead="Your account is almost ready. Open the link we sent to confirm your email. It brings you straight to your home screen, where any invitations are waiting."
          after="Open it on any phone or computer."
          resendNext={safeNext ?? '/discover'}
          onChangeEmail={() => { setVerificationEmail(''); setChangingEmail(true); }}
          signInHref={loginHref}
        />
      ) : (
        <>
          <form onSubmit={handleSubmit} className={accountForm.form}>
            <AccountFields
              idPrefix="signup"
              values={{ firstName, lastName, email, password }}
              onChange={(field, value) => setField[field](value)}
              autoFocus={changingEmail ? 'email' : undefined}
              emailHint={accountExists && (
                <span role="alert">An account already exists for this email. <Link href={loginHref}>Sign in</Link> instead.</span>
              )}
            />

            {error && <p className={accountForm.error} role="alert">{error}</p>}

            <button type="submit" className={accountForm.primary} disabled={loading || accountExists} id="signup-submit">
              {loading ? 'Creating…' : 'Create account'}
            </button>

            <p className={accountForm.fine}>Free to join. No credit card required.</p>
          </form>

          <StartFoot>
            <p>
              Already have an account?{' '}
              <Link href={loginHref} className={accountForm.footLink}>Sign in</Link>
            </p>
          </StartFoot>
        </>
      )}
    </StartColumn>
  );
}

/** The account-only sign-up (`/auth/signup?account=1`); useSearchParams needs its boundary. */
export default function AccountOnlySignup() {
  return (
    <Suspense fallback={<StartColumn><StartHead title="Create your account" /></StartColumn>}>
      <AccountOnlyForm />
    </Suspense>
  );
}
