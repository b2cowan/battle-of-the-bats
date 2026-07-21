'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Eye, EyeOff } from 'lucide-react';
import authStyles from '../startForm.module.css';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function createLeague(orgName: string): Promise<string> {
  const res = await fetch('/api/league/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgName }),
  });
  const data = await res.json().catch(() => ({})) as { ok?: boolean; orgSlug?: string; error?: string };
  if (!res.ok || !data.orgSlug) {
    throw new Error(data.error ?? 'Could not create your league.');
  }
  return data.orgSlug;
}

/**
 * Free League Starter create form (capped beta). When signed out, creates the (name-bearing)
 * account first, then the league workspace — keeping name parity with org signup. When signed in,
 * it only creates the league. On success it lands in the existing house-league onboarding wizard.
 */
export default function StartLeagueForm({ isLoggedIn, email }: { isLoggedIn: boolean; email: string | null }) {
  const router = useRouter();
  const [leagueName, setLeagueName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const previewSlug = slugify(leagueName) || 'your-league';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!leagueName.trim()) {
      setError('Enter a league name.');
      return;
    }

    setLoading(true);

    // Signed-in: just create the league for the live session.
    if (isLoggedIn) {
      try {
        const slug = await createLeague(leagueName.trim());
        router.push(`/${slug}/admin/onboarding`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create your league.');
        setLoading(false);
      }
      return;
    }

    // Signed-out: create the account (with a real name), sign in, then create the league.
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      setLoading(false);
      return;
    }
    const emailNorm = signupEmail.trim().toLowerCase();

    const signupRes = await fetch('/api/auth/coach-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailNorm, password, firstName: firstName.trim(), lastName: lastName.trim() }),
    });

    if (signupRes.status === 409) {
      // Email already has an account — send them to sign in, then return here to name the league
      // (the signed-in branch above takes over after login).
      router.push(`/auth/login?next=${encodeURIComponent('/start/league')}&email=${encodeURIComponent(emailNorm)}`);
      return;
    }
    if (!signupRes.ok) {
      const data = await signupRes.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Account could not be created. Please try again.');
      setLoading(false);
      return;
    }

    const { signIn } = await import('@/lib/auth');
    const { error: signInErr } = await signIn(emailNorm, password);
    if (signInErr) {
      setError('Account created but sign-in failed. Try signing in from the login page.');
      setLoading(false);
      return;
    }

    try {
      const slug = await createLeague(leagueName.trim());
      router.push(`/${slug}/admin/onboarding`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account created, but league creation failed.');
      setLoading(false);
    }
  }

  return (
    <div className={authStyles.page}>
      <div className={authStyles.card}>
        <div className={authStyles.header}>
          <div className={authStyles.iconWrap}>
            <CalendarDays size={20} strokeWidth={1.6} aria-hidden />
          </div>
          <h1 className={authStyles.title}>Start Your Season</h1>
          <p className={authStyles.sub}>
            {isLoggedIn ? `Adding a league to ${email}` : 'A free house-league season — no credit card'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={authStyles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="league-name">League / Organization Name</label>
            <input
              id="league-name"
              type="text"
              className="form-input"
              value={leagueName}
              onChange={e => setLeagueName(e.target.value)}
              placeholder="e.g. Milton Minor Softball"
              required
              maxLength={120}
              autoComplete="organization"
            />
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', marginTop: '0.35rem' }}>
              Your public page: <span style={{ color: 'var(--logic-lime)' }}>fieldlogichq.ca/{previewSlug}</span>
            </p>
          </div>

          {!isLoggedIn && (
            <>
              <div className={authStyles.divider}>account credentials</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="league-first-name">First Name</label>
                  <input
                    id="league-first-name"
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
                  <label className="form-label" htmlFor="league-last-name">Last Name</label>
                  <input
                    id="league-last-name"
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
                <label className="form-label" htmlFor="league-email">Email</label>
                <input
                  id="league-email"
                  type="email"
                  className="form-input"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="league-password">Password</label>
                <div className={authStyles.pwWrap}>
                  <input
                    id="league-password"
                    type={showPw ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button type="button" className={authStyles.pwToggle} onClick={() => setShowPw(s => !s)}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {error && <div className={authStyles.error}>{error}</div>}

          <button type="submit" className={authStyles.submitBtn} disabled={loading}>
            {loading ? 'Creating…' : 'Start Your Season'}
          </button>

          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', textAlign: 'center' }}>
            Free — one season, one division, up to 8 teams. No credit card.
          </p>
        </form>

        <div className={authStyles.footer}>
          <p className={authStyles.footerText}>
            {isLoggedIn ? (
              <Link href="/discover" className={authStyles.footerLink}>← Back to your workspaces</Link>
            ) : (
              <>Already have an account?{' '}
                <Link href={`/auth/login?next=${encodeURIComponent('/start/league')}`} className={authStyles.footerLink}>Sign in</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
