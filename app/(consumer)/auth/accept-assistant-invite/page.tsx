'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle, UserPlus } from 'lucide-react';
import { HudSkeleton } from '@/components/ui/HudSkeleton';
import styles from '../auth.module.css';

interface InviteInfo {
  status: string;
  teamName: string | null;
  orgName: string | null;
  invitedByName: string | null;
  invitedEmail: string;
  expired: boolean;
}

function AcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [fatal, setFatal] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setFatal('This invite link is missing its token.'); setLoading(false); return; }
      try {
        const res = await fetch(`/api/auth/accept-assistant-invite?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setFatal(json.error ?? 'This invite link is not valid.'); setLoading(false); return; }
        setInvite(json.invite);
        setSignedIn(!!json.signedIn);
      } catch {
        if (!cancelled) setFatal('Something went wrong loading your invite.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function acceptForSignedInUser() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/accept-assistant-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Could not accept the invite.'); setBusy(false); return; }
      router.push(`/${json.orgSlug}/coaches/teams/${json.teamId}`);
      router.refresh();
    } catch {
      setError('Could not accept the invite.'); setBusy(false);
    }
  }

  async function createAccountAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError('Enter your first and last name.'); return; }
    setBusy(true); setError('');
    const email = invite?.invitedEmail ?? '';
    const signup = await fetch('/api/auth/coach-signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName: firstName.trim(), lastName: lastName.trim() }),
    });
    if (signup.status === 409) {
      // Account already exists for this email — send them to sign in, then back here.
      const next = `/auth/accept-assistant-invite?token=${encodeURIComponent(token)}`;
      router.push(`/auth/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`);
      return;
    }
    if (!signup.ok) {
      const j = await signup.json().catch(() => ({}));
      setError(j.error ?? 'Account could not be created.'); setBusy(false); return;
    }
    const { signIn } = await import('@/lib/auth');
    const { error: signInErr } = await signIn(email, password);
    if (signInErr) { setError('Account created, but sign-in failed. Sign in from the login page.'); setBusy(false); return; }
    await acceptForSignedInUser();
  }

  if (loading) return <div className={styles.card}><HudSkeleton message="LOADING YOUR INVITE..." rows={3} /></div>;

  if (fatal || !invite) {
    return (
      <div className={styles.card}>
        <div className={styles.header}><h1 className={styles.title}>Invite unavailable</h1>
          <p className={styles.sub}>{fatal || 'This invite could not be found.'}</p></div>
      </div>
    );
  }

  if (invite.status === 'accepted') {
    return (
      <div className={styles.card}>
        <div className={styles.header}><h1 className={styles.title}>Already accepted</h1>
          <p className={styles.sub}>This invite has already been used. <Link href="/auth/login" className={styles.footerLink}>Sign in</Link> to open your team.</p></div>
      </div>
    );
  }
  if (invite.expired || (invite.status !== 'pending')) {
    return (
      <div className={styles.card}>
        <div className={styles.header}><h1 className={styles.title}>Invite expired</h1>
          <p className={styles.sub}>This invite is no longer available. Ask the head coach to send a new one.</p></div>
      </div>
    );
  }

  const teamLabel = invite.teamName ?? 'the team';
  const byLabel = invite.invitedByName ? `${invite.invitedByName} invited you` : 'You’ve been invited';

  // Signed in → one-tap accept.
  if (signedIn) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}><UserPlus size={20} /></div>
          <h1 className={styles.title}>Join {teamLabel}</h1>
          <p className={styles.sub}>{byLabel} to help coach <strong>{teamLabel}</strong>{invite.orgName ? ` at ${invite.orgName}` : ''} as an assistant coach.</p>
        </div>
        <div className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <button type="button" className="btn btn-lime" style={{ width: '100%' }} disabled={busy} onClick={acceptForSignedInUser}>
            {busy ? 'Joining…' : 'Accept & join team'}
          </button>
        </div>
      </div>
    );
  }

  // Not signed in → create an account under the invited email, then accept.
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconWrap}><UserPlus size={20} /></div>
        <h1 className={styles.title}>Set up your account</h1>
        <p className={styles.sub}>{byLabel} to help coach <strong>{teamLabel}</strong> as an assistant coach. Create your account to accept.</p>
      </div>
      <form onSubmit={createAccountAndAccept} className={styles.form}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="ai-first">First Name</label>
            <input id="ai-first" type="text" className="form-input" value={firstName} onChange={e => setFirstName(e.target.value)} required autoComplete="given-name" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ai-last">Last Name</label>
            <input id="ai-last" type="text" className="form-input" value={lastName} onChange={e => setLastName(e.target.value)} required autoComplete="family-name" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ai-email">Email</label>
          <input id="ai-email" type="email" className="form-input" value={invite.invitedEmail} readOnly disabled />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ai-pw">Password</label>
          <div className={styles.pwWrap}>
            <input id="ai-pw" type={showPw ? 'text' : 'password'} className="form-input" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Create a password" required minLength={8} autoComplete="new-password" />
            <button type="button" className={styles.pwToggle} onClick={() => setShowPw(s => !s)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Minimum 8 characters</p>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button type="submit" className="btn btn-lime" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Setting up…' : 'Create account & join'}
        </button>
      </form>
      <div className={styles.footer}>
        <p className={styles.footerText}>
          Already have an account?{' '}
          <Link href={`/auth/login?next=${encodeURIComponent(`/auth/accept-assistant-invite?token=${token}`)}&email=${encodeURIComponent(invite.invitedEmail)}`} className={styles.footerLink}>Sign in instead</Link>
        </p>
      </div>
    </div>
  );
}

export default function AcceptAssistantInvitePage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={<div className={styles.card}><HudSkeleton message="LOADING..." rows={3} /></div>}>
        <AcceptForm />
      </Suspense>
    </div>
  );
}
