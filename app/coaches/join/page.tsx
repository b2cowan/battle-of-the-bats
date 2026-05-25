'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, CheckCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { HudSkeleton } from '@/components/ui/HudSkeleton';
import {
  COACHES_TOURNAMENTS_PATH,
  normalizeCoachPortalNext,
} from '@/lib/coaches-portal-routes';
import styles from '../../auth/auth.module.css';

type BasicCoachTeamOption = {
  id: string;
  name: string;
  primaryCoachName: string | null;
};

type PendingRegistration = {
  id: string;
  name: string;
  coach: string | null;
};

function JoinForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const emailParam = searchParams.get('email') ?? '';
  const nextParam  = normalizeCoachPortalNext(searchParams.get('next'), COACHES_TOURNAMENTS_PATH);
  const fromReg    = searchParams.get('registered') === '1';
  const registrationId = searchParams.get('registrationId') ?? '';

  const [email, setEmail]       = useState(emailParam);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [basicCoachTeams, setBasicCoachTeams] = useState<BasicCoachTeamOption[]>([]);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [selectedBasicTeamId, setSelectedBasicTeamId] = useState('');
  const [checkingSession, setCheckingSession] = useState(Boolean(registrationId));

  useEffect(() => {
    let cancelled = false;

    async function loadSignedInCoach() {
      if (!registrationId) return;
      setCheckingSession(true);
      try {
        const { getUser } = await import('@/lib/auth');
        const user = await getUser();
        if (!user?.email) {
          if (!cancelled) setCheckingSession(false);
          return;
        }

        const res = await fetch(`/api/coaches/basic-teams?registrationId=${encodeURIComponent(registrationId)}`, { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setCheckingSession(false);
          return;
        }

        const data = await res.json() as {
          user?: { email?: string };
          teams?: BasicCoachTeamOption[];
          pendingRegistration?: PendingRegistration | null;
        };

        if (cancelled) return;
        setSignedInEmail(data.user?.email ?? user.email);
        setEmail(data.user?.email ?? user.email);
        setBasicCoachTeams(data.teams ?? []);
        setPendingRegistration(data.pendingRegistration ?? null);
        if ((data.teams ?? []).length > 0) setLinkMode('existing');
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    loadSignedInCoach();
    return () => {
      cancelled = true;
    };
  }, [registrationId]);

  async function linkRegistrationToTeam(basicCoachTeamId?: string | null) {
    if (!registrationId) return;

    const res = await fetch('/api/coaches/basic-teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId, basicCoachTeamId: basicCoachTeamId ?? null }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? 'Could not link this registration to your Coaches Portal.');
    }
  }

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
      const nextAfterLogin = registrationId
        ? `/coaches/join?registered=1&registrationId=${encodeURIComponent(registrationId)}&email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(nextParam)}`
        : nextParam;
      router.push(`/auth/login?next=${encodeURIComponent(nextAfterLogin)}&email=${encodeURIComponent(email.trim())}`);
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

    if (registrationId) {
      try {
        await linkRegistrationToTeam(null);
      } catch (linkErr) {
        setError(linkErr instanceof Error ? linkErr.message : 'Account created, but team linking failed.');
        setLoading(false);
        return;
      }
    }

    router.push(nextParam);
    router.refresh();
  }

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (linkMode === 'existing' && basicCoachTeams.length > 0 && !selectedBasicTeamId) {
        throw new Error('Select a team, or create a new team profile.');
      }
      await linkRegistrationToTeam(linkMode === 'existing' ? selectedBasicTeamId : null);
      router.push(nextParam);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish linking this registration.');
      setLoading(false);
    }
  }

  const loginNext = registrationId
    ? `/coaches/join?registered=1&registrationId=${encodeURIComponent(registrationId)}&email=${encodeURIComponent(emailParam)}&next=${encodeURIComponent(nextParam)}`
    : nextParam;
  const loginHref = `/auth/login?next=${encodeURIComponent(loginNext)}${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`;

  if (checkingSession) {
    return (
      <div className={styles.card}>
        <HudSkeleton message="CHECKING ACCOUNT..." rows={3} />
      </div>
    );
  }

  if (signedInEmail && registrationId) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <CheckCircle size={20} style={{ color: 'var(--success, #22C55E)' }} />
          </div>
          <h1 className={styles.title}>Choose Team Profile</h1>
          <p className={styles.sub}>
            {pendingRegistration?.name ?? 'This registration'} will appear in your Coaches Portal.
          </p>
        </div>

        <form onSubmit={handleLinkSubmit} className={styles.form}>
          {basicCoachTeams.length > 0 && (
            <div className="form-group">
              <label className="form-label">Coaches Portal Team</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className={`btn ${linkMode === 'existing' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                  onClick={() => setLinkMode('existing')}
                  disabled={loading}
                >
                  Existing Team
                </button>
                <button
                  type="button"
                  className={`btn ${linkMode === 'new' ? 'btn-primary' : 'btn-outline'} btn-sm`}
                  onClick={() => {
                    setLinkMode('new');
                    setSelectedBasicTeamId('');
                  }}
                  disabled={loading}
                >
                  New Team
                </button>
              </div>
              {linkMode === 'existing' && (
                <div className="select-wrapper">
                  <select
                    className="form-input"
                    value={selectedBasicTeamId}
                    onChange={e => setSelectedBasicTeamId(e.target.value)}
                    disabled={loading}
                    required
                  >
                    <option value="" disabled>Select a team</option>
                    {basicCoachTeams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="select-icon" />
                </div>
              )}
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Linking...' : 'Continue'}
          </button>
        </form>
      </div>
    );
  }

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
