'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { OFFERED_SPORT_OPTIONS as SHARED_SPORT_OPTIONS } from '@/lib/sports';
import { signIn, signOut } from '@/lib/auth';
import { signInErrorCopy } from '@/lib/auth-errors';
import { COACHES_START_PATH } from '@/lib/coaches-portal-routes';
import { PLAN_CONFIG, formatPlanPeriodPrice, normalizeBillingCycle } from '@/lib/plan-config';
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
import ChoicePair from '@/components/shared/ChoicePair';
import { KEEP_PREMIUM_LINE } from '@/lib/portal-free-time';
import { BILLING_TAX_WORDS } from '@/lib/billing-tax';
import { BILLING_ADDRESS_FORM_WORDS, BILLING_LOCATION_WORDS, formatBilledTo } from '@/lib/billing-location';
import BillingAddressFields, { useAddressDraft } from '@/components/billing/BillingAddressFields';
import { addressOnFile, isAddressRefusal, saveBillingAddress, useBillingAddressGate } from '@/components/billing/BillingAddressDialog';
import addressStyles from '@/components/billing/BillingAddress.module.css';
import TermsTickRow, { useTermsTick } from '@/components/legal/TermsTickRow';
import PlanTermsLine from '@/components/legal/PlanTermsLine';
import { useTermsGate } from '@/components/legal/TermsAcceptWindow';

/** The checkout found no home address on file: the page shows the Address step instead of an error. */
class AddressNeededError extends Error {}

/** The server no longer sees a session (signed out in another tab, or it lapsed): step 1 comes back, in sign-in. */
class SessionEndedError extends Error {}

/**
 * Said on step 1 when a session ended mid-form. Everything typed on the later steps is still in the card, so signing in
 * again returns to the step the person was on. Never "couldn't save, try again": pressing again can never work.
 */
const SIGNED_OUT_LINE = 'You’re signed out. Sign in again to continue.';

type BillingCycle = 'monthly' | 'annual';
type AuthMode = 'signup' | 'signin';

