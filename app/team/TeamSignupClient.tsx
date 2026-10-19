'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { OFFERED_SPORT_OPTIONS as SHARED_SPORT_OPTIONS } from '@/lib/sports';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  LogIn,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { signIn } from '@/lib/auth';
import {
  COACHES_CLAIM_PATH,
  COACHES_START_PATH,
} from '@/lib/coaches-portal-routes';
import { PLAN_CONFIG, formatPriceAmount, normalizeBillingCycle, FOUNDING_SEASON_END_LABEL } from '@/lib/plan-config';
import { startDoorLinkPath } from '@/lib/start-door';
import VerifyEmailSent from '@/components/auth/VerifyEmailSent';
import StartSteps from '@/components/auth/StartSteps';
import styles from './page.module.css';

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

const VALUE_POINTS = [
  ['Roster and documents', 'Keep player details, jersey numbers, positions, and season documents in one coach-owned workspace.'],
  ['Schedule and game day', 'Plan practices, games, attendance, and baseball/softball lineups from the same calendar.'],
  ['Dues and budget', 'Track player dues, expenses, payment requests, budget lines, and reminders without a club admin account.'],
  ['Club-ready when your org joins', 'If your organization moves to Club, it can bring your team in with everything you’ve built — and you won’t be charged for your own portal again.'],
] as const;

const WORKFLOW_STEPS = [
  ['1', 'Activate the team', 'Start fresh, or carry over your team details from a recent tournament.'],
  ['2', 'Run the season', 'Use the Coaches Portal for roster, schedule, dues, documents, attendance, and lineups.'],
  ['3', 'Grow locally', 'Host an invite-only round robin or exhibition weekend when nearby teams want more games.'],
] as const;

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password. Please try again.',
  email_not_confirmed: 'Please verify your email before signing in.',
  too_many_requests: 'Too many sign-in attempts. Please wait a moment and try again.',
  auth_timeout: 'Sign-in is taking too long. Check your connection and try again.',
  network_error: 'Could not reach the auth service. Please try again.',
};

