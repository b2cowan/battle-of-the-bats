'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { signIn } from '@/lib/auth';
import { safeNextPath } from '@/lib/safe-redirect';
import styles from '../auth.module.css';
import VerifyEmailSent from '@/components/auth/VerifyEmailSent';

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
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  // An existing account answers with a tappable Sign-in notice instead of a bare error string.
  const [accountExists, setAccountExists] = useState(false);

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
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M9 21V7l3-3 3 3v14M9 12h6" />
            </svg>
          </div>
          <h1 className={styles.title}>Create your account</h1>
          {/* Fans are this mode's main audience now (conversion sweep 2026-07-14, Journey B finding 3) — no
              invitation is implied. */}
          <p className={styles.sub}>FieldLogicHQ — your teams, scores &amp; alerts in one place</p>
        </div>

        {verificationEmail ? (
          <VerifyEmailSent
            tone="auth"
            email={verificationEmail}
            lead="Your account is almost ready. For security, verify your email to finish."
            // Neutral for both audiences of account-only signup: fans (the common case) and invited users — /home
            // surfaces any pending invitation.
            after="After you confirm, FieldLogicHQ signs you in and takes you to your home screen — any pending invitations will be waiting there."
            resendNext={safeNext ?? '/discover'}
            signInHref="/auth/login"
          />
        ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-first-name">First Name</label>
              <input
                id="signup-first-name"
                type="text"
                className="form-input"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jordan"
                required
                autoComplete="given-name"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-last-name">Last Name</label>
              <input
                id="signup-last-name"
                type="text"
                className="form-input"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Lee"
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => { setEmail(e.target.value); if (accountExists) setAccountExists(false); }}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            {accountExists && (
              <div className={styles.inlineNotice}>
                An account already exists for this email.{' '}
                <Link href="/auth/login" className={styles.footerLink}>Sign in</Link> instead.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <div className={styles.pwWrap}>
              <input
                id="signup-password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button type="button" className={styles.pwToggle} onClick={() => setShowPw(s => !s)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || accountExists}
            id="signup-submit"
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>

          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', textAlign: 'center' }}>
            Free to join. No credit card required.
          </p>
        </form>
        )}

        {!verificationEmail && (
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Already have an account?{' '}
            <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
          </p>
        </div>
        )}
      </div>
    </div>
  );
}

/** The account-only sign-up (`/auth/signup?account=1`); useSearchParams needs its boundary. */
export default function AccountOnlySignup() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <AccountOnlyForm />
    </Suspense>
  );
}
