'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LoadingState from '@/components/shared/LoadingState';
import { AccountFields, StartColumn, StartFoot, StartHead, accountForm, type AccountValues } from '@/components/auth/AccountForm';
import { STAFF_KIND_COPY, type StaffKind } from '@/lib/coach-capabilities';
import { accountExistsSignInHref } from '@/lib/auth-errors';

interface InviteInfo {
  status: string;
  teamName: string | null;
  orgName: string | null;
  invitedByName: string | null;
  invitedEmail: string;
  expired: boolean;
  /** The kind the invite offers (mig 288); null on an older invite, which offered an assistant seat. */
  staffKind: StaffKind | null;
  /** The seat and the door (mig 312). Only the club's "Invite a coach" offers the head seat. */
  coachRole?: 'head_coach' | 'assistant_coach';
  sentBy?: 'portal' | 'club';
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
      // The invitation was emailed to this address, so it proves the inbox: the account is ready at once (verify every
      // sign-up, 2026-10-16 — the server checks the invite is live and addressed to this email before it skips the link).
      body: JSON.stringify({ email, password, firstName: firstName.trim(), lastName: lastName.trim(), inviteToken: token }),
    });
    if (signup.status === 409) {
      // Account already exists for this email — send them to sign in, then back here.
      const next = `/auth/accept-assistant-invite?token=${encodeURIComponent(token)}`;
      router.push(accountExistsSignInHref(next, email));
      return;
    }
    if (!signup.ok) {
      const j = await signup.json().catch(() => ({}));
      setError(j.error ?? 'Account could not be created.'); setBusy(false); return;
    }
    const created = await signup.json().catch(() => ({})) as { requiresEmailVerification?: boolean };
    if (created.requiresEmailVerification) {
      // Only when the invitation stopped proving the inbox mid-way (revoked or expired just now): the link is the way in.
      setError(`We sent a link to ${email}. Open it to finish creating your account, then open this invite again.`);
      setBusy(false);
      return;
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

  if (loading) return <StartColumn><LoadingState label="Loading your invitation…" /></StartColumn>;

  if (fatal || !invite) {
    return (
      <StartColumn>
        <StartHead title="Invite unavailable" sub={fatal || 'This invite could not be found.'} />
      </StartColumn>
    );
  }

  if (invite.status === 'accepted') {
    return (
      <StartColumn>
        <StartHead title="Already accepted" sub="This invite has already been used. Sign in to open your team." />
        <Link href="/auth/login" className={accountForm.primary}>Sign in</Link>
      </StartColumn>
    );
  }
  if (invite.expired || (invite.status !== 'pending')) {
    return (
      <StartColumn>
        <StartHead
          title="Invite expired"
          sub={`This invite is no longer available. Ask ${invite.sentBy === 'club' ? 'the club' : 'the head coach'} to send a new one.`}
        />
      </StartColumn>
    );
  }

  const teamLabel = invite.teamName ?? 'the team';
  const byLabel = invite.invitedByName ? `${invite.invitedByName} invited you` : 'You’ve been invited';
  // "to help coach … as an assistant coach" was the one sentence for every invite; a treasurer or
  // a helper reading it would go looking for the lineup. The verb and the seat follow the kind.
  // ⚠ A head-coach seat has no kind (mig 312) — never let it fall through to "as an assistant coach".
  const kind = invite.coachRole === 'head_coach'
    ? { inviteVerb: 'to coach', asA: 'head coach' }
    : STAFF_KIND_COPY[invite.staffKind ?? 'assistant'];
  const verb = kind.inviteVerb;
  /**
   * ⚖ THE CLUB'S INVITATION wears Stage 1's accept page (Club Tier Stage 2, specimen 6 · 2a/2b): the
   * club, the team, the role and the inviter in the first frame — "NORTHFIELD MINOR BALL / Coach 10U A
   * as head coach / Dana Whitfield invited you." A head coach's own staff invites keep their words.
   */
  const club = invite.sentBy === 'club';
  const clubTitle = `${verb.replace(/^to /, '').replace(/^./, c => c.toUpperCase())} ${teamLabel} as ${kind.asA}`;
  // The club's name leads the sentence now that the column has no eyebrow over the heading (The first look, Stage 1c).
  const clubInviter = invite.invitedByName
    ? `${invite.invitedByName} invited you${invite.orgName ? ` to ${invite.orgName}` : ''}.`
    : `${invite.orgName ?? 'The club'} invited you.`;
  const setField: Record<keyof AccountValues, (value: string) => void> = {
    firstName: setFirstName, lastName: setLastName, email: () => {}, password: setPassword,
  };

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
      <StartColumn>
        <StartHead
          title="You're signed in as a different account"
          sub={<>This invite was sent to <strong>{invite.invitedEmail}</strong>, but you&apos;re signed in as{' '}
            <strong>{signedInEmail}</strong>. Sign out and continue with the invited email to join{' '}
            <strong>{teamLabel}</strong>.</>}
        />
        <button type="button" className={accountForm.primary} onClick={switchAccount}>
          Sign out &amp; continue as {invite.invitedEmail}
        </button>
      </StartColumn>
    );
  }

  // Signed in as the invited coach → one-tap accept.
  if (signedIn) {
    return (
      <StartColumn>
        <StartHead
          title={club ? clubTitle : `Join ${teamLabel}`}
          sub={club ? clubInviter : <>{byLabel} {verb} <strong>{teamLabel}</strong>{invite.orgName ? ` at ${invite.orgName}` : ''} as {kind.asA}.</>}
        />
        <div className={accountForm.form}>
          {error && <p className={accountForm.error} role="alert">{error}</p>}
          <button type="button" className={accountForm.primary} disabled={busy} onClick={acceptForSignedInUser}>
            {busy ? 'Joining…' : 'Accept and join team'}
          </button>
        </div>
      </StartColumn>
    );
  }

  // Signed OUT, but the invited email ALREADY has an account — the common case for an assistant
  // who coaches elsewhere on the platform, or is simply on a new device. Offer sign-in as the
  // primary action instead of a create-account form they cannot complete: the old page put this
  // behind a footnote link, so the whole form had to be filled in before the 409 revealed it.
  if (accountExists) {
    return (
      <StartColumn>
        <StartHead
          title="Welcome back"
          sub={<>{byLabel} {verb} <strong>{teamLabel}</strong>{invite.orgName ? ` at ${invite.orgName}` : ''} as{' '}
            {kind.asA}. You already have a FieldLogicHQ account for <strong>{invite.invitedEmail}</strong> —
            sign in to join the team.</>}
        />
        <Link href={loginHref} className={accountForm.primary}>Sign in to join {teamLabel}</Link>
        {/* NOT "create a new account instead": the create form below is hard-locked to the
            invited email, so for an address that already has an account it can only 409 and
            bounce back here. The real dead end on this screen is a forgotten password. */}
        <StartFoot>
          <p>
            Can&apos;t remember your password?{' '}
            <Link href="/auth/forgot-password" className={accountForm.footLink}>Reset it</Link>
          </p>
        </StartFoot>
      </StartColumn>
    );
  }

  // Not signed in, no account yet → create one under the invited email, then accept. The shared fields without the
  // email the invitation already knows (The first look, plan rule 4); one button wording for both invitations.
  return (
    <StartColumn>
      <StartHead
        title={club ? clubTitle : 'Set up your account'}
        sub={club ? `${clubInviter} Set a password to finish.` : <>{byLabel} {verb} <strong>{teamLabel}</strong> as {kind.asA}. Create your account to accept.</>}
      />
      <form onSubmit={createAccountAndAccept} className={accountForm.form}>
        <AccountFields
          idPrefix="ai"
          values={{ firstName, lastName, email: invite.invitedEmail, password }}
          onChange={(field, value) => setField[field](value)}
          email={false}
        />
        {error && <p className={accountForm.error} role="alert">{error}</p>}
        <button type="submit" className={accountForm.primary} disabled={busy}>
          {busy ? 'Setting up…' : 'Create account and join'}
        </button>
      </form>
      <StartFoot>
        <p>
          Already have an account?{' '}
          <Link href={loginHref} className={accountForm.footLink}>Sign in</Link>
        </p>
      </StartFoot>
    </StartColumn>
  );
}

export default function AcceptAssistantInvitePage() {
  return (
    <Suspense fallback={<StartColumn><LoadingState label="Loading your invitation…" /></StartColumn>}>
      <AcceptForm />
    </Suspense>
  );
}
