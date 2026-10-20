'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tag } from 'lucide-react';
import VerifyEmailSent from '@/components/auth/VerifyEmailSent';
import StartSteps from '@/components/auth/StartSteps';
import { AccountFields, Field, StartColumn, StartFoot, StartHead, accountForm, hintId, type AccountValues } from '@/components/auth/AccountForm';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { START_DOOR_PATH, startDoorLinkPath, type StartPricing, type StartStepViewer } from '@/lib/start-door';

/** The doors this form serves (Coach Premium keeps its own card, with the same account-first steps — Part 3). */
type FormDoor = 'team' | 'league' | 'organization';

/**
 * Each door's words, step 1 and step 2 (The first look, Stage 1, owner rulings 2026-10-19; the hub's S1 drawings). The
 * heading repeats the words of the button the person tapped (plan rule 3); step 2 keeps step 1's heading and sub line
 * (`nameSub` only where step 1's would be wrong on step 2).
 */
const DOOR_COPY: Record<FormDoor, {
  title: string; sub: string; nameSub?: string; steps: readonly string[]; nextStep: string; accountSmallPrint?: string;
  label: string; placeholder: string; autoComplete: string; nameHint?: string; nameSmallPrint?: string; submit: string; empty: string; failed: string;
}> = {
  team: {
    title: 'Start a team',
    sub: 'A free team home, no organization needed',
    steps: ['Account', 'Team'],
    nextStep: 'naming your team',
    accountSmallPrint: 'Free, no credit card.',
    label: 'Team name',
    placeholder: 'e.g. Milton U13 Mavericks',
    autoComplete: 'off',
    nameHint: 'You can change it later.',
    submit: 'Create team',
    empty: 'Enter a team name.',
    failed: 'Could not create your team.',
  },
  league: {
    title: 'Start a league season',
    sub: 'Run a house-league season — registration, draft, scheduling, standings, and parent comms.',
    steps: ['Account', 'League'],
    nextStep: 'naming your league',
    accountSmallPrint: 'Free — one season, one division, up to 8 teams. No credit card.',
    // The free floor's limits, said again where the email link lands (often another device, so step 1 was never seen).
    nameSmallPrint: 'Free — one season, one division, up to 8 teams. No credit card.',
    label: 'League or organization name',
    placeholder: 'e.g. Milton Minor Softball',
    autoComplete: 'organization',
    submit: 'Start your season',
    empty: 'Enter a league name.',
    failed: 'Could not create your league.',
  },
  organization: {
    title: 'Run a tournament',
    sub: 'Free to start. You\'ll name your organization next.',
    // Step 2 IS the naming step, so "you'll name it next" would be wrong there; the promise's first half stays.
    nameSub: 'Free to start.',
    steps: ['Account', 'Organization', 'Plan'],
    nextStep: 'naming your organization',
    label: 'Organization name',
    placeholder: 'e.g. Milton Softball Association',
    autoComplete: 'organization',
    submit: 'Create organization',
    empty: 'Enter an organization name.',
    failed: 'Could not create your organization.',
  },
};

/** Where each door's account is made: the coach sign-up for a team or a league, the organization sign-up for Run a tournament (it keeps the Sign-up Invite Guard). */
const SIGNUP_ROUTE: Record<FormDoor, string> = {
  team: '/api/auth/coach-signup',
  league: '/api/auth/coach-signup',
  organization: '/api/auth/signup',
};

/** A door's create step, carrying the pricing page's plan for an account that signs in instead of signing up. */
function stepHref(door: FormDoor, pricing: StartPricing | null): string {
  return pricing ? `${START_DOOR_PATH[door]}?${new URLSearchParams({ plan: pricing.plan, billing: pricing.billing })}` : START_DOOR_PATH[door];
}

/**
 * EVERY FREE START SIGN-UP, ACCOUNT FIRST (Account-First Sign-up, owner A1–A3 2026-10-18; The first look, Stage 1,
 * 2026-10-19). Signed out: step 1, the account alone. Signed in: step 2, the one name, asked once. Both steps live at
 * the door's own address — Run a tournament's included, since its intro page folded into step 1 (Ask 6). The account
 * remembers its door (lib/start-door.ts), so the email link lands on step 2 on whatever device opens it.
 */
export default function StartDoorForm({ door, viewer, initialName = '', confirmed = false, pricing = null, create, help }: {
  door: FormDoor;
  /** Signed in (step 2), or null (step 1). */
  viewer: StartStepViewer | null;
  /** A link sent before account-first carried the name; it keeps filling in for one release. */
  initialName?: string;
  /** Arrived from the verification link. */
  confirmed?: boolean;
  /** Run a tournament only: the plan picked on the pricing page, riding on the account (A6). */
  pricing?: StartPricing | null;
  /** Makes the thing, and answers where to go next. */
  create: (name: string) => Promise<string>;
  /** The line under the name field (the public address). */
  help?: (name: string) => ReactNode;
}) {
  return viewer
    ? <NameStep door={door} viewer={viewer} initialName={initialName} confirmed={confirmed} create={create} help={help} />
    : <StartAccountStep door={door} pricing={pricing} />;
}

