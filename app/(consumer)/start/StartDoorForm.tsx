'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Check, Eye, EyeOff, Mail, MailCheck, Tag, Trophy, Users } from 'lucide-react';
import VerifyEmailSent from '@/components/auth/VerifyEmailSent';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { START_DOOR_PATH, startDoorLinkPath, type StartPricing, type StartStepViewer } from '@/lib/start-door';
import styles from './startForm.module.css';

/** The doors this form serves (Coach Premium keeps its own card until Part 3). */
type FormDoor = 'team' | 'league' | 'organization';

/** Each door's words, step 1 and step 2 (the hub's drawings). */
const DOOR_COPY: Record<FormDoor, {
  icon: ReactNode; title: string; sub: string; step: string; nextStep: string; accountSmallPrint: string;
  adding: string; label: string; placeholder: string; autoComplete: string; submit: string; nameSmallPrint: string;
  empty: string; failed: string;
}> = {
  team: {
    icon: <Users size={20} strokeWidth={1.6} aria-hidden />,
    title: 'Create Your Team Home',
    sub: 'A free team home — no organization needed',
    step: 'Your team',
    nextStep: 'naming your team',
    accountSmallPrint: 'Free, no credit card.',
    adding: 'Adding a team to',
    label: 'Team Name',
    placeholder: 'e.g. Milton U13 Mavericks',
    autoComplete: 'off',
    submit: 'Create Team',
    nameSmallPrint: 'Free, no credit card. You can add tournaments to your team later.',
    empty: 'Enter a team name.',
    failed: 'Could not create your team.',
  },
  league: {
    icon: <CalendarDays size={20} strokeWidth={1.6} aria-hidden />,
    title: 'Start Your Season',
    sub: 'A free house-league season — no credit card',
    step: 'Your league',
    nextStep: 'naming your league',
    accountSmallPrint: 'Free — one season, one division, up to 8 teams. No credit card.',
    adding: 'Adding a league to',
    label: 'League / Organization Name',
    placeholder: 'e.g. Milton Minor Softball',
    autoComplete: 'organization',
    submit: 'Start Your Season',
    nameSmallPrint: 'Free — one season, one division, up to 8 teams. No credit card.',
    empty: 'Enter a league name.',
    failed: 'Could not create your league.',
  },
  organization: {
    icon: <Trophy size={20} strokeWidth={1.6} aria-hidden />,
    title: 'Create Your Organization',
    sub: 'Run your tournament, league or club',
    step: 'Your organization',
    nextStep: 'naming your organization',
    accountSmallPrint: 'No credit card required.',
    adding: 'Adding an organization to',
    label: 'Organization Name',
    placeholder: 'e.g. Milton Softball Association',
    autoComplete: 'organization',
    submit: 'Create Organization',
    nameSmallPrint: 'Starts on the free Tournament plan. No credit card required.',
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
function stepHref(door: FormDoor, pricing: StartPricing | null | undefined): string {
  return pricing ? `${START_DOOR_PATH[door]}?${new URLSearchParams({ plan: pricing.plan, billing: pricing.billing })}` : START_DOOR_PATH[door];
}

/**
 * The two-step line (owner A2, design review D2, 2026-10-18): "1 Your account · 2 Your team". It says the naming step
 * is coming, which is what makes step 2 read as the second half rather than a repeat. Not a control.
 */
function StartSteps({ current, second }: { current: 1 | 2; second: string }) {
  return (
    <ol className={styles.steps} aria-label="Sign-up steps">
      <li className={current === 1 ? styles.stepOn : styles.stepDone} aria-current={current === 1 ? 'step' : undefined}>
        <span className={styles.stepNum}>
          {current === 1 ? '1' : <Check size={12} strokeWidth={3} role="img" aria-label="Done" />}
        </span>
        <span>Your account</span>
      </li>
      <li className={current === 2 ? styles.stepOn : undefined} aria-current={current === 2 ? 'step' : undefined}>
        <span className={styles.stepNum}>2</span>
        <span>{second}</span>
      </li>
    </ol>
  );
}

/** A start form's heading: the door's own name, its line, and (on a first day) the two steps. */
function StartHeader({ icon, title, sub, steps }: { icon: ReactNode; title: string; sub: string; steps?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div className={styles.iconWrap}>{icon}</div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.sub}>{sub}</p>
      {steps}
    </div>
  );
}

/**
 * EVERY FREE START SIGN-UP, ACCOUNT FIRST (Account-First Sign-up, owner A1–A3 2026-10-18; hub
 * ACCOUNT_FIRST_SIGNUP_HUB.html). Signed out: step 1, the account alone. Signed in: step 2, the one name, asked once.
 * The account remembers its door (lib/start-door.ts), so the email link lands on step 2 on whatever device opens it.
 */
export default function StartDoorForm({ door, viewer, initialName = '', confirmed = false, create, help }: {
  door: FormDoor;
  /** Signed in (step 2), or null (step 1). */
  viewer: StartStepViewer | null;
  /** A link sent before account-first carried the name; it keeps filling in for one release. */
  initialName?: string;
  /** Arrived from the verification link. */
  confirmed?: boolean;
  /** Makes the thing, and answers where to go next. */
  create: (name: string) => Promise<string>;
  /** The line under the name field (the public address). */
  help?: (name: string) => ReactNode;
}) {
  return viewer
    ? <NameStep door={door} viewer={viewer} initialName={initialName} confirmed={confirmed} create={create} help={help} />
    : <StartAccountStep door={door} />;
}

/**
 * Step 1: first name, last name, email, password, under the door's own heading. Run a tournament's step 1 is rendered
 * by the sign-up page (/auth/signup, where the pricing page and every "create your free account" link point), with the
 * plan picked on the pricing page when there was one (A6).
 */
export function StartAccountStep({ door, pricing = null }: { door: FormDoor; pricing?: StartPricing | null }) {
  const copy = DOOR_COPY[door];
  const router = useRouter();
  // Verify every sign-up (owner 2026-10-16): the address the link went to, while this card says "check your email".
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  // Sign-up Invite Guard (Run a tournament only): this address already has an invitation, so it is pointed at that
  // instead of starting an organization of its own. The organization's name, when the server gave it.
  const [invitedTo, setInvitedTo] = useState<{ orgName: string | null } | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nextStep = stepHref(door, pricing);

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

    // Verification off (localhost): the account is ready at once, so sign in and let the server render step 2.
    const { signIn } = await import('@/lib/auth');
    const { error: signInErr } = await signIn(emailNorm, password);
    if (signInErr) {
      setError('Account created but sign-in failed. Try signing in from the login page.');
      setLoading(false);
      return;
    }
    // The team and league pages render step 2 themselves; Run a tournament's step 1 lives at /auth/signup, so it goes there.
    if (door === 'organization') router.replace(START_DOOR_PATH[door]);
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
    <div className={styles.page}>
      <div className={styles.card}>
        <StartHeader
          icon={verifyEmail ? <Mail size={20} strokeWidth={1.6} aria-hidden /> : copy.icon}
          title={copy.title}
          sub={copy.sub}
          steps={<StartSteps current={1} second={copy.step} />}
        />

        {verifyEmail ? (
          <VerifyEmailSent
            tone="start"
            email={verifyEmail}
            lead={<>Your account is almost ready. Open the link we sent to confirm your email. It brings you straight to {copy.nextStep}.</>}
            after={<>Open it on any phone or computer.</>}
            resendNext={startDoorLinkPath(door)}
            onChangeEmail={() => setVerifyEmail(null)}
            signInHref={`/auth/login?next=${encodeURIComponent(nextStep)}&email=${encodeURIComponent(verifyEmail)}`}
          />
        ) : (
          <>
            {pricing && (
              // A6 (design review D10: a solid edge — dashed reads as a placeholder): the plan rides on the account.
              <p className={styles.pricingChip}>
                <Tag size={18} strokeWidth={1.8} aria-hidden />
                <span>
                  <strong>{PLAN_CONFIG[pricing.plan].label}, billed {pricing.billing === 'annual' ? 'annually' : 'monthly'}</strong>, from
                  the pricing page. You&apos;ll confirm it after naming your organization.
                </span>
              </p>
            )}
            <form onSubmit={handleSubmit} className={styles.form}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor={`${door}-first-name`}>First Name</label>
                  <input
                    id={`${door}-first-name`}
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
                  <label className="form-label" htmlFor={`${door}-last-name`}>Last Name</label>
                  <input
                    id={`${door}-last-name`}
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
                <label className="form-label" htmlFor={`${door}-email`}>Email</label>
                <input
                  id={`${door}-email`}
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
                <label className="form-label" htmlFor={`${door}-password`}>Password</label>
                <div className={styles.pwWrap}>
                  <input
                    id={`${door}-password`}
                    type={showPw ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button type="button" className={styles.pwToggle} onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && <div className={styles.error} role="alert">{error}</div>}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Creating…' : 'Create Account'}
              </button>

              <p className={styles.smallPrint}>{copy.accountSmallPrint}</p>
            </form>

            <div className={styles.footer}>
              <p className={styles.footerText}>
                Already have an account?
                <Link href={`/auth/login?next=${encodeURIComponent(nextStep)}`} className={styles.footerLink}>Sign in</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Sign-up Invite Guard (SIGNUP_INVITE_GUARD_PLAN.md): an address that already has an invitation is pointed at it rather
 * than walked into an organization of its own. Its words and controls are the organization sign-up's own, unchanged;
 * Account-First Part 2 (2026-10-19) moved them into the start look with the rest of Run a tournament's step 1.
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
    <div className={styles.page}>
      <div className={styles.card}>
        <StartHeader
          icon={<MailCheck size={20} strokeWidth={1.6} aria-hidden />}
          title="You've Been Invited"
          sub="FieldLogicHQ — accept your invitation"
        />
        <div className={styles.form}>
          <div className={styles.invitePanel}>
            <p className={styles.inviteOrg}>You&apos;ve been invited to {orgName ?? 'this organization'}</p>
            <p className={styles.inviteBody}>You don&apos;t need to create an organization — just accept your invitation to get started.</p>
          </div>

          {sendState === 'sent' ? (
            <p className={styles.inviteSent} role="status">
              Check your inbox — open the email from FieldLogicHQ and click &ldquo;Accept Invitation&rdquo;.
            </p>
          ) : (
            <button type="button" className={styles.submitBtn} onClick={emailInvitation} disabled={sendState === 'sending'}>
              {sendState === 'sending' ? 'Sending…' : 'Email me my invitation link'}
            </button>
          )}

          {showEscape ? (
            <div className={styles.inviteEscape}>
              <p>
                This email already has an invitation to {orgName ?? 'an organization'}. To finish, accept it above. If
                you&apos;re setting up a different organization, use a different email address.
              </p>
              <button type="button" className={styles.ghostBtn} onClick={onUseDifferentEmail}>Use a different email</button>
            </div>
          ) : (
            <button type="button" className={styles.textBtn} onClick={() => setShowEscape(true)}>
              Not you? Create a new organization instead
            </button>
          )}
        </div>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Already have an account?
            <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
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
    <div className={styles.page}>
      <div className={styles.card}>
        <StartHeader
          icon={copy.icon}
          title={copy.title}
          sub={`${copy.adding} ${viewer.email}`}
          steps={viewer.firstRun ? <StartSteps current={2} second={copy.step} /> : undefined}
        />

        {confirmed && <p className={styles.confirmed}>Your email is confirmed.</p>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor={`${door}-name`}>{copy.label}</label>
            <input
              id={`${door}-name`}
              type="text"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={copy.placeholder}
              required
              maxLength={120}
              autoComplete={copy.autoComplete}
              // Empty and ready to type: the screen's one field, and the reason it opened (A3).
              autoFocus
            />
            {help && <p className={styles.fieldHelp}>{help(name)}</p>}
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Creating…' : copy.submit}
          </button>

          <p className={styles.smallPrint}>{copy.nameSmallPrint}</p>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            <Link href="/discover" className={styles.footerLink}>
              {viewer.firstRun ? 'Not now, go to Home' : '← Back to your workspaces'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