type TeamSignupClientProps = {
  teamIsGated: boolean;
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
const MONTHLY = formatPlanPeriodPrice('team', 'monthly');
const ANNUAL = formatPlanPeriodPrice('team', 'annual');
const BILLING_OPTIONS = [
  { value: 'monthly', label: MONTHLY },
  { value: 'annual', label: ANNUAL },
] as const satisfies readonly { value: BillingCycle; label: string }[];

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
 * the foot link. The selling lives on /for-coaches and the pricing page. The free-team upgrade and the reactivation share
 * this card, each under its own heading (the owner, 2026-10-19: the single column for all).
 */
export default function TeamSignupClient({
  teamIsGated,
  prefillTeamName = null,
  prefillSport = null,
  prefillBasicTeamId = null,
  confirmed = false,
  signedInEmail = null,
  rememberedBilling = null,
}: TeamSignupClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentYear = new Date().getFullYear();
  const reactivationOrgSlug = searchParams.get('reactivateOrgSlug')?.trim() || null;
  const reactivationTeamName = searchParams.get('teamName')?.trim() || '';
  const isReactivation = Boolean(reactivationOrgSlug);
  // Keep Premium (Support console Stage 4b): a coach on free time from staff buys Premium for the same portal. It rides
  // the reactivation (the server attaches it to that portal), under its own words.
  const isKeepPremium = isReactivation && searchParams.get('keep') === '1';
  // Warm upgrade: the coach arrived from a free team's "Upgrade to Premium" CTA (team prefilled).
  // Not a reactivation.
  const isWarmUpgrade = !isReactivation && Boolean(prefillBasicTeamId);
  const [teamName, setTeamName] = useState(prefillTeamName ?? reactivationTeamName);
  const [sport, setSport] = useState(normalizeSport(prefillSport));
  // Season is no longer asked at signup — it defaults silently to the current year.
  const seasonYear = currentYear;
  // The pricing page's billing: in the address, or remembered on the account across the email (F02: no browser-tab draft).
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(normalizeBillingCycle(searchParams.get('billing') ?? rememberedBilling));
  const [authMode, setAuthMode] = useState<AuthMode>((confirmed && !signedInEmail) || isReactivation ? 'signin' : 'signup');
  // Signed in: the account's own address.
  const [email, setEmail] = useState(signedInEmail ?? '');
  const [password, setPassword] = useState('');
  // Signup collects the coach's real name — a Basic account has none otherwise (was landing as "n/a").
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(!!signedInEmail);
  const [startedSignedOut] = useState(!signedInEmail);
  // Signed in on step 1 during this visit (also after a session ended under the card): that person came through step 1.
  const [signedInHere, setSignedInHere] = useState(false);
  // The account whose session ended under the card: a sign-in as anyone else drops what the card held for that account.
  const [endedAs, setEndedAs] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState('');
  // The Terms box (step 6.3, §20 (1)), on the sign-up form only: nothing while the legal pages are off.
  const terms = useTermsTick();
  // The checkout's Terms window (step 6.3, C3) — for someone already signed in who has not agreed yet.
  const checkoutGate = useTermsGate();
  const [verificationEmail, setVerificationEmail] = useState('');
  // Back from "Use a different email", or switched between the account form and the sign-in: the cursor goes to the email.
  const [focusEmail, setFocusEmail] = useState(false);

  const busy = !!busyLabel;
  const cleanTeamName = teamName.trim();
  // Account-first (Part 3, owner A1–A3 2026-10-18): signed out, the card is step 1 — the account alone; signed in, it is
  // step 2 — the team, the sport and the plan, then checkout. Nothing typed lives in the browser tab (F02).
  const onAccountStep = !isAuthenticated;
  // Step 2 shows the step line to someone who has just come through step 1: by the email link, or in this visit.
  const cameThroughStep1 = !isReactivation && (confirmed || (isAuthenticated && (startedSignedOut || signedInHere)));
  // Arrived already signed in on a cold start: a sign-in left over in this browser (a shared computer, an earlier test)
  // would otherwise skip step 1 unseen. Step 2 names the account, with "Not you?". The upgrade and the reactivation are
  // opened from inside the account, so they are not asked.
  const arrivedSignedIn = isAuthenticated && !cameThroughStep1 && !isReactivation && !isWarmUpgrade && !!email;
  const returnPath = isReactivation
    ? `${COACHES_START_PATH}?${new URLSearchParams({ reactivateOrgSlug: reactivationOrgSlug ?? '', ...(reactivationTeamName ? { teamName: reactivationTeamName } : {}), ...(isKeepPremium ? { keep: '1' } : {}) })}`
    : `${COACHES_START_PATH}?billing=${billingCycle}`;
  // Where the verification link returns: step 2 of this card — the reactivation, or Coach Premium's own step
  // (the account remembers the door, so a resend from sign-in lands there too).
  const confirmedAt = (path: string) => `${path}${path.includes('?') ? '&' : '?'}confirmed=1`;
  const linkPath = isReactivation ? confirmedAt(returnPath) : startDoorLinkPath('premium');
  const seasonName = cleanTeamName ? `${cleanTeamName} ${seasonYear}` : `Team ${seasonYear}`;

  // The heading names what the person came to do (rule 3); the offer is the one sub line, read from the plan settings so
  // the upgrade and the reactivation keep their own.
  const offer = `Premium Coaches Portal. ${MONTHLY} or ${ANNUAL} ${BILLING_TAX_WORDS.plusTax}.`;
  const title = isKeepPremium
    ? 'Keep Premium'
    : isReactivation
      ? 'Reactivate Premium'
      : isWarmUpgrade ? `Upgrade ${prefillTeamName?.trim() || 'your team'} to Premium` : 'Coach a team';
  const sub = isKeepPremium
    ? KEEP_PREMIUM_LINE
    : isReactivation
      ? 'Restore your team workspace instead of starting a new one.'
      : offer;
  // Step 2 names what it does (rule 3, D-F6): "Continue to checkout", as a card is needed. No arrows.
  const submitLabel = 'Continue to checkout';

  // GST/HST Stage 1 (drawing tab 4): a coach buys Premium as themselves, so a paid checkout needs their home address first.
  // With none on file, a third step "Address" follows Team (whose button becomes Next); with one, a "Billed to … Change"
  // line sits above Continue to checkout.
  const billingAddress = useBillingAddressGate(isAuthenticated ? { scope: 'person' } : null);
  const usSalesOpen = billingAddress.info?.usSalesOpen ?? false;
  const addressForm = useAddressDraft(null, usSalesOpen);
  const [addressStep, setAddressStep] = useState(false);
  const [changingAddress, setChangingAddress] = useState(false);
  const [prefilledAddress, setPrefilledAddress] = useState(false);
  if (!prefilledAddress && billingAddress.info) {
    setPrefilledAddress(true);
    addressForm.reset(billingAddress.info.location);
  }
  const addressOnFileNow = billingAddress.location;
  const needsAddressStep = !addressOnFileNow;
  const addressFieldsShown = addressStep || changingAddress;
  // The main button (and the §20 (3) line above it) is withheld while the address fields say the country is closed.
  const buttonShown = !(addressFieldsShown && addressForm.usClosed);

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
    // The button is off until the tick (terms.blocked); this is the backstop — without the tick nothing is sent.
    if (authMode === 'signup' && terms.missing) {
      setError(terms.missing);
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
            // A reactivation is a returning coach, not a start: it keeps no remembered door.
            ...(isReactivation ? {} : { startDoor: 'premium', billing: billingCycle }),
            ...terms.fields,
          }),
        });
        const signupPayload = await readJson(signupRes);
        // The Terms refusal first: its "the terms changed" twin is a 409 too, and is not "this email has an account".
        const termsLine = terms.refusal(signupPayload);
        if (termsLine) throw new Error(termsLine);
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
      if (signin.handedOff) return; // two-step is on: the code step finishes the sign-in and returns here
      if (signin.error === 'email_not_confirmed') {
        // A waiting account: the check-your-email block, with Send the link again (V3), rather than a dead end.
        setPassword('');
        setVerificationEmail(email.trim().toLowerCase());
        setBusyLabel('');
        return;
      }
      // The one set of sign-in words (lib/auth-errors), never a raw code (owner 2026-10-20).
      if (signin.error) throw new Error(signInErrorCopy(signin.error));
      // After a session ended under the card, a sign-in as SOMEONE ELSE must not inherit that account's address.
      if (endedAs && email.trim().toLowerCase() !== endedAs) dropAddressState();
      setEndedAs(null);
      setSignedInHere(true);
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

    // Through the Terms gate (GST/HST Stage 6 step 6.3, C3): read before any other 409 (`portal_exists`). A stop opens the
    // window; after the tick the same checkout goes again. Closed: the step is as it was.
    const response = await checkoutGate.send('/api/billing/create-team-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamName: cleanTeamName,
        workspaceName: `${cleanTeamName} Coaches Portal`,
        sport,
        division: null,
        seasonName,
        seasonYear,
        billingCycle,
        returnTo: returnPath,
        reactivateOrgSlug: reactivationOrgSlug,
        // Per-team upgrade: forward the originating free team so the server (after re-verifying
        // ownership) back-links the new Premium workspace to it and migrates its data. Null for
        // brand-new signups.
        basicCoachTeamId: prefillBasicTeamId,
      }),
    });
    if (!response) { setBusyLabel(''); return; }

    const payload = await readJson(response);
    // In place, not a trip to the sign-in page: that page would lose the team and address typed here (nothing typed
    // lives in the browser tab, F02).
    if (response.status === 401) throw new SessionEndedError();
    // No home address on file after all (saved in another tab, then removed, or US sales closed since): the Address step.
    if (!response.ok && isAddressRefusal(payload)) throw new AddressNeededError();
    if (!response.ok) {
      throw new Error(getPayloadError(payload, 'Could not start Coaches Portal checkout.'));
    }
    if (typeof payload.url !== 'string' || !payload.url) {
      throw new Error('Checkout did not return a destination URL.');
    }

    window.location.assign(payload.url);
  }

  /** Step 2: one tap starts the checkout (never automatically, V1) — or, with no home address on file, goes to Address. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');

    const validationError = validateTeam();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!changingAddress && !addressOnFile(await billingAddress.load())) {
      setAddressStep(true);
      return;
    }
    if (changingAddress && !(await saveAddress())) return;
    await checkoutOrSay();
  }

  /** Step 3 (and Change on step 2): save the home address first ("Saving…", once); a failed save keeps everything typed. */
  async function saveAddress(): Promise<boolean> {
    if (!addressForm.check().ok) return false;
    setBusyLabel(BILLING_ADDRESS_FORM_WORDS.saving);
    const saved = await saveBillingAddress({ scope: 'person' }, addressForm.body);
    if (saved.ok) { billingAddress.remember(saved.location); return true; }
    setBusyLabel('');
    if (saved.signedOut) sessionEnded();
    else if (saved.errors) addressForm.setErrors(saved.errors);
    else setError(BILLING_LOCATION_WORDS.saveFailed);
    return false;
  }

  async function handleAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!(await saveAddress())) return;
    await checkoutOrSay();
  }

  async function checkoutOrSay() {
    try {
      await startCheckout();
    } catch (err) {
      if (err instanceof AddressNeededError) { setBusyLabel(''); setAddressStep(true); return; }
      if (err instanceof SessionEndedError) { setBusyLabel(''); sessionEnded(); return; }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusyLabel('');
    }
  }

  /**
   * The session ended under the card: back to step 1 in sign-in, the email kept, one line saying why. The team, the
   * billing and the address stay in the card, so the sign-in returns to the step the person was on.
   */
  function sessionEnded() {
    setEndedAs((email || signedInEmail || '').trim().toLowerCase() || null);
    // The address on file is read again for whoever signs in; what was typed in the fields stays (prefilledAddress holds).
    billingAddress.forget();
    setIsAuthenticated(false);
    setAuthMode('signin');
    setPassword('');
    setError(SIGNED_OUT_LINE);
    setFocusEmail(true);
  }

  /** Everything the card holds about one account's address: dropped when the person changes, and read again for the next. */
  function dropAddressState() {
    setAddressStep(false);
    setChangingAddress(false);
    billingAddress.forget();
    addressForm.reset(null);
    setPrefilledAddress(false);
  }

  /**
   * "Not you?" on step 2 for someone who arrived already signed in (a sign-in left over in this browser): sign that
   * account out and start at step 1, Create account. What was typed on step 2 stays; the account's email and address do not.
   */
  async function notYou() {
    if (busy) return;
    setBusyLabel('Signing out…');
    try {
      // This browser only: the person pressing it is not the account's owner, whose other devices stay signed in.
      await signOut({ scope: 'local' });
    } catch {
      setBusyLabel('');
      setError('Couldn’t sign out. Try again.');
      return;
    }
    setBusyLabel('');
    setIsAuthenticated(false);
    setAuthMode('signup');
    setEmail('');
    setPassword('');
    setError('');
    dropAddressState();
    setFocusEmail(true);
    router.refresh();
  }

  /** The in-card sign-in and the account form swap in place; the foot link is the only way between them (R1: no toggle). */
  function switchAuthMode(mode: AuthMode) {
    setError('');
    setAuthMode(mode);
    setFocusEmail(true);
  }

  // The step line every start sign-up wears (A2): on step 1, and on step 2 when the person has just come through step 1.
  const steps = ((onAccountStep && !isReactivation) || cameThroughStep1)
    ? <StartSteps current={onAccountStep ? 1 : addressStep ? 3 : 2} labels={needsAddressStep || addressStep ? ['Account', 'Team', 'Address'] : ['Account', 'Team']} />
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
            lead={<>Your account is almost ready. Open the link we sent to confirm your email. It brings you straight to naming your team.</>}
            after={<>Open it on any phone or computer.</>}
            resendNext={linkPath}
            onChangeEmail={() => { setVerificationEmail(''); setFocusEmail(true); }}
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
                  disabled={busy}
                  autoFocus={focusEmail ? 'email' : undefined}
                />
              ) : (
                <>
                  <EmailField id="premium-email" value={email} onChange={setEmail} disabled={busy} autoFocus={focusEmail} />
                  <PasswordField id="premium-password" value={password} onChange={setPassword} purpose="current" disabled={busy} />
                </>
              )}

              {authMode === 'signup' && <TermsTickRow tick={terms} id="premium-terms" disabled={busy} />}
              {notices}
              <button type="submit" className={accountForm.primary} disabled={busy || teamIsGated || (authMode === 'signup' && terms.blocked)}>
                {busyLabel || (authMode === 'signup' ? 'Create account' : 'Sign in')}
              </button>
            </form>

            {(authMode === 'signup' || !isReactivation) && (
            <StartFoot legal>
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
      ) : addressStep ? (
        <>
          <form className={accountForm.form} onSubmit={handleAddress}>
            <p className={accountForm.hint}>{BILLING_ADDRESS_FORM_WORDS.personIntro}</p>
            <BillingAddressFields form={addressForm} idPrefix="premium-address" subject={{ kind: 'person' }}
              variant="start" disabled={busy} />
            {notices}
            {/* A US address while US sales are closed: the amber line under Country says why, and there is no button. */}
            {/* §20 (3) above Continue to checkout, at the column's fine-print size (step 6.3, drawing tab 5, pin 4). */}
            {!addressForm.usClosed && <PlanTermsLine place="column" trial={PLAN_CONFIG.team.trialDays} />}
            {!addressForm.usClosed && (
              <button type="submit" className={accountForm.primary} disabled={busy || teamIsGated}>
                {busyLabel || 'Continue to checkout'}
              </button>
            )}
          </form>

          <StartFoot legal>
            <p>
              <button type="button" className={accountForm.footLink} onClick={() => { setError(''); setAddressStep(false); }} disabled={busy}>Back</button>
            </p>
          </StartFoot>
        </>
      ) : (
        <>
          <form className={accountForm.form} onSubmit={handleSubmit}>
            {confirmed && <p className={accountForm.body}>Your email is confirmed.</p>}
            {arrivedSignedIn && (
              <p className={accountForm.hint}>
                Signed in as <strong>{email}</strong> ·{' '}
                <button type="button" className={accountForm.footLink} onClick={() => { void notYou(); }} disabled={busy}>Not you?</button>
              </p>
            )}
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
                is hidden — the value still rides along to checkout. Cold signups pick it. */}
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
              <span className={accountForm.label} id="premium-billing">Billing</span>
              <ChoicePair
                labelledBy="premium-billing"
                value={billingCycle}
                options={BILLING_OPTIONS}
                onChange={setBillingCycle}
                disabled={busy}
              />
              {/* GST/HST Stage 2 Part 4: the choices keep their short price; where the sub line above names no price (Keep,
                  Reactivate) the one sentence says it once. The offer's own sub line already carries the phrase. */}
              {sub !== offer && <p className={accountForm.hint}>{BILLING_TAX_WORDS.pricesPlusTax}</p>}
            </div>

            {addressOnFileNow && !changingAddress && (
              <p className={addressStyles.billedToStart}>
                <span>{BILLING_ADDRESS_FORM_WORDS.billedTo(formatBilledTo(addressOnFileNow))}</span>
                <button type="button" className={addressStyles.changeStart} onClick={() => setChangingAddress(true)} disabled={busy}>{BILLING_ADDRESS_FORM_WORDS.change}</button>
              </p>
            )}
            {changingAddress && (
              <BillingAddressFields form={addressForm} idPrefix="premium-address" subject={{ kind: 'person' }}
                variant="start" disabled={busy} />
            )}

            {notices}
            {/* §20 (3) above the button when it goes to checkout at a price (step 6.3, drawing tab 5, pin 4). Not while the button is "Next" to the Address step (the line waits there). */}
            {!(needsAddressStep && !changingAddress) && buttonShown && <PlanTermsLine place="column" trial={PLAN_CONFIG.team.trialDays} />}
            {/* Tappable whenever it can work: a missing name or the wrong account says so beside it (validateTeam). */}
            {buttonShown && (
              <button type="submit" className={accountForm.primary} disabled={busy || teamIsGated}>
                {busyLabel || (needsAddressStep && !changingAddress ? 'Next' : submitLabel)}
              </button>
            )}
            {isWarmUpgrade && (
              <p className={accountForm.fine}>Your roster, schedule and fees come with you; your free team stays as history. Cancel any time.</p>
            )}
          </form>

          <StartFoot legal>
            <p>
              <Link href="/discover" className={accountForm.footLink}>Not now, go to Home</Link>
            </p>
          </StartFoot>
        </>
      )}
      {checkoutGate.window}
    </StartColumn>
  );
}
