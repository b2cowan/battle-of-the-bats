'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { HudSkeleton } from '@/components/ui/HudSkeleton';
import {
  COACHES_TOURNAMENTS_PATH,
  normalizeCoachPortalNext,
} from '@/lib/coaches-portal-routes';
import styles from '../../auth/auth.module.css';

function JoinForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const emailParam = searchParams.get('email') ?? '';
  const nextParam  = normalizeCoachPortalNext(searchParams.get('next'), COACHES_TOURNAMENTS_PATH);
  const fromReg    = searchParams.get('registered') === '1';

  const [email, setEmail]       = useState(emailParam);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/coach-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    if (res.status === 409) {
      router.push(`/auth/login?next=${encodeURIComponent(nextParam)}&email=${encodeURIComponent(email.trim())}`);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Account could not be created. Please try again.');
      setLoading(false);
      return;
    }

    const { signIn } = await import('@/lib/auth');
    const { error: signInErr } = await signIn(email.trim().toLowerCase(), password);
    if (signInErr) {
      setError('Account created but sign-in failed. Try signing in from the login page.');
      setLoading(false);
      return;
    }

    router.push(nextParam);
    router.refresh();
  }

  const loginHref = `/auth/login?next=${encodeURIComponent(nextParam)}${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`;

  return (
    <div className={styles.card}>
      {fromReg ? (
        <div className={styles.header}>
          <div className={styles.iconWrap} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <CheckCircle size={20} style={{ color: 'var(--success, #22C55E)' }} />
          </div>
          <h1 className={styles.title}>Registration Submitted</h1>
          <p className={styles.sub}>
            Create a free Coaches Portal account to track your registration status, view your schedule, and receive announcements.
          </p>
        </div>
      ) : (
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className={styles.title}>Create Your Coaches Portal Account</h1>
          <p className={styles.sub}>Track your registrations, schedule, and tournament history.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className="form-group">
          <label className="form-label" htmlFor="join-email">Email</label>
          <input
            id="join-email"
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
          <label className="form-label" htmlFor="join-password">Password</label>
          <div className={styles.pwWrap}>
            <input
              id="join-password"
              type={showPw ? 'text' : 'password'}
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button type="button" className={styles.pwToggle} onClick={() => setShowPw(s => !s)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: 'var(--text-3, rgba(241,245,249,0.45))' }}>
            Minimum 8 characters
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div className={styles.footer}>
        <p className={styles.footerText}>
          Already have an account?{' '}
          <Link href={loginHref} className={styles.footerLink}>Sign in instead</Link>
        </p>
      </div>
    </div>
  );
}

export default function CoachesJoinPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={
        <div className={styles.card}>
          <HudSkeleton message="LOADING..." rows={3} />
        </div>
      }>
        <JoinForm />
      </Suspense>
    </div>
  );
}
