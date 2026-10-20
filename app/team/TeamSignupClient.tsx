'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { OFFERED_SPORT_OPTIONS as SHARED_SPORT_OPTIONS } from '@/lib/sports';
import { signIn } from '@/lib/auth';
import {
  COACHES_CLAIM_PATH,
  COACHES_START_PATH,
} from '@/lib/coaches-portal-routes';
import { PLAN_CONFIG, formatPriceAmount, normalizeBillingCycle, FOUNDING_SEASON_END_LABEL } from '@/lib/plan-config';
import { startDoorLinkPath } from '@/lib/start-door';
import VerifyEmailSent from '@/components/auth/VerifyEmailSent';
import StartSteps from '@/components/auth/StartSteps';
import {
  AccountFields,
  EmailField,
  Field,
  PasswordField,
  StartColumn,
  StartFoot,
  StartHead,
  accountForm,
  type AccountValues,
} from '@/components/auth/AccountForm';
import BillingChoice from '@/components/shared/BillingChoice';

type BillingCycle = 'monthly' | 'annual';
type AuthMode = 'signup' | 'signin';

export type TeamClaimPrefill = {
  token: string;
  contactEmail: string;
  teamName: string;
  coachName: string | null;
  division: string | null;
  tournamentName: string;
  seasonYear: number;
};

type TeamSignupClientProps = {
  teamIsGated: boolean;
  claim?: TeamClaimPrefill | null;
  /**
   * Pre-fill from an existing FREE Coaches Portal team when the coach arrived via that team's
   * "Upgrade to Premium" CTA (resolved + ownership-checked server-side in /coaches/start). Makes the
   * upgrade read as confirm-and-pay instead of create-from-scratch. Null for new/first-time coaches.
   */
  prefillTeamName?: string | null;
  prefillSport?: string | null;
  prefillBasicTeamId?: string | null;
  /** Back from the verification link: step 2 says "Your email is confirmed." */
  confirmed?: boolean;
  /** Who is signed in, from the server — step 2 straight away, with no session check in the browser. */
  signedInEmail?: string | null;
  /**
   * Does this visitor get the Founding Season offer? The server answers (lib/founding-season.ts): the window while it
   * is open; after it, only an account made by then that came through Coach Premium (edge (b), 2026-10-19) — the same
   * rule the checkout applies, so the card never shows a price the checkout won't charge.
   */
  foundingOffer: boolean;
  /** The billing chosen on the pricing page, remembered on the account across the email (Account-First Part 3). */
  rememberedBilling?: BillingCycle | null;
};

// Sourced from the shared canonical list (lib/sports) so the sport set never drifts again.
// Coach signup stores the display label (legacy free-text convention), so we map to labels.
const SPORT_OPTIONS: string[] = SHARED_SPORT_OPTIONS.map(o => o.label);

/** Snap a free-text sport (Basic teams store it as free text) onto an offered option; unknown
 *  or blank → the default ('Softball'). 'Other' is no longer offered (softball + baseball only).
 *  Case-insensitive. */
function normalizeSport(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'Softball';
  return SPORT_OPTIONS.find(option => option.toLowerCase() === trimmed.toLowerCase()) ?? 'Softball';
}

/** The two prices, read from the plan settings (never typed), in the pricing page's own words. */
const MONTHLY = `${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month`;
const ANNUAL = `${formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/year`;
const BILLING_OPTIONS = [
  { value: 'monthly', label: MONTHLY },
  { value: 'annual', label: ANNUAL },
] as const satisfies readonly { value: BillingCycle; label: string }[];

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password. Please try again.',
  email_not_confirmed: 'Please verify your email before signing in.',
  too_many_requests: 'Too many sign-in attempts. Please wait a moment and try again.',
  auth_timeout: 'Sign-in is taking too long. Check your connection and try again.',
  network_error: 'Could not reach the auth service. Please try again.',
};

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = await response.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function getPayloadError(payload: Record<string, unknown>, fallback: string) {
  return typeof payload.error === 'string' ? payload.error : fallback;
}

