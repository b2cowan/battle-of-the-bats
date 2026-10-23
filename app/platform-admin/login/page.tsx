'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { signIn } from '@/lib/auth';
import { signInErrorCopy } from '@/lib/auth-errors';
import styles from './platform-login.module.css';
import BrandLockup from '@/components/shared/BrandLockup';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';


function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Sign-in state ────────────────────────────────────────────────
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // ── Forgot-password state ────────────────────────────────────────
  const [mode,          setMode]          = useState<'login' | 'forgot'>('login');
  const [resetEmail,    setResetEmail]    = useState('');
  const [resetLoading,  setResetLoading]  = useState(false);
  const [resetSent,     setResetSent]     = useState(false);
  const [resetError,    setResetError]    = useState('');

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      // The one set of sign-in words (lib/auth-errors), the same as every customer sign-in (owner 2026-10-20).
      setError(signInErrorCopy(err));
      setLoading(false);
    } else {
      const next = searchParams.get('next') ?? '/platform-admin';
      router.push(next);
      router.refresh();
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: resetEmail }),
      });
      // The route's limit (three links an hour per address) is a refusal, never "sent" (owner 2026-10-20).
      if (res.status === 429) { setResetError('Too many tries. Wait a while, then try again.'); return; }
      if (!res.ok) { setResetError('We couldn’t send the link. Try again.'); return; }
      setResetSent(true);
    } catch {
      setResetError('Network error — please try again.');
    } finally {
      setResetLoading(false);
    }
  }

  function switchToForgot() {
    setResetEmail(email); // pre-fill if they already typed their email
    setResetSent(false);
    setResetError('');
    setMode('forgot');
  }

  // ── Forgot-password view ─────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <BrandLockup href={null} tone="mono" size={17} className={styles.wordmark} />
          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.sub}>We&apos;ll send a reset link to your email</p>
        </div>

        {resetSent ? (
          <>
            <p className={styles.resetConfirm}>
              If an account exists for <strong>{resetEmail}</strong>, a reset link is on its way. Check your inbox.
            </p>
            <button className={styles.backLink} onClick={() => setMode('login')}>
              ← Back to sign in
            </button>
          </>
        ) : (
          <form onSubmit={handleForgot} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                className={styles.input}
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="you@fieldlogichq.ca"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {resetError && <div className={styles.error}>{resetError}</div>}

            <button type="submit" className={styles.submitBtn} disabled={resetLoading}>
              {resetLoading ? 'Sending…' : 'Send Reset Link'}
            </button>

            <button type="button" className={styles.backLink} onClick={() => setMode('login')}>
              ← Back to sign in
            </button>
          </form>
        )}
      </div>
    );
  }

  // ── Sign-in view ─────────────────────────────────────────────────
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <BrandLockup href={null} tone="mono" size={17} className={styles.wordmark} />
        <h1 className={styles.title}>Staff Access</h1>
        <p className={styles.sub}>Internal platform — authorized personnel only</p>
      </div>

      <form onSubmit={handleSignIn} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="pl-email">Email</label>
          <input
            id="pl-email"
            type="email"
            className={styles.input}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@fieldlogichq.ca"
            required
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="pl-password">Password</label>
            <button type="button" className={styles.forgotLink} onClick={switchToForgot}>
              Forgot password?
            </button>
          </div>
          <div className={styles.pwWrap}>
            <input
              id="pl-password"
              type={showPw ? 'text' : 'password'}
              className={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
            <button type="button" className={styles.pwToggle} onClick={() => setShowPw(s => !s)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Authenticating…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default function PlatformLoginPage() {
  return (
    <div className={styles.page}>
      {/* A dark page in every setting; the root default bar is the paper (S4 Part B). */}
      <CoachThemeColor fixed="dark" />
      <Suspense fallback={<div className={styles.card} />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
