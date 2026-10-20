'use client';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LoadingState from '@/components/shared/LoadingState';
import ChoicePair from '@/components/shared/ChoicePair';
import { AccountFields, StartColumn, StartFoot, StartHead, accountForm, type AccountValues } from '@/components/auth/AccountForm';
import {
  COACHES_TOURNAMENTS_PATH,
  normalizeCoachPortalNext,
} from '@/lib/coaches-portal-routes';
import { alreadyRegisteredLine, differentTeamSentence, isChoosableTeam, whoRegistersSentence, type RegistrableTeam } from '@/lib/registrable-teams';
import { accountExistsSignInHref } from '@/lib/auth-errors';
import joinStyles from './join.module.css';
import VerifyEmailSent from '@/components/auth/VerifyEmailSent';

/** The pair on Choose a team profile: an existing Coaches Portal team, or a new team profile. */
const LINK_MODE_OPTIONS = [
  { value: 'existing', label: 'Existing team' },
  { value: 'new', label: 'New team' },
] as const satisfies readonly { value: 'new' | 'existing'; label: string }[];

type PendingRegistration = {
  id: string;
  name: string;
  coach: string | null;
};

/**
 * Best-effort split of a single contact name into first / last for account-creation
 * prefill ONLY. The public register form keeps one flexible "Coach / Contact Name"
 * field (teams.coach) — this never writes back to it; it just seeds the name fields a
 * coach can edit. First token → first name, remainder → last name.
 */
function splitFullName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ['', ''];
  if (parts.length === 1) return [parts[0], ''];
  return [parts[0], parts.slice(1).join(' ')];
}

function JoinForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const emailParam = searchParams.get('email') ?? '';
  const nextParam  = normalizeCoachPortalNext(searchParams.get('next'), COACHES_TOURNAMENTS_PATH);
  const fromReg    = searchParams.get('registered') === '1';
  const registrationId = searchParams.get('registrationId') ?? '';
  // Back from the verification link (verify every sign-up, 2026-10-16).
  const verifiedParam = searchParams.get('verified') === '1';
  const [firstNameInit, lastNameInit] = splitFullName(searchParams.get('coach') ?? '');

  const [email, setEmail]       = useState(emailParam);
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState(firstNameInit);
  const [lastName, setLastName]   = useState(lastNameInit);
  // Back from "Use a different email": the form opens with the cursor in the email field.
  const [changingEmail, setChangingEmail] = useState(false);
  // "Create a new account" from "You're already set up": the form opens with the cursor in the first name.
  const [startingFresh, setStartingFresh] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  // Verify every sign-up (owner 2026-10-16): the address the link went to, while the card says "check your email".
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  // The one auto-link request a return from the verification link may send (see the session effect).
  const autoLinkRef = useRef<Promise<Response> | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  // The same team list the registration form shows (D1, owner 2026-10-13; `lib/registrable-teams.ts`):
  // a Premium team under its portal's name, tagged, first — offered to its staff by the Register for
  // tournaments permission, not by membership of the free team underneath. Locked ones (staff without
  // the switch) are not choosable here either; the line under the list says who can.
  // null = the list could not be loaded — never read as "no teams", which would leave only New Team (F4).
  const [registrableTeams, setRegistrableTeams] = useState<RegistrableTeam[] | null>([]);
  // A team already in this entry's tournament is not choosable either (one team, one entry at the claim — owner
  // 2026-10-16): it gets its own line under the list, as a locked one does, naming where it already is.
  const basicCoachTeams = (registrableTeams ?? []).filter(isChoosableTeam);
  const lockedTeams = (registrableTeams ?? []).filter(t => t.locked && !t.alreadyIn);
  const alreadyInTeams = (registrableTeams ?? []).filter(t => t.alreadyIn);
  // Every Coaches Portal team, choosable or not: while one exists, New Team (or Continue, when nothing can be
  // chosen) files this entry under a free team that portal never shows — the line says so (E3, owner 2026-10-19).
  const portalTeams = (registrableTeams ?? []).filter(t => t.isPortalTeam);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [selectedBasicTeamId, setSelectedBasicTeamId] = useState('');
  const [checkingSession, setCheckingSession] = useState(Boolean(registrationId));
  const [redirecting, setRedirecting] = useState(false);
  // Signed-out + an existing account for this registration's email → offer sign-in, not a
  // redundant second "create account" form (the merged register+account flow already made it).
  const [existingAccount, setExistingAccount] = useState<{ teamName: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSignedInCoach() {
      if (!registrationId) return;
      setCheckingSession(true);
      try {
        const { getUser } = await import('@/lib/auth');
        const user = await getUser();
        if (!user?.email) {
          // No session — if this registration's coach already has an account, the page should
          // ask them to SIGN IN rather than re-collect name/password. Existence is scoped to the
          // registration's own email (server-side), so this is not an enumeration oracle.
          if (emailParam) {
            try {
              const statusRes = await fetch(
                `/api/coaches/registration-account-status?registrationId=${encodeURIComponent(registrationId)}&email=${encodeURIComponent(emailParam)}`,
                { cache: 'no-store' },
              );
              if (statusRes.ok) {
                const status = await statusRes.json() as { accountExists?: boolean; teamName?: string };
                if (!cancelled && status.accountExists) {
                  setExistingAccount({ teamName: status.teamName ?? '' });
                }
              }
            } catch {
              // Fail open to the normal create-account form.
            }
          }
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
          registrableTeams?: RegistrableTeam[] | null;
          pendingRegistration?: PendingRegistration | null;
          alreadyLinked?: boolean;
        };

        if (cancelled) return;
        // Already linked to this account → skip the "choose team" interstitial and go straight
        // to the team record (the email footer / acceptance button drive returning coaches here).
        // A Premium team's entry — including one a staff member registered — is forwarded by that
        // record to the portal's own (B6, 2026-10-13).
        if (data.alreadyLinked) {
          setRedirecting(true);
          router.replace(nextParam);
          return;
        }
        const teams = data.registrableTeams === undefined ? [] : data.registrableTeams;
        // Back from the verification link with no team to choose: link it as a new team profile and open it — the
        // same result today's Create Account reached in one step (owner drawings, screen 4). Only on a list that
        // LOADED (null = could not load, never "no teams"), and one request per visit: a re-run of this effect
        // awaits the request already sent rather than making a second team profile.
        if (verifiedParam && teams !== null && !teams.some(isChoosableTeam)) {
          autoLinkRef.current ??= fetch('/api/coaches/basic-teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationId, basicCoachTeamId: null }),
          });
          const linked = await autoLinkRef.current;
          if (linked.ok && !cancelled) {
            setRedirecting(true);
            router.replace(nextParam);
            return;
          }
        }
        setSignedInEmail(data.user?.email ?? user.email);
        setEmail(data.user?.email ?? user.email);
        setRegistrableTeams(teams);
        setPendingRegistration(data.pendingRegistration ?? null);
        if ((teams ?? []).some(isChoosableTeam)) setLinkMode('existing');
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    loadSignedInCoach();
    return () => {
      cancelled = true;
    };
  }, [registrationId, router, nextParam, emailParam, verifiedParam]);

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

    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/auth/coach-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        // Where the verification link returns: this page, signed in, which links the registration.
        next: verifyReturnPath(),
      }),
    });

    if (res.status === 409) {
      const nextAfterLogin = registrationId
        ? `/coaches/join?registered=1&registrationId=${encodeURIComponent(registrationId)}&email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(nextParam)}`
        : nextParam;
      router.push(accountExistsSignInHref(nextAfterLogin, email.trim()));
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? 'Account could not be created. Please try again.');
      setLoading(false);
      return;
    }
    const created = await res.json().catch(() => ({})) as { requiresEmailVerification?: boolean };
    if (created.requiresEmailVerification) {
      setPassword('');
      setVerifyEmail(email.trim().toLowerCase());
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

  /** Back from the verification link: this page, signed in, for this registration (or the portal when there is none). */
  function verifyReturnPath(): string {
    return registrationId
      ? `/coaches/join?registered=1&registrationId=${encodeURIComponent(registrationId)}&email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(nextParam)}&verified=1`
      : nextParam;
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

  async function handleSwitchAccount() {
    const { signOut } = await import('@/lib/auth');
    await signOut();
    // Reload the same invite URL, now signed-out: the signed-out flow re-runs and offers
    // sign-in / create-account for the INVITED email (emailParam) instead of dead-ending.
    window.location.reload();
  }

  const setField: Record<keyof AccountValues, (value: string) => void> = {
    firstName: setFirstName, lastName: setLastName, email: setEmail, password: setPassword,
  };

  const loginNext = registrationId
    ? `/coaches/join?registered=1&registrationId=${encodeURIComponent(registrationId)}&email=${encodeURIComponent(emailParam)}&next=${encodeURIComponent(nextParam)}`
    : nextParam;
  const loginHref = `/auth/login?next=${encodeURIComponent(loginNext)}${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`;

  if (checkingSession || redirecting) {
    return (
      <StartColumn>
        <LoadingState label={redirecting ? 'Loading your team…' : 'Loading your account…'} />
      </StartColumn>
    );
  }

  // Signed-out, but this registration's coach already has an account (merged register+account
  // flow, or a returning coach on a new device). Offer SIGN IN — don't re-collect name/password.
  // Sign-in lands straight on the team record (nextParam = /coaches/tournaments/{id}).
  if (existingAccount && registrationId) {
    const existingLoginHref = `/auth/login?next=${encodeURIComponent(nextParam)}${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`;
    return (
      <StartColumn>
        <StartHead
          title="You're already set up"
          sub={existingAccount.teamName
            ? <>Your Coaches Portal account is ready. Sign in to see <strong>{existingAccount.teamName}</strong> and track its status.</>
            : <>Your Coaches Portal account is ready. Sign in to see your team and track its status.</>}
        />
        <Link href={existingLoginHref} className={accountForm.primary}>Sign in to your Coaches Portal</Link>
        <StartFoot>
          <p>
            Not you, or need a different account?{' '}
            <button type="button" className={accountForm.footLink} onClick={() => { setExistingAccount(null); setStartingFresh(true); }}>
              Create a new account
            </button>
          </p>
        </StartFoot>
      </StartColumn>
    );
  }

  // Signed in, but this session can't reach the invited registration (no pending registration
  // resolved) — the classic "already signed in as a DIFFERENT coach than the invite is addressed
  // to". The link POST would 403 with a cryptic "not linked to your signed-in email" and the
  // interstitial's subtitle silently degrades to the generic "This registration". Detect it and
  // offer to switch accounts instead of showing a doomed "Choose a team profile" form.
  const signedInMismatch =
    Boolean(signedInEmail) &&
    Boolean(registrationId) &&
    !pendingRegistration &&
    (!emailParam || signedInEmail!.trim().toLowerCase() !== emailParam.trim().toLowerCase());

  if (signedInMismatch) {
    return (
      <StartColumn>
        <StartHead
          title="You're signed in as a different account"
          sub={emailParam ? (
            <>This invite is for <strong>{emailParam}</strong>, but you&apos;re signed in as{' '}
            <strong>{signedInEmail}</strong>. Sign out and continue with the invited email to open this team.</>
          ) : (
            <>You&apos;re signed in as <strong>{signedInEmail}</strong>, which isn&apos;t linked to this registration.</>
          )}
        />
        <button type="button" className={accountForm.primary} onClick={handleSwitchAccount}>
          {emailParam ? `Sign out & continue as ${emailParam}` : 'Sign out & use a different account'}
        </button>
        <StartFoot>
          <p>
            <Link href={nextParam} className={accountForm.footLink}>Stay signed in as {signedInEmail}</Link>
          </p>
        </StartFoot>
      </StartColumn>
    );
  }

  if (signedInEmail && registrationId) {
    return (
      <StartColumn>
        <StartHead
          title="Choose a team profile"
          sub={<>{pendingRegistration?.name ?? 'This registration'} will appear in your Coaches Portal.</>}
        />

        <form onSubmit={handleLinkSubmit} className={accountForm.form}>
          {basicCoachTeams.length > 0 && (
            <div className={accountForm.field}>
              <span className={accountForm.label} id="join-team-choice">Coaches Portal team</span>
              <ChoicePair
                labelledBy="join-team-choice"
                describedBy={portalTeams.length > 0 ? 'join-new-team-consequence' : undefined}
                value={linkMode}
                options={LINK_MODE_OPTIONS}
                onChange={mode => {
                  setLinkMode(mode);
                  if (mode === 'new') setSelectedBasicTeamId('');
                }}
                disabled={loading}
              />
              {/* What New team makes (E3, owner H1–H3 2026-10-19): under the pair and OUTSIDE the Existing team
                  branch, so it shows before any tap and stays put when New team is tapped. The form's own
                  sentence, from its one home; the pair is the old form's F4 shape, which made the original case. */}
              {portalTeams.length > 0 && (
                <p className={joinStyles.consequence} id="join-new-team-consequence">
                  <strong>New team</strong> — {differentTeamSentence(portalTeams)}
                </p>
              )}
              {linkMode === 'existing' && (
                <select
                  className={accountForm.select}
                  value={selectedBasicTeamId}
                  onChange={e => setSelectedBasicTeamId(e.target.value)}
                  disabled={loading}
                  required
                  aria-label="Existing team"
                >
                  <option value="" disabled>Select a team</option>
                  {basicCoachTeams.map(team => (
                    <option key={team.basicCoachTeamId} value={team.basicCoachTeamId}>{team.name}{team.isPortalTeam ? ' · Coaches Portal' : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* A Premium team this person is on the staff of without the Register for tournaments
              switch: named, with who can file it, so its absence from the list never reads as
              "make a new team" (F5). A select cannot carry a greyed row, so it is a line here. */}
          {lockedTeams.map(team => (
            <p key={team.basicCoachTeamId} className={accountForm.hint}>
              <strong>{team.name}</strong> · Coaches Portal — {whoRegistersSentence(team)}
            </p>
          ))}
          {alreadyInTeams.map(team => (
            <p key={team.basicCoachTeamId} className={accountForm.hint}>
              <strong>{team.name}</strong> — {alreadyRegisteredLine(team.name, team.alreadyIn!)}
            </p>
          ))}
          {/* The second route (E3, H3): nothing to choose, but a Coaches Portal team exists — locked for this
              person, or already in this tournament — so Continue alone files the entry under a new free team.
              The same sentence, directly above the button it describes. Warn, never block (E3). */}
          {basicCoachTeams.length === 0 && portalTeams.length > 0 && (
            <p className={joinStyles.consequence}>
              <strong>Continue</strong> — {differentTeamSentence(portalTeams)}
            </p>
          )}

          {registrableTeams === null && (
            <p className={accountForm.error} role="alert">We couldn’t load your teams just now, so we won’t guess. Reload the page to choose one.</p>
          )}
          {error && <p className={accountForm.error} role="alert">{error}</p>}

          <button type="submit" className={accountForm.primary} disabled={loading || registrableTeams === null}>
            {loading ? 'Linking…' : 'Continue'}
          </button>
        </form>
      </StartColumn>
    );
  }

  // Signed out: the one account step (The first look, Ask 5a, 2026-10-19), in the app's frame. "Registration
  // submitted" keeps its job in the sub line: the organizer's entry went through, and the account follows it.
  return (
    <StartColumn>
      <StartHead
        title="Create your account"
        sub={fromReg
          ? 'Your registration is in. Your account shows its status, schedule and results.'
          : 'Your account shows your team’s registrations, schedule and results.'}
      />

      {verifyEmail ? (
        <VerifyEmailSent
          tone="start"
          email={verifyEmail}
          lead={<>Your account is almost ready. Open the link we sent to confirm your email. It brings you straight to your team&apos;s registration.</>}
          after={<>Open it on any phone or computer.</>}
          resendNext={verifyReturnPath()}
          onChangeEmail={() => { setVerifyEmail(null); setChangingEmail(true); }}
          signInHref={loginHref}
        />
      ) : (
        <>
          <form onSubmit={handleSubmit} className={accountForm.form}>
            <AccountFields
              idPrefix="join"
              values={{ firstName, lastName, email, password }}
              onChange={(field, value) => setField[field](value)}
              autoFocus={changingEmail ? 'email' : startingFresh ? 'firstName' : undefined}
            />

            {error && <p className={accountForm.error} role="alert">{error}</p>}

            <button type="submit" className={accountForm.primary} disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <StartFoot>
            <p>
              Already have an account?{' '}
              <Link href={loginHref} className={accountForm.footLink}>Sign in</Link>
            </p>
          </StartFoot>
        </>
      )}
    </StartColumn>
  );
}

export default function CoachesJoinPage() {
  return (
    <Suspense fallback={<StartColumn><LoadingState label="Loading your account…" /></StartColumn>}>
      <JoinForm />
    </Suspense>
  );
}
