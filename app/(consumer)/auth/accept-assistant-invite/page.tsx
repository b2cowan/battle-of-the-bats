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
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
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
        setSignedInEmail(json.signedInEmail ?? null);
        setAccountExists(!!json.accountExists);
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

  /** Wrong-account escape: drop this session and re-run the same invite URL signed OUT, so the
   *  signed-out branches decide again for the INVITED email (sign-in if it has an account,
   *  create-account if it doesn't) rather than guessing here. Mirrors /coaches/join. */
  async function switchAccount() {
    const { signOut } = await import('@/lib/auth');
    await signOut();
    window.location.reload();
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

  const loginHref = `/auth/login?next=${encodeURIComponent(`/auth/accept-assistant-invite?token=${token}`)}&email=${encodeURIComponent(invite.invitedEmail)}`;

  // An invite is addressed to ONE email and the server enforces that on accept. Detect the
  // mismatch here so a coach signed in as somebody else (a shared laptop, a personal account on a
  // club address) is told BEFORE tapping a confident green "Accept & join team" that turns out to
  // be a 403. The old page ignored signedInEmail entirely and let them find out the hard way.
  const signedInMismatch =
    signedIn &&
    Boolean(signedInEmail) &&
    signedInEmail!.trim().toLowerCase() !== invite.invitedEmail.trim().toLowerCase();

  if (signedInMismatch) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}><UserPlus size={20} /></div>
          <h1 className={styles.title}>You&apos;re signed in as a different account</h1>
          <p className={styles.sub}>
            This invite was sent to <strong>{invite.invitedEmail}</strong>, but you&apos;re signed in as{' '}
            <strong>{signedInEmail}</strong>. Sign out and continue with the invited email to join{' '}
            <strong>{teamLabel}</strong>.
          </p>
        </div>
        <div className={styles.form}>
          <button type="button" className="btn btn-lime" style={{ width: '100%' }} onClick={switchAccount}>
            Sign out &amp; continue as {invite.invitedEmail}
          </button>
        </div>
      </div>
    );
  }

  // Signed in as the invited coach → one-tap accept.
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

  // Signed OUT, but the invited email ALREADY has an account — the common case for an assistant
  // who coaches elsewhere on the platform, or is simply on a new device. Offer sign-in as the
  // primary action instead of a create-account form they cannot complete: the old page put this
  // behind a footnote link, so the whole form had to be filled in before the 409 revealed it.
  if (accountExists) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap} style={{ background: 'rgba(var(--success-rgb), 0.12)', border: '1px solid rgba(var(--success-rgb), 0.25)' }}>
            <CheckCircle size={20} style={{ color: 'var(--success)' }} />
          </div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>
            {byLabel} to help coach <strong>{teamLabel}</strong>{invite.orgName ? ` at ${invite.orgName}` : ''} as an
            assistant coach. You already have a FieldLogicHQ account for <strong>{invite.invitedEmail}</strong> —
            sign in to join the team.
          </p>
        </div>
        <div className={styles.form}>
          <Link href={loginHref} className="btn btn-lime" style={{ width: '100%', display: 'block', textAlign: 'center' }}>
            Sign in to join {teamLabel}
          </Link>
        </div>
        <div className={styles.footer}>
          {/* NOT "create a new account instead": the create form below is hard-locked to the
              invited email, so for an address that already has an account it can only 409 and
              bounce back here. The real dead end on this screen is a forgotten password. */}
          <p className={styles.footerText}>
            Can&apos;t remember your password?{' '}
            <Link href="/auth/forgot-password" className={styles.footerLink}>Reset it</Link>
          </p>
        </div>
      </div>
    );
  }

  // Not signed in, no account yet → create one under the invited email, then accept.
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
          <Link href={loginHref} className={styles.footerLink}>Sign in instead</Link>
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
