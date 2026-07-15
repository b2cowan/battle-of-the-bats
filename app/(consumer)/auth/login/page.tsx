'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { signIn, getUser } from '@/lib/auth';
import { safeNextPath } from '@/lib/safe-redirect';
import { HudSkeleton } from '@/components/ui/HudSkeleton';
import styles from '../auth.module.css';

/**
 * Resolve the post-login destination. Honors `next` ONLY when it is a same-origin
 * path (safeNextPath — CWE-601, the same hardening signup/callback got in 696bc794)
 * AND the resolver lands the user in a real workspace (/home or /platform-admin);
 * a recovery destination (/auth/suspended, /start) always wins over a `next` the
 * session can't reach. Shared by the submit handler and the already-authenticated
 * guard so both break the J8-018 / J10-019 login loops the same way.
 */
async function resolveLoginDestination(next: string | null): Promise<string> {
  let destination = '/home';
  try {
    const res = await fetch('/api/auth/destination');
    destination = (await res.json()).destination ?? '/home';
  } catch {
    destination = '/home';
  }
  const resolverIsWorkspace = destination === '/home' || destination === '/platform-admin';
  const safeNext = safeNextPath(next, null);
  return safeNext && resolverIsWorkspace ? safeNext : destination;
}

const AUTH_ERRORS: Record<string, string> = {
  'invalid_credentials': 'Incorrect email or password. Please try again.',
  'email_not_confirmed': 'Please verify your email before signing in. Check your inbox for a confirmation link.',
  'too_many_requests':   'Too many sign-in attempts. Please wait a moment and try again.',
  'user_not_found':      'No account found for this email address.',
  'auth_timeout':        'Sign-in is taking too long. Check your connection and try again.',
  'network_error':       'Could not reach the auth service. Please try again.',
};

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // J8-018: already-authenticated guard. If a signed-in user lands on /auth/login (e.g. a layout
  // redirected them here with a `next` they can't access), forward them to a safe destination
  // instead of leaving them to re-enter credentials into a loop. Recovery destinations
  // (/auth/suspended, /start) win over an unreachable `next`.
  useEffect(() => {
    let active = true;
    (async () => {
      const user = await getUser();
      if (!active) return;
      if (user) {
        const dest = await resolveLoginDestination(searchParams.get('next'));
        if (active) router.replace(dest);
        return;
      }
      setCheckingAuth(false);
    })();
    return () => { active = false; };
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(AUTH_ERRORS[err] ?? err);
      setLoading(false);
    } else {
      // J8-018 / J10-019: resolve a safe destination — never blindly push `next` (a URL the
      // session may not be able to access → redirect back to login → loop). See
      // resolveLoginDestination.
      const dest = await resolveLoginDestination(searchParams.get('next'));
      router.push(dest);
      router.refresh();
    }
  }

  if (checkingAuth) {
    return (
      <div className={styles.card}>
        <HudSkeleton message="CHECKING SESSION..." rows={3} />
      </div>
    );
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
        {/* Brand canon: never "tournament management platform" (memory/project_brand_name). */}
        <p className={styles.sub}>FieldLogicHQ</p>
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

        <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
          <Link href="/auth/forgot-password" className={styles.footerLink} style={{ fontSize: '0.7rem' }}>
            Forgot your password?
          </Link>
        </div>

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
        {/* Fans/parents are the default audience here — plain account signup first
            (carrying `next` so they land back where they were headed). The organizer
            path is the labeled exception, via the /start front door. */}
        <p className={styles.footerText}>
          New here?{' '}
          <Link
            href={`/auth/signup?account=1${searchParams.get('next') ? `&next=${encodeURIComponent(searchParams.get('next')!)}` : ''}`}
            className={styles.footerLink}
          >
            Create a free account
          </Link>
        </p>
        <p className={styles.footerText} style={{ marginTop: '0.4rem' }}>
          Organizing an event?{' '}
          <Link href="/start" className={styles.footerLink}>Run a tournament →</Link>
        </p>
        <p className={styles.footerText} style={{ marginTop: '0.4rem' }}>
          Invited by an organization? Finish setup using the link in your
          invitation email — don&apos;t create a new account here.
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
