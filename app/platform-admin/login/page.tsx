'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { signIn } from '@/lib/auth';
import styles from './platform-login.module.css';

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password.',
  'invalid_credentials':       'Incorrect email or password.',
  'too_many_requests':         'Too many attempts — please wait a moment.',
  'Email not confirmed':       'Account not yet confirmed.',
};

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
      setError(ERROR_MAP[err] ?? 'Sign-in failed — check your credentials.');
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
      await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: resetEmail }),
      });
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
          <div className={styles.wordmark}>
            <span className={styles.wordmarkField}>FIELD</span>
            <span className={styles.wordmarkLogic}>LOGIC</span>
            <span className={styles.wordmarkHq}>HQ</span>
          </div>
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
        <div className={styles.wordmark}>
          <span className={styles.wordmarkField}>FIELD</span>
          <span className={styles.wordmarkLogic}>LOGIC</span>
          <span className={styles.wordmarkHq}>HQ</span>
        </div>
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
      <Suspense fallback={<div className={styles.card} />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
