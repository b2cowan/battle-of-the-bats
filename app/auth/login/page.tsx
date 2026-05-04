'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { signIn } from '@/lib/auth';
import { HudSkeleton } from '@/components/ui/HudSkeleton';
import styles from '../auth.module.css';

const AUTH_ERRORS: Record<string, string> = {
  'invalid_credentials': 'Incorrect email or password. Please try again.',
  'email_not_confirmed': 'Please verify your email before signing in. Check your inbox for a confirmation link.',
  'too_many_requests':   'Too many sign-in attempts. Please wait a moment and try again.',
  'user_not_found':      'No account found for this email address.',
};

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(AUTH_ERRORS[err] ?? err);
      setLoading(false);
    } else {
      const next = searchParams.get('next') ?? '/admin';
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h1 className={styles.title}>Sign In</h1>
        <p className={styles.sub}>FieldLogic — Tournament Management Platform</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="form-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <div className={styles.pwWrap}>
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              className="form-input"
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

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading}
          id="login-submit"
        >
          {loading ? 'Authenticating…' : 'Sign In'}
        </button>
      </form>

      <div className={styles.footer}>
        <p className={styles.footerText}>
          New organization?{' '}
          <Link href="/auth/signup" className={styles.footerLink}>Create account</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={
        <div className={styles.card}>
          <HudSkeleton message="VERIFYING CREDENTIALS..." rows={3} />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