/**
 * COACH PREMIUM'S SIGN-UP, AS ONE OF THE DOORS (The first look R1, owner 2026-10-19: "if someone is already signing up,
 * I don't see why we need this much marketing on the coaches portal sign up. it should look like the other 2"). Both
 * steps are the start column: the heading, the offer as the one sub line, the step line, the shared fields, one button,
 * the foot link. The selling lives on /for-coaches and the pricing page. The tournament claim, the free-team upgrade and
 * the reactivation share this card, each under its own heading (the owner, 2026-10-19: the single column for all).
 */
export default function TeamSignupClient({
  teamIsGated,
  claim = null,
  prefillTeamName = null,
  prefillSport = null,
  prefillBasicTeamId = null,
  confirmed = false,
  signedInEmail = null,
  foundingOffer: foundingPromoActive,
  rememberedBilling = null,
}: TeamSignupClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentYear = new Date().getFullYear();
  const reactivationOrgSlug = searchParams.get('reactivateOrgSlug')?.trim() || null;
  const reactivationTeamName = searchParams.get('teamName')?.trim() || '';
  const isReactivation = Boolean(reactivationOrgSlug);
  // Warm upgrade: the coach arrived from a free team's "Upgrade to Premium" CTA (team prefilled).
  // Not a tournament claim, not a reactivation.
  const isWarmUpgrade = !claim && !isReactivation && Boolean(prefillBasicTeamId);
  const [teamName, setTeamName] = useState(claim?.teamName ?? prefillTeamName ?? reactivationTeamName);
  const [sport, setSport] = useState(normalizeSport(prefillSport));
  // Season is no longer asked at signup — it defaults silently (claim season, else current year).
  const seasonYear = claim?.seasonYear ?? currentYear;
  // The pricing page's billing: in the address, or remembered on the account across the email (F02: no browser-tab draft).
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(normalizeBillingCycle(searchParams.get('billing') ?? rememberedBilling));
  const [authMode, setAuthMode] = useState<AuthMode>((confirmed && !signedInEmail) || isReactivation ? 'signin' : 'signup');
  // Signed in: the account's own address (a claim reserved for another address says so). Signed out: the claim's.
  const [email, setEmail] = useState(signedInEmail ?? claim?.contactEmail ?? '');
  const [password, setPassword] = useState('');
  // Signup collects the coach's real name — a Basic account has none otherwise (was landing as "n/a").
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(!!signedInEmail);
  const [startedSignedOut] = useState(!signedInEmail);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  // Back from "Use a different email", or switched between the account form and the sign-in: the cursor goes to the email.
  const [focusEmail, setFocusEmail] = useState(false);

  const busy = !!busyLabel;
  const cleanTeamName = teamName.trim();
  // Account-first (Part 3, owner A1–A3 2026-10-18): signed out, the card is step 1 — the account alone; signed in, it is
  // step 2 — the team, the sport and the plan, then checkout. Nothing typed lives in the browser tab (F02).
  const onAccountStep = !isAuthenticated;
  // Step 2 shows the step line to someone who has just come through step 1: by the email link, or in this visit.
  const cameThroughStep1 = !isReactivation && (confirmed || (isAuthenticated && startedSignedOut));
  const claimEmailMismatch = !!claim && isAuthenticated && !!email && email.trim().toLowerCase() !== claim.contactEmail.toLowerCase();
  const claimPath = claim ? `${COACHES_CLAIM_PATH}/${encodeURIComponent(claim.token)}` : COACHES_START_PATH;
  const returnPath = isReactivation
    ? `${COACHES_START_PATH}?${new URLSearchParams({ reactivateOrgSlug: reactivationOrgSlug ?? '', ...(reactivationTeamName ? { teamName: reactivationTeamName } : {}) })}`
    : `${claimPath}?billing=${billingCycle}`;
  // Where the verification link returns: step 2 of this card — the claim, the reactivation, or Coach Premium's own step
  // (the account remembers the door, so a resend from sign-in lands there too).
  const confirmedAt = (path: string) => `${path}${path.includes('?') ? '&' : '?'}confirmed=1`;
  const linkPath = claim ? confirmedAt(claimPath) : isReactivation ? confirmedAt(returnPath) : startDoorLinkPath('premium');
  const founding = foundingPromoActive && !isReactivation;
  // A claim is reserved for one address: the locked field says why.
  const claimEmailHint = claim ? 'This team claim is reserved for this address.' : undefined;
  const seasonName = cleanTeamName ? `${cleanTeamName} ${seasonYear}` : `Team ${seasonYear}`;

  // The heading names what the person came to do (rule 3); the offer is the one sub line, read from the plan settings so
  // it changes by itself when the Founding Season window closes. The claim, the upgrade and the reactivation keep their own.
  const offer = foundingPromoActive
    ? `Premium Coaches Portal. Free through ${FOUNDING_SEASON_END_LABEL}, then ${MONTHLY}.`
    : `Premium Coaches Portal. ${MONTHLY} or ${ANNUAL}.`;
  const title = claim
    ? 'Activate from tournament'
    : isReactivation
      ? 'Reactivate Premium'
      : isWarmUpgrade ? `Upgrade ${prefillTeamName?.trim() || 'your team'} to Premium` : 'Coach a team';
  const sub = claim
    ? `${claim.tournamentName} already has your team details.`
    : isReactivation
      ? 'Restore your team workspace instead of starting a new one.'
      : offer;
  // Step 2 names what it makes (rule 3, D-F6): "Create team" while the Founding Season covers it, "Continue to checkout"
  // once a card is needed. No arrows.
  const submitLabel = isWarmUpgrade
    ? (founding ? 'Upgrade to Premium' : 'Continue to checkout')
    : founding ? 'Create team' : 'Continue to checkout';

  // The two notices sit just above whichever step's button is showing.
  const notices = (
    <>
      {teamIsGated && <p className={accountForm.error}>Coaches Portal self-serve signup is not open yet.</p>}
      {error && <p className={accountForm.error} role="alert">{error}</p>}
    </>
  );
  const setAccountField: Record<keyof AccountValues, (value: string) => void> = {
    firstName: setFirstName, lastName: setLastName, email: setEmail, password: setPassword,
  };

  function validateAccount() {
    if (!email.trim()) return 'Enter your email address.';
    if (claim && email.trim().toLowerCase() !== claim.contactEmail.toLowerCase()) {
      return `This team claim is reserved for ${claim.contactEmail}.`;
    }
    if (authMode === 'signup') {
      if (!firstName.trim()) return 'Enter your first name.';
      if (!lastName.trim()) return 'Enter your last name.';
      if (password.length < 8) return 'Password must be at least 8 characters.';
    }
    if (authMode === 'signin' && !password) return 'Enter your password.';
    return '';
  }

  function validateTeam() {
    if (teamIsGated) return 'Coaches Portal self-serve signup is not open yet.';
    if (cleanTeamName.length < 2) return 'Enter your team name.';
    if (claimEmailMismatch) {
      return `You are signed in as ${email}. Sign in with ${claim.contactEmail} to claim this team.`;
    }
    return '';
  }

  /** Step 1: make the account (it remembers this door and the billing — lib/start-door.ts), or sign in. */
  async function handleAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const validationError = validateAccount();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusyLabel(authMode === 'signup' ? 'Creating…' : 'Signing in…');
    try {
      if (authMode === 'signup') {
        const signupRes = await fetch('/api/auth/team-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email, password, firstName: firstName.trim(), lastName: lastName.trim(),
            next: linkPath,
            // A reactivation is a returning coach, not a start. A claim keeps the offer's locked door (edge (b)) but no
            // remembered door: Home and a resend would lead to a blank Premium step, where a new team could be bought
            // and the claim left open.
            ...(isReactivation ? {} : { startDoor: 'premium', billing: billingCycle, ...(claim ? { claim: true } : {}) }),
          }),
        });
        const signupPayload = await readJson(signupRes);
        if (!signupRes.ok) {
          if (signupRes.status === 409) {
            setAuthMode('signin');
            throw new Error('That email already has a FieldLogicHQ account. Sign in to continue.');
          }
          throw new Error(getPayloadError(signupPayload, 'Could not create your account.'));
        }
        if (signupPayload.requiresEmailVerification === true) {
          // The account waits until the person opens the email; the entries stay for "Use a different email" (the
          // password is cleared).
          setPassword('');
          setVerificationEmail(typeof signupPayload.email === 'string' ? signupPayload.email : email);
          setBusyLabel('');
          return;
        }
      }
      const signin = await signIn(email, password);
      if (signin.error === 'email_not_confirmed') {
        // A waiting account: the check-your-email block, with Send the link again (V3), rather than a dead end.
        setPassword('');
        setVerificationEmail(email.trim().toLowerCase());
        setBusyLabel('');
        return;
      }
      if (signin.error) throw new Error(AUTH_ERRORS[signin.error] ?? signin.error);
      setIsAuthenticated(true);
      // The page's answers (the offer, the remembered billing) were a signed-out visitor's: ask again for this account,
      // so the price shown is the price the checkout charges.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
    setBusyLabel('');
  }

  async function startCheckout() {
    setBusyLabel('Starting checkout…');

    const response = await fetch('/api/billing/create-team-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: cleanTeamName,
        workspaceName: `${cleanTeamName} Coaches Portal`,
        sport,
        division: claim?.division ?? null,
        seasonName,
        seasonYear,
        billingCycle,
        returnTo: returnPath,
        claimToken: claim?.token ?? null,
        reactivateOrgSlug: reactivationOrgSlug,
        // Per-team upgrade: forward the originating free team so the server (after re-verifying
        // ownership) back-links the new Premium workspace to it and migrates its data. Null for
        // brand-new / claim signups.
        basicCoachTeamId: prefillBasicTeamId,
      }),
    });

    const payload = await readJson(response);
    if (response.status === 401) {
      window.location.assign(`/auth/login?next=${encodeURIComponent(claimPath)}`);
      return;
    }
    if (!response.ok) {
      throw new Error(getPayloadError(payload, 'Could not start Coaches Portal checkout.'));
    }
    if (typeof payload.url !== 'string' || !payload.url) {
      throw new Error('Checkout did not return a destination URL.');
    }

    // Founding-season comp path returns an INTERNAL portal URL (no Stripe). Route it through the
    // warm success screen (design_decisions S1-2): it names the free period, then hands off into the
    // operating portal. A real Stripe checkout returns an external URL and goes straight there.
    const dest = payload.url;
    const isInternal = dest.startsWith('/') || dest.startsWith(window.location.origin);
    if (isInternal && foundingPromoActive) {
      // dest may be an ABSOLUTE same-origin URL (create-team-checkout builds `${NEXT_PUBLIC_APP_URL}/…`);
      // pass a RELATIVE path so the welcome screen's same-origin guard accepts it (and no origin leaks).
      const nextPath = dest.startsWith('/') ? dest : dest.slice(window.location.origin.length);
      const params = new URLSearchParams({ next: nextPath, team: cleanTeamName });
      window.location.assign(`/coaches/welcome?${params.toString()}`);
    } else {
      window.location.assign(dest);
    }
  }

  /** Step 2: one tap starts the checkout (never automatically, V1). */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const validationError = validateTeam();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusyLabel('');
    }
  }

  /** The in-card sign-in and the account form swap in place; the foot link is the only way between them (R1: no toggle). */
  function switchAuthMode(mode: AuthMode) {
    setError('');
    setAuthMode(mode);
    setFocusEmail(true);
  }

  // The step line every start sign-up wears (A2): on step 1, and on step 2 when the person has just come through step 1.
  const steps = ((onAccountStep && !isReactivation) || cameThroughStep1)
    ? <StartSteps current={onAccountStep ? 1 : 2} labels={['Account', 'Team']} />
    : undefined;

  return (
    <StartColumn>
      <StartHead title={title} sub={sub} steps={steps} />

      {onAccountStep ? (
        verificationEmail ? (
          // Verify every sign-up (owner V3, 2026-10-16): the one check-your-email block, with Send the link again.
          <VerifyEmailSent
            tone="start"
            email={verificationEmail}
            lead={claim
              ? <>Your account is almost ready. Open the link we sent to confirm your email. It brings you straight back here to activate {claim.teamName}.</>
              : <>Your account is almost ready. Open the link we sent to confirm your email. It brings you straight to naming your team.</>}
            after={<>Open it on any phone or computer.</>}
            resendNext={linkPath}
            onChangeEmail={claim ? undefined : () => { setVerificationEmail(''); setFocusEmail(true); }}
            signInHref={`/auth/login?next=${encodeURIComponent(linkPath)}&email=${encodeURIComponent(verificationEmail)}`}
          />
        ) : (
          <>
            <form className={accountForm.form} onSubmit={handleAccount}>
              {authMode === 'signup' ? (
                <AccountFields
                  idPrefix="premium"
                  values={{ firstName, lastName, email, password }}
                  onChange={(field, value) => setAccountField[field](value)}
                  emailLocked={!!claim}
                  emailHint={claimEmailHint}
                  disabled={busy}
                  focusEmail={focusEmail}
                />
              ) : (
                <>
                  <EmailField id="premium-email" value={email} onChange={setEmail} locked={!!claim} hint={claimEmailHint} disabled={busy} autoFocus={focusEmail} />
                  <PasswordField id="premium-password" value={password} onChange={setPassword} purpose="current" disabled={busy} />
                </>
              )}

              {notices}
              <button type="submit" className={accountForm.primary} disabled={busy || teamIsGated}>
                {busyLabel || (authMode === 'signup' ? 'Create account' : 'Sign in')}
              </button>
              {authMode === 'signup' && founding && <p className={accountForm.fine}>No credit card.</p>}
            </form>

            {(authMode === 'signup' || !isReactivation) && (
            <StartFoot>
              {authMode === 'signup' ? (
                <p>
                  Already have an account?{' '}
                  <button type="button" className={accountForm.footLink} onClick={() => switchAuthMode('signin')} disabled={busy}>Sign in</button>
                </p>
              ) : (
                <p>
                  New here?{' '}
                  <button type="button" className={accountForm.footLink} onClick={() => switchAuthMode('signup')} disabled={busy}>Create account</button>
                </p>
              )}
            </StartFoot>
            )}
          </>
        )
      ) : (
        <>
          <form className={accountForm.form} onSubmit={handleSubmit}>
            {confirmed && <p className={accountForm.body}>Your email is confirmed.</p>}
            <Field id="premium-team-name" label="Team name">
              <input
                id="premium-team-name"
                className={accountForm.input}
                value={teamName}
                onChange={event => setTeamName(event.target.value)}
                placeholder="e.g. Milton Thunder U15"
                autoComplete="off"
                required
                disabled={busy}
              />
            </Field>
            {/* Warm upgrade already knows the sport (carried from the free team), so the picker
                is hidden — the value still rides along to checkout. Cold/claim signups pick it. */}
            {!isWarmUpgrade && (
              <Field id="premium-sport" label="Sport">
                <select id="premium-sport" className={accountForm.select} value={sport} onChange={event => setSport(event.target.value)} disabled={busy}>
                  {SPORT_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
            )}

            <div className={accountForm.field}>
              <span className={accountForm.label} id="premium-billing">{founding ? 'After the Founding Season' : 'Billing'}</span>
              <BillingChoice
                labelledBy="premium-billing"
                describedBy={founding ? 'premium-billing-hint' : undefined}
                value={billingCycle}
                options={BILLING_OPTIONS}
                onChange={setBillingCycle}
                disabled={busy}
              />
              {founding && <p className={accountForm.hint} id="premium-billing-hint">Change it any time before then. No card today.</p>}
            </div>

            {claimEmailMismatch && (
              <p className={accountForm.error} role="alert">Signed in as {email}. This claim is reserved for {claim?.contactEmail}.</p>
            )}
            {notices}
            {/* Tappable whenever it can work: a missing name or the wrong account says so beside it (validateTeam). */}
            <button type="submit" className={accountForm.primary} disabled={busy || teamIsGated}>
              {busyLabel || submitLabel}
            </button>
            {isWarmUpgrade && (
              <p className={accountForm.fine}>Your roster, schedule and fees come with you; your free team stays as history. Cancel anytime.</p>
            )}
          </form>

          <StartFoot>
            <p>
              <Link href="/discover" className={accountForm.footLink}>Not now, go to Home</Link>
            </p>
          </StartFoot>
        </>
      )}
    </StartColumn>
  );
}
