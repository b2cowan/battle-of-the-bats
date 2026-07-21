'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Users } from 'lucide-react';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import authStyles from '../startForm.module.css';

async function createTeam(name: string, primaryCoachName: string | null): Promise<string> {
  const res = await fetch('/api/coaches/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, primaryCoachName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? 'Could not create your team.');
  }
  const data = await res.json() as { id: string };
  return data.id;
}

/**
 * Standalone coach team creation. When signed out, creates the (name-bearing) coach
 * account first, then the team — keeping name parity with org signup. When signed in,
 * it only creates the team.
 */
export default function StartTeamForm({ isLoggedIn, email }: { isLoggedIn: boolean; email: string | null }) {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!teamName.trim()) {
      setError('Enter a team name.');
      return;
    }

    setLoading(true);

    // Signed-in: just create the team for the live session.
    if (isLoggedIn) {
      try {
        const id = await createTeam(teamName.trim(), null);
        router.push(coachTeamPath(id));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create your team.');
        setLoading(false);
      }
      return;
    }

    // Signed-out: create the account (with a real name), sign in, then create the team.
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
      // Email already has an account — send them to sign in, then return here to name
      // the team (the signed-in branch above takes over after login).
      router.push(`/auth/login?next=${encodeURIComponent('/start/team')}&email=${encodeURIComponent(emailNorm)}`);
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
      const id = await createTeam(teamName.trim(), `${firstName.trim()} ${lastName.trim()}`.trim());
      router.push(coachTeamPath(id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account created, but team creation failed.');
      setLoading(false);
    }
  }

  return (
    <div className={authStyles.page}>
      <div className={authStyles.card}>
        <div className={authStyles.header}>
          <div className={authStyles.iconWrap}>
            <Users size={20} strokeWidth={1.6} aria-hidden />
          </div>
          <h1 className={authStyles.title}>Create Your Team Home</h1>
          <p className={authStyles.sub}>
            {isLoggedIn ? `Adding a team to ${email}` : 'A free team home — no organization needed'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={authStyles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="team-name">Team Name</label>
            <input
              id="team-name"
              type="text"
              className="form-input"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. Milton U13 Mavericks"
              required
              maxLength={120}
              autoComplete="off"
            />
          </div>

          {!isLoggedIn && (
            <>
              <div className={authStyles.divider}>account credentials</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="team-first-name">First Name</label>
                  <input
                    id="team-first-name"
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
                  <label className="form-label" htmlFor="team-last-name">Last Name</label>
                  <input
                    id="team-last-name"
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
                <label className="form-label" htmlFor="team-email">Email</label>
                <input
                  id="team-email"
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
                <label className="form-label" htmlFor="team-password">Password</label>
                <div className={authStyles.pwWrap}>
                  <input
                    id="team-password"
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
            {loading ? 'Creating…' : 'Create Team'}
          </button>

          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', textAlign: 'center' }}>
            Free, no credit card. You can add tournaments to your team later.
          </p>
        </form>

        <div className={authStyles.footer}>
          <p className={authStyles.footerText}>
            {isLoggedIn ? (
              <Link href="/discover" className={authStyles.footerLink}>← Back to your workspaces</Link>
            ) : (
              <>Already have an account?{' '}
                <Link href={`/auth/login?next=${encodeURIComponent('/start/team')}`} className={authStyles.footerLink}>Sign in</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