/** Step 1: first name, last name, email, password, under the door's own heading, with the pricing page's plan when there was one (A6). */
function StartAccountStep({ door, pricing }: { door: FormDoor; pricing: StartPricing | null }) {
  const copy = DOOR_COPY[door];
  const router = useRouter();
  // Verify every sign-up (owner 2026-10-16): the address the link went to, while this card says "check your email".
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  // Back from "Use a different email": the form opens with the cursor in the email field (the screen-reader pass).
  const [changingEmail, setChangingEmail] = useState(false);
  // Sign-up Invite Guard (Run a tournament only): this address already has an invitation, so it is pointed at that
  // instead of starting an organization of its own. The organization's name, when the server gave it.
  const [invitedTo, setInvitedTo] = useState<{ orgName: string | null } | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nextStep = stepHref(door, pricing);
  const setField: Record<keyof AccountValues, (value: string) => void> = {
    firstName: setFirstName, lastName: setLastName, email: setSignupEmail, password: setPassword,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    setLoading(true);
    const emailNorm = signupEmail.trim().toLowerCase();

    let signupRes: Response;
    try {
      signupRes = await fetch(SIGNUP_ROUTE[door], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailNorm, password, firstName: firstName.trim(), lastName: lastName.trim(),
          // The account remembers its door; the server points the link at that door's step 2.
          startDoor: door,
          ...(pricing ? { plan: pricing.plan, billing: pricing.billing } : {}),
        }),
      });
    } catch {
      setError('Account could not be created. Please try again.');
      setLoading(false);
      return;
    }

    const created = await signupRes.json().catch(() => ({})) as {
      error?: string; requiresEmailVerification?: boolean; inviteBranch?: 'invited'; orgName?: string | null;
    };
    if (signupRes.status === 409) {
      // Email already has an account — sign in, then name the thing (the page's signed-in step takes over).
      router.push(`/auth/login?next=${encodeURIComponent(nextStep)}&email=${encodeURIComponent(emailNorm)}`);
      return;
    }
    if (created.inviteBranch === 'invited') {
      setInvitedTo({ orgName: created.orgName ?? null });
      setLoading(false);
      return;
    }
    if (!signupRes.ok) {
      setError(created.error ?? 'Account could not be created. Please try again.');
      setLoading(false);
      return;
    }
    if (created.requiresEmailVerification) {
      // The account waits until the person opens the email; the entries stay for "Use a different email" (the
      // password is cleared).
      setPassword('');
      setVerifyEmail(emailNorm);
      setLoading(false);
      return;
    }

    // Verification off (localhost): the account is ready at once, so sign in and let the server render step 2 at this
    // same address (every door's two steps live at one address since Run a tournament's intro folded in, Ask 6).
    const { signIn } = await import('@/lib/auth');
    const { error: signInErr } = await signIn(emailNorm, password);
    if (signInErr) {
      setError('Account created but sign-in failed. Try signing in from the login page.');
      setLoading(false);
      return;
    }
    router.refresh();
  }

  if (invitedTo) {
    return (
      <InvitedInstead
        email={signupEmail.trim().toLowerCase()}
        orgName={invitedTo.orgName}
        onUseDifferentEmail={() => { setInvitedTo(null); setSignupEmail(''); }}
      />
    );
  }

  return (
    <StartColumn>
      <StartHead title={copy.title} sub={copy.sub} steps={<StartSteps current={1} labels={copy.steps} />} />

      {verifyEmail ? (
        <VerifyEmailSent
          tone="start"
          email={verifyEmail}
          lead={<>Your account is almost ready. Open the link we sent to confirm your email. It brings you straight to {copy.nextStep}.</>}
          after={<>Open it on any phone or computer.</>}
          resendNext={startDoorLinkPath(door)}
          onChangeEmail={() => { setVerifyEmail(null); setChangingEmail(true); }}
          signInHref={`/auth/login?next=${encodeURIComponent(nextStep)}&email=${encodeURIComponent(verifyEmail)}`}
        />
      ) : (
        <>
          <form onSubmit={handleSubmit} className={accountForm.form}>
            {pricing && (
              // A6 (design review D10): the plan rides on the account; the white callout with an olive edge (D-F, S1).
              <p className={accountForm.calloutIcon}>
                <Tag size={18} strokeWidth={1.8} aria-hidden />
                <span>
                  <strong>{PLAN_CONFIG[pricing.plan].label}, billed {pricing.billing === 'annual' ? 'annually' : 'monthly'}</strong>, from
                  the pricing page. You&apos;ll confirm it after naming your organization.
                </span>
              </p>
            )}
            <AccountFields
              idPrefix={door}
              values={{ firstName, lastName, email: signupEmail, password }}
              onChange={(field, value) => setField[field](value)}
              focusEmail={changingEmail}
            />

            {error && <p className={accountForm.error} role="alert">{error}</p>}

            <button type="submit" className={accountForm.primary} disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>

            {copy.accountSmallPrint && <p className={accountForm.fine}>{copy.accountSmallPrint}</p>}
          </form>

          <StartFoot>
            <p>
              Already have an account?{' '}
              <Link href={`/auth/login?next=${encodeURIComponent(nextStep)}`} className={accountForm.footLink}>Sign in</Link>
            </p>
          </StartFoot>
        </>
      )}
    </StartColumn>
  );
}

