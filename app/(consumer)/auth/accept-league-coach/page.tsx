'use client';
/**
 * A HOUSE-LEAGUE COACH ACCEPTS THEIR INVITE (Club Tier Stage 9c, Part 5; copy §9.3, §10.3). The rep coach invite's accept
 * page (`/auth/accept-assistant-invite`), state for state — signed in as the invited address (one tap), signed in as
 * someone else (sign out and continue, the rep page's own words), an account that exists (sign in), none yet (set a
 * password) — and it opens the coach's team page, never the Coaches Portal.
 */
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LoadingState from '@/components/shared/LoadingState';
import { AccountFields, StartColumn, StartFoot, StartHead, accountForm, type AccountValues } from '@/components/auth/AccountForm';
import { accountExistsSignInHref } from '@/lib/auth-errors';

interface InviteInfo {
  status: 'pending' | 'accepted' | 'removed';
  expired: boolean;
  invitedEmail: string;
  teamName: string;
  orgName: string;
}

function AcceptForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [fatal, setFatal] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setFatal('This invite link is missing its token.'); setLoading(false); return; }
      try {
        const res = await fetch(`/api/auth/accept-league-coach?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setFatal(json.error ?? 'This invite link is not valid.'); return; }
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
      const res = await fetch('/api/auth/accept-league-coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Could not accept the invite.'); setBusy(false); return; }
      router.push(json.path);
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
    // The invite was emailed to this address, so it proves the inbox (the coach sign-up checks it is live first).
    const signup = await fetch('/api/auth/coach-signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName: firstName.trim(), lastName: lastName.trim(), inviteToken: token }),
    });
    if (signup.status === 409) {
      router.push(accountExistsSignInHref(`/auth/accept-league-coach?token=${encodeURIComponent(token)}`, email));
      return;
    }
    if (!signup.ok) {
      const j = await signup.json().catch(() => ({}));
      setError(j.error ?? 'Account could not be created.'); setBusy(false); return;
    }
    const created = await signup.json().catch(() => ({})) as { requiresEmailVerification?: boolean };
    if (created.requiresEmailVerification) {
      setError(`We sent a link to ${email}. Open it to finish creating your account, then open this invite again.`);
      setBusy(false);
      return;
    }
    const { signIn } = await import('@/lib/auth');
    const { error: signInErr } = await signIn(email, password);
    if (signInErr) { setError('Account created, but sign-in failed. Sign in from the login page.'); setBusy(false); return; }
    await acceptForSignedInUser();
  }

  async function switchAccount() {
    const { signOut } = await import('@/lib/auth');
    await signOut();
    window.location.reload();
  }

  if (loading) return <StartColumn><LoadingState label="Loading your invitation…" /></StartColumn>;
  if (fatal || !invite) {
    return <StartColumn><StartHead title="Invite unavailable" sub={fatal || 'This invite could not be found.'} /></StartColumn>;
  }
  if (invite.status === 'accepted') {
    return (
      <StartColumn>
        <StartHead title="Already accepted" sub="This invite has already been used. Sign in to open your team." />
        <Link href="/auth/login" className={accountForm.primary}>Sign in</Link>
      </StartColumn>
    );
  }
  if (invite.expired || invite.status !== 'pending') {
    return (
      <StartColumn>
        <StartHead title="Invite expired" sub="This invite is no longer available. Ask the club to send a new one." />
      </StartColumn>
    );
  }

  const title = `Coach ${invite.teamName}`;
  const inviter = `${invite.orgName || 'The club'} added you as a coach.`;
  const setField: Record<keyof AccountValues, (value: string) => void> = {
    firstName: setFirstName, lastName: setLastName, email: () => {}, password: setPassword,
  };
  const loginHref = `/auth/login?next=${encodeURIComponent(`/auth/accept-league-coach?token=${token}`)}&email=${encodeURIComponent(invite.invitedEmail)}`;
  const mismatch = signedIn && !!signedInEmail && signedInEmail.trim().toLowerCase() !== invite.invitedEmail;

  if (mismatch) {
    return (
      <StartColumn>
        <StartHead
          title="You're signed in as a different account"
          sub={<>This invite was sent to <strong>{invite.invitedEmail}</strong>, but you&apos;re signed in as{' '}
            <strong>{signedInEmail}</strong>. Sign out and continue with the invited email to coach{' '}
            <strong>{invite.teamName}</strong>.</>}
        />
        <button type="button" className={accountForm.primary} onClick={switchAccount}>
          Sign out &amp; continue as {invite.invitedEmail}
        </button>
      </StartColumn>
    );
  }
  if (signedIn) {
    return (
      <StartColumn>
        <StartHead title={title} sub={inviter} />
        <div className={accountForm.form}>
          {error && <p className={accountForm.error} role="alert">{error}</p>}
          <button type="button" className={accountForm.primary} disabled={busy} onClick={acceptForSignedInUser}>
            {busy ? 'Opening…' : 'Accept and open your team'}
          </button>
        </div>
      </StartColumn>
    );
  }
  if (accountExists) {
    return (
      <StartColumn>
        <StartHead
          title="Welcome back"
          sub={<>{inviter} You already have a FieldLogicHQ account for <strong>{invite.invitedEmail}</strong>. Sign in to open{' '}
            <strong>{invite.teamName}</strong>.</>}
        />
        <Link href={loginHref} className={accountForm.primary}>Sign in to open {invite.teamName}</Link>
        <StartFoot>
          <p>Can&apos;t remember your password?{' '}<Link href="/auth/forgot-password" className={accountForm.footLink}>Reset it</Link></p>
        </StartFoot>
      </StartColumn>
    );
  }
  return (
    <StartColumn>
      <StartHead title={title} sub={`${inviter} Set a password to finish.`} />
      <form onSubmit={createAccountAndAccept} className={accountForm.form}>
        <AccountFields
          idPrefix="lc"
          values={{ firstName, lastName, email: invite.invitedEmail, password }}
          onChange={(field, value) => setField[field](value)}
          email={false}
        />
        {error && <p className={accountForm.error} role="alert">{error}</p>}
        <button type="submit" className={accountForm.primary} disabled={busy}>
          {busy ? 'Setting up…' : 'Create account and open your team'}
        </button>
      </form>
      <StartFoot>
        <p>Already have an account?{' '}<Link href={loginHref} className={accountForm.footLink}>Sign in</Link></p>
      </StartFoot>
    </StartColumn>
  );
}

export default function AcceptLeagueCoachPage() {
  return (
    <Suspense fallback={<StartColumn><LoadingState label="Loading your invitation…" /></StartColumn>}>
      <AcceptForm />
    </Suspense>
  );
}