function slugPreview(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

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
  // Not a tournament claim, not a reactivation. Drives a focused confirm-&-pay layout instead of
  // the cold acquisition pitch.
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

  const busy = !!busyLabel;
  const cleanTeamName = teamName.trim();
  const previewSlug = slugPreview(cleanTeamName) || 'your-team';
  const planPrice = foundingPromoActive
    ? `Free through ${FOUNDING_SEASON_END_LABEL}`
    : billingCycle === 'annual'
      ? `${formatPriceAmount(PLAN_CONFIG.team.annualPrice)} CAD / season`
      : `${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)} CAD / month`;
  // Account-first (Part 3, owner A1–A3 2026-10-18): signed out, the card is step 1 — the account alone; signed in, it is
  // step 2 — today's signed-in card (team, sport, plan, then checkout). Nothing typed lives in the browser tab (F02).
  const onAccountStep = !isAuthenticated;
  // Step 2 shows the two-step line to someone who has just come through step 1: by the email link, or in this visit.
  const cameThroughStep1 = !isReactivation && (confirmed || (isAuthenticated && startedSignedOut));
  const accountReady = !!email.trim() && password.length >= (authMode === 'signup' ? 8 : 1)
    && (authMode === 'signin' || (!!firstName.trim() && !!lastName.trim()));
  const claimEmailMismatch = !!claim && isAuthenticated && !!email && email.trim().toLowerCase() !== claim.contactEmail.toLowerCase();
  const canSubmit = !teamIsGated && !claimEmailMismatch && cleanTeamName.length >= 2 && isAuthenticated && !busy;
  const claimPath = claim ? `${COACHES_CLAIM_PATH}/${encodeURIComponent(claim.token)}` : COACHES_START_PATH;
  const returnPath = isReactivation
    ? `${COACHES_START_PATH}?${new URLSearchParams({ reactivateOrgSlug: reactivationOrgSlug ?? '', ...(reactivationTeamName ? { teamName: reactivationTeamName } : {}) })}`
    : `${claimPath}?billing=${billingCycle}`;
  // Where the verification link returns: step 2 of this card — the claim, the reactivation, or Coach Premium's own step
  // (the account remembers the door, so a resend from sign-in lands there too).
  const confirmedAt = (path: string) => `${path}${path.includes('?') ? '&' : '?'}confirmed=1`;
  const linkPath = claim ? confirmedAt(claimPath) : isReactivation ? confirmedAt(returnPath) : startDoorLinkPath('premium');
  const founding = foundingPromoActive && !isReactivation;
  // The two notices sit just above whichever step's button is showing.
  const notices = (
    <>
      {teamIsGated && <div className={styles.errorBox}>Coaches Portal self-serve signup is not open yet.</div>}
      {error && <div className={styles.errorBox} role="alert">{error}</div>}
    </>
  );
  const submitLabel = isWarmUpgrade
    ? (founding ? 'Upgrade to Premium — free' : 'Upgrade now')
    : isReactivation ? 'Start reactivation' : founding ? 'Start free' : 'Start checkout';

  const seasonName = cleanTeamName ? `${cleanTeamName} ${seasonYear}` : `Team ${seasonYear}`;

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
    setBusyLabel(authMode === 'signup' ? 'Creating account...' : 'Signing in...');
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
            // and the claim left open — the organizer's claim email is the way back.
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
    setBusyLabel('Starting checkout...');

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
    // warm success screen (design_decisions S1-2): it names the free period, then "Open your season
    // workspace →" hands off into the operating portal (its own theme — the deliberate handoff). A
    // real Stripe checkout returns an external URL and goes straight there; any non-founding path is
    // unchanged (the welcome screen is the founding launch moment).
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

  return (
    <main className={styles.page}>
      <section className={styles.signupSurface} data-warm={isWarmUpgrade ? 'true' : undefined}>
        <div className={styles.copyPane}>
          <p className={styles.eyebrow}>{claim ? 'Tournament team claim' : isReactivation ? 'Coaches Portal reactivation' : 'Premium Coaches Portal'}</p>
          <h1 className={styles.title}>{claim ? 'Upgrade this team in Coaches Portal' : isReactivation ? 'Reactivate Premium without starting over.' : isWarmUpgrade ? `Upgrade ${cleanTeamName || 'your team'} to Premium.` : 'From tournament weekend to season workspace.'}</h1>
          <p className={styles.lede}>
            {claim
              ? `${claim.tournamentName} already has your team details. Confirm the season setup, create or sign into the contact account, and activate the Premium Coaches Portal.`
              : isReactivation
                ? 'Restart your Premium subscription during the retention window and restore the same team workspace instead of creating a duplicate.'
              : isWarmUpgrade
                ? 'You\'re one step from Premium — confirm your team and billing below, and you\'re in.'
              : 'One team, one place — roster, schedule, dues, budget, and documents, managed without a club admin account. Plus one hosted tournament at a time when your team wants more games.'}
          </p>

          {!claim && !isWarmUpgrade && (
            <div className={styles.heroActions}>
              <a href="#team-signup-form" className={styles.heroPrimary}>Get started</a>
              <Link href="/pricing#team-pricing" className={styles.heroSecondary}>Compare pricing</Link>
            </div>
          )}

          <div className={styles.pricePanel}>
            <div>
              {foundingPromoActive && (
                <span className={styles.promoPill}>Founding Season</span>
              )}
              <p className={styles.priceLabel}>Premium Coaches Portal</p>
              <p className={styles.price}>{planPrice}</p>
              {foundingPromoActive && (
                <p className={styles.priceSub}>normally {formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month · no credit card</p>
              )}
            </div>
            <div className={styles.priceMeta}>
              <ShieldCheck size={16} />
              One competitive team
            </div>
          </div>

          {!claim && !isWarmUpgrade && (
            <>
              <div className={styles.workspacePreview} aria-label="Coaches Portal preview">
                <div className={styles.previewHeader}>
                  <div>
                    <span className={styles.previewKicker}>Coaches Portal</span>
                    <strong>Season setup</strong>
                  </div>
                  <span className={styles.previewBadge}>5 of 7</span>
                </div>
                <div className={styles.previewGrid}>
                  {['Roster ready', 'Calendar built', 'Lineup PDF', 'Budget next'].map(item => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>

              <div className={styles.valueGrid}>
                {VALUE_POINTS.map(([label, body]) => (
                  <div className={styles.valueCard} key={label}>
                    <p>{label}</p>
                    <span>{body}</span>
                  </div>
                ))}
              </div>

              <div className={styles.workflowPanel}>
                <p className={styles.workflowTitle}>Keep the team running after the tournament</p>
                <div className={styles.workflowSteps}>
                  {WORKFLOW_STEPS.map(([step, label, body]) => (
                    <div className={styles.workflowStep} key={step}>
                      <span>{step}</span>
                      <div>
                        <p>{label}</p>
                        <small>{body}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {isWarmUpgrade && (
            <div className={styles.carryOver}>
              <p className={styles.carryOverTitle}>Everything you&apos;ve entered comes with you</p>
              <p className={styles.carryOverBody}>
                Your roster, schedule and fees transfer into Premium automatically — nothing to
                re-enter, and your free team stays available as history. Cancel anytime.
              </p>
            </div>
          )}

          {!isWarmUpgrade && (
            <div className={styles.benefitGrid}>
              {[
                claim
                  ? ['Prefilled from your tournament', 'Your team details from the tournament start the setup — no re-typing.']
                  : ['Your workspace, your call', 'The Coaches Portal belongs to you as the coach — not your club\'s admin account.'],
                ['One team, no overlap', 'It\'s just your team. Other coaches and admins in your organization don\'t automatically get in.'],
                ['Your data stays yours', 'If your club is on FieldLogicHQ they can see your team exists, but your roster, budget and documents stay yours unless you choose to share.'],
              ].map(([label, body]) => (
                <div className={styles.benefit} key={label}>
                  <Check size={14} />
                  <div>
                    <p>{label}</p>
                    <span>{body}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form id="team-signup-form" className={styles.formPane} onSubmit={onAccountStep ? handleAccount : handleSubmit}>
          <div className={styles.formHeader}>
            <div>
              <p className={styles.formKicker}>{claim ? 'Secure claim' : isWarmUpgrade ? 'Confirm your upgrade' : 'Start setup'}</p>
              <h2>{claim ? 'Activate from tournament' : isWarmUpgrade ? 'Confirm and pay' : isReactivation ? 'Reactivate Premium' : 'Create your Coaches Portal'}</h2>
            </div>
            <Users size={22} />
          </div>

          {/* The two-step line every start sign-up wears (A2; D3: "Your team"): on step 1, and on step 2 when the person
              has just come through step 1 — by the email link or in this visit. */}
          {((onAccountStep && !isReactivation) || cameThroughStep1) && (
            <StartSteps current={onAccountStep ? 1 : 2} second="Your team" />
          )}

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
                onChangeEmail={claim ? undefined : () => setVerificationEmail('')}
                signInHref={`/auth/login?next=${encodeURIComponent(linkPath)}&email=${encodeURIComponent(verificationEmail)}`}
              />
            ) : (
              <>
                <div className={styles.sectionBlock}>
                  <div className={styles.authModeRow}>
                    <div className={styles.sectionTitle}>
                      <LogIn size={16} />
                      Account
                    </div>
                    <div className={styles.authToggle} role="group" aria-label="Account mode">
                      <button
                        type="button"
                        className={authMode === 'signup' ? styles.authActive : ''}
                        onClick={() => setAuthMode('signup')}
                        disabled={busy}
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        className={authMode === 'signin' ? styles.authActive : ''}
                        onClick={() => setAuthMode('signin')}
                        disabled={busy}
                      >
                        Sign in
                      </button>
                    </div>
                  </div>
                  {authMode === 'signup' && (
                    <div className={styles.twoCol}>
                      <label className={styles.field}>
                        <span>First name <span className={styles.reqMark}>*</span></span>
                        <input
                          value={firstName}
                          onChange={event => setFirstName(event.target.value)}
                          placeholder="Jordan"
                          autoComplete="given-name"
                          disabled={busy}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Last name <span className={styles.reqMark}>*</span></span>
                        <input
                          value={lastName}
                          onChange={event => setLastName(event.target.value)}
                          placeholder="Lee"
                          autoComplete="family-name"
                          disabled={busy}
                        />
                      </label>
                    </div>
                  )}
                  <label className={styles.field}>
                    <span>Email <span className={styles.reqMark}>*</span></span>
                    <input
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      type="email"
                      placeholder="coach@example.com"
                      autoComplete="email"
                      disabled={busy || !!claim}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Password</span>
                    <input
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      type="password"
                      placeholder={authMode === 'signup' ? 'At least 8 characters' : 'Enter password'}
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      disabled={busy}
                    />
                  </label>
                </div>

                {notices}
                {/* D7: "Create account", no dash or arrow. */}
                <button type="submit" className={styles.primaryButton} disabled={busy || !accountReady || teamIsGated}>
                  <span>{busyLabel || (authMode === 'signup' ? 'Create account' : 'Sign in')}</span>
                </button>
                {authMode === 'signup' && (
                  <p className={styles.fineNote}>
                    {claim
                      ? 'Next, confirm your email. Then check your team and pick the plan you\'ll move to.'
                      : 'Next, confirm your email. Then name your team, pick the sport and the plan you\'ll move to.'}
                  </p>
                )}
              </>
            )
          ) : (
            <>
              {confirmed && <p className={styles.confirmedLine}>Your email is confirmed.</p>}
              <div className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>
                  <ClipboardList size={16} />
                  Team details
                </div>
                <label className={styles.field}>
                  <span>Team name <span className={styles.reqMark}>*</span></span>
                  <input
                    value={teamName}
                    onChange={event => setTeamName(event.target.value)}
                    placeholder="Milton Thunder U15"
                    autoComplete="organization"
                    disabled={busy}
                  />
                </label>
                {/* Warm upgrade already knows the sport (carried from the free team), so the picker
                    is hidden — the value still rides along to checkout. Cold/claim signups pick it. */}
                {!isWarmUpgrade && (
                  <label className={styles.field}>
                    <span>Sport</span>
                    <select value={sport} onChange={event => setSport(event.target.value)} disabled={busy}>
                      {SPORT_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                )}
                <p className={styles.previewLine}>
                  Portal URL preview: <span>fieldlogichq.ca/{previewSlug}</span>
                </p>
              </div>

              <div className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>
                  <WalletCards size={16} />
                  Billing
                </div>
                {foundingPromoActive && (
                  <p className={styles.billingNote}>
                    Free through {FOUNDING_SEASON_END_LABEL} — no card required. Pick the plan you&apos;ll move to after; change it any time before then.
                  </p>
                )}
                <div className={styles.segmented} role="group" aria-label="Billing cycle">
                  <button
                    type="button"
                    className={billingCycle === 'annual' ? styles.segmentActive : ''}
                    onClick={() => setBillingCycle('annual')}
                    disabled={busy}
                    aria-pressed={billingCycle === 'annual'}
                  >
                    Seasonal{' '}
                    <span>{foundingPromoActive && 'then '}{formatPriceAmount(PLAN_CONFIG.team.annualPrice)} CAD</span>
                  </button>
                  <button
                    type="button"
                    className={billingCycle === 'monthly' ? styles.segmentActive : ''}
                    onClick={() => setBillingCycle('monthly')}
                    disabled={busy}
                    aria-pressed={billingCycle === 'monthly'}
                  >
                    Monthly{' '}
                    <span>{foundingPromoActive && 'then '}{formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)} CAD</span>
                  </button>
                </div>
              </div>

              <div className={claimEmailMismatch ? styles.errorBox : styles.sessionState}>
                <ShieldCheck size={16} />
                {claimEmailMismatch
                  ? `Signed in as ${email}. This claim is reserved for ${claim?.contactEmail}.`
                  : 'Signed in and ready for checkout.'}
              </div>
              {notices}
              <button type="submit" className={styles.primaryButton} disabled={!canSubmit}>
                <span>{busyLabel || submitLabel}</span>
                <ArrowRight size={16} />
              </button>

              <div className={styles.footerRow}>
                {foundingPromoActive
                  ? <span className={styles.footerNote}><CalendarDays size={14} /> Free through {FOUNDING_SEASON_END_LABEL}</span>
                  : <span><CalendarDays size={14} /> {seasonName}</span>}
                {isWarmUpgrade
                  ? <span className={styles.footerNote}>Cancel anytime</span>
                  : <Link href="/pricing">Compare plans</Link>}
              </div>
            </>
          )}
        </form>
      </section>
    </main>
  );
}
