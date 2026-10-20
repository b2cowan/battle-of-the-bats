'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { registrationReturnPath, signInHrefFor } from '@/lib/consumer-routes';
import { SIGN_IN_REASON } from '@/lib/auth-errors';
import { EmailField, StartColumn, StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import LoadingState from '@/components/shared/LoadingState';

/** The one loading line while the URL is read. */
const LOADING = <StartColumn><LoadingState label="Loading password reset…" /></StartColumn>;

/** FORGOT PASSWORD (The first look 2c, U4 screens 1–3): the email, the sent block, and a reset link that failed. */
function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  // From the registration form's sign-in step (Register Your Existing Team, Stage 1), or from sign-in opened with one:
  // the reset brings the coach back to that registration. Only a public registration page is carried — anything else
  // is dropped here and again by the server.
  const returnTo = registrationReturnPath(searchParams.get('next'));
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'limited'>('idle');
  // Once a new link is on its way, the notice about the old one has done its job (it stays gone after "Use a different
  // email"). A reset link that could not be used — expired, already used, or broken — lands here with the reason (U4
  // screen 3).
  const [sentOnce, setSentOnce] = useState(false);
  const showExpired = searchParams.get('reason') === SIGN_IN_REASON.expiredLink && !sentOnce;
  const signInHref = signInHrefFor(returnTo ?? '');

  // The sent block takes focus when it opens: the button that submitted the form is gone, and a screen reader reads the
  // heading and the sentence with the address (the same as the sign-up's check-your-email block).
  const sentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === 'sent') sentRef.current?.focus();
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(returnTo ? { next: returnTo } : {}) }),
      });
      // The route's limit (three links an hour per address): a wait, nobody's mistake, said as one (owner 2026-10-20).
      if (res.status === 429) { setStatus('limited'); return; }
      if (!res.ok) throw new Error(`forgot-password ${res.status}`);
      // Always "check your email" — the route answers the same for every address, so this never reveals an account.
      setStatus('sent');
      setSentOnce(true);
    } catch {
      // Nothing was sent; say so rather than promise a link that will not come (plan rule 7, owner at the 2c gate).
      setStatus('failed');
    }
  }

  if (status === 'sent') {
    return (
      <StartColumn>
        <div className={accountForm.focusBlock} tabIndex={-1} ref={sentRef}>
          <StartHead
            title="Check your email"
            sub={
              <>
                If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your spam folder too.
                {/* Only the coach who started from a registration (owner at the 2c gate): their one worry is their place. */}
                {returnTo && ' Once you set a new password, you’ll come back to your registration.'}
              </>
            }
          />
          <StartFoot split>
            <button type="button" className={accountForm.footLink} onClick={() => setStatus('idle')}>Use a different email</button>
            <Link href={signInHref} className={accountForm.footLink}>Back to sign in</Link>
          </StartFoot>
        </div>
      </StartColumn>
    );
  }

  return (
    <StartColumn>
      <StartHead title="Reset your password" sub="Enter your email and we’ll send you a link." />

      <form onSubmit={handleSubmit} className={accountForm.form}>
        {showExpired && (
          <div className={accountForm.noticeWarn} role="status">
            <strong>That link has expired or was already used.</strong>{' '}
            Request a new one below.
          </div>
        )}

        {/* The cursor starts in the field, except under the notice: a screen reader starts where the cursor is, and
            would skip the sentence that says why the person is here. */}
        {/* Held while sending, so "Check your email" names the address the link went to. */}
        <EmailField id="forgot-email" value={email} onChange={setEmail} autoFocus={!showExpired} disabled={status === 'sending'} />

        {status === 'failed' && (
          <div className={accountForm.noticeWarn} role="alert">
            <strong>We couldn’t send the link.</strong>{' '}
            Check your connection and try again.
          </div>
        )}
        {status === 'limited' && (
          <div className={accountForm.noticeWarn} role="alert">
            <strong>Too many tries.</strong>{' '}
            Wait a while, then try again. Check your inbox and spam folder for a link you already asked for.
          </div>
        )}

        <button type="submit" className={accountForm.primary} disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send me a reset link'}
        </button>
      </form>

      <StartFoot>
        <p>
          Remembered it?{' '}
          <Link href={signInHref} className={accountForm.footLink}>Sign in</Link>
        </p>
      </StartFoot>
    </StartColumn>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={LOADING}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