/**
 * Sign-up Invite Guard (SIGNUP_INVITE_GUARD_PLAN.md): an address that already has an invitation is pointed at it rather
 * than walked into an organization of its own. Its words and controls are the organization sign-up's own, in the one
 * account step's look and sentence case (The first look, rule 3).
 */
function InvitedInstead({ email, orgName, onUseDifferentEmail }: { email: string; orgName: string | null; onUseDifferentEmail: () => void }) {
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [showEscape, setShowEscape] = useState(false);

  async function emailInvitation() {
    setSendState('sending');
    try {
      // Always answers the same — the screen says "check your inbox" whatever happened.
      await fetch('/api/auth/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // A network hiccup still sends them to their inbox; they can retry the link there.
    }
    setSendState('sent');
  }

  return (
    <StartColumn>
      <StartHead title="You've been invited" sub="FieldLogicHQ — accept your invitation" />
      <div className={accountForm.form}>
        <div className={accountForm.callout}>
          <strong>You&apos;ve been invited to {orgName ?? 'this organization'}</strong>
          <br />
          You don&apos;t need to create an organization — just accept your invitation to get started.
        </div>

        {sendState === 'sent' ? (
          <p className={accountForm.callout} role="status">
            Check your inbox — open the email from FieldLogicHQ and click &ldquo;Accept Invitation&rdquo;.
          </p>
        ) : (
          <button type="button" className={accountForm.primary} onClick={emailInvitation} disabled={sendState === 'sending'}>
            {sendState === 'sending' ? 'Sending…' : 'Email me my invitation link'}
          </button>
        )}

        {showEscape ? (
          <div className={accountForm.form}>
            <p className={accountForm.hint}>
              This email already has an invitation to {orgName ?? 'an organization'}. To finish, accept it above. If
              you&apos;re setting up a different organization, use a different email address.
            </p>
            <button type="button" className={accountForm.secondary} onClick={onUseDifferentEmail}>Use a different email</button>
          </div>
        ) : (
          <button type="button" className={accountForm.textBtn} onClick={() => setShowEscape(true)}>
            Not you? Create a new organization instead
          </button>
        )}
      </div>

      <StartFoot>
        <p>
          Already have an account?{' '}
          <Link href="/auth/login" className={accountForm.footLink}>Sign in</Link>
        </p>
      </StartFoot>
    </StartColumn>
  );
}

/** Step 2: the one name, empty and focused (A3). One tap creates it, never automatically (V1), so a link opened twice only reopens this form. */
function NameStep({ door, viewer, initialName, confirmed, create, help }: {
  door: FormDoor;
  viewer: StartStepViewer;
  initialName: string;
  confirmed: boolean;
  create: (name: string) => Promise<string>;
  help?: (name: string) => ReactNode;
}) {
  const copy = DOOR_COPY[door];
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nameId = `${door}-name`;
  const hint = help ? help(name) : copy.nameHint;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError(copy.empty);
      return;
    }
    setLoading(true);
    try {
      router.push(await create(name.trim()));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed);
      setLoading(false);
    }
  }

  return (
    <StartColumn>
      <StartHead
        title={copy.title}
        sub={copy.nameSub ?? copy.sub}
        steps={viewer.firstRun ? <StartSteps current={2} labels={copy.steps} /> : undefined}
      />

      <form onSubmit={handleSubmit} className={accountForm.form}>
        {confirmed && <p className={accountForm.body}>Your email is confirmed.</p>}
        <Field id={nameId} label={copy.label} hint={hint}>
          <input
            id={nameId}
            type="text"
            className={accountForm.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={copy.placeholder}
            required
            maxLength={120}
            autoComplete={copy.autoComplete}
            aria-describedby={hint ? hintId(nameId) : undefined}
            // Empty and ready to type: the screen's one field, and the reason it opened (A3).
            autoFocus
          />
        </Field>

        {error && <p className={accountForm.error} role="alert">{error}</p>}

        <button type="submit" className={accountForm.primary} disabled={loading}>
          {loading ? 'Creating…' : copy.submit}
        </button>

        {copy.nameSmallPrint && <p className={accountForm.fine}>{copy.nameSmallPrint}</p>}
      </form>

      <StartFoot>
        <p>
          <Link href="/discover" className={accountForm.footLink}>
            {viewer.firstRun ? 'Not now, go to Home' : '← Back to your workspaces'}
          </Link>
        </p>
      </StartFoot>
    </StartColumn>
  );
}
