'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { getUser, signIn } from '@/lib/auth';
import {
  COACHES_CLAIM_PATH,
  COACHES_START_PATH,
} from '@/lib/coaches-portal-routes';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
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
};

const DRAFT_KEY = 'fieldlogichq.coaches.signup.draft';

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
  ['Club-ready when your org joins', 'If your organization moves to FieldLogicHQ, your portal carries over automatically — your roster, budget and documents stay yours.'],
] as const;

const WORKFLOW_STEPS = [
  ['1', 'Activate the team', 'Start fresh, or carry over your team details from a recent tournament.'],
  ['2', 'Run the season', 'Use the Coaches Portal for roster, schedule, dues, documents, attendance, and lineups.'],
  ['3', 'Grow locally', 'Create a free-tier round robin or exhibition weekend when nearby teams want more games.'],
] as const;

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password. Please try again.',
  email_not_confirmed: 'Please verify your email before signing in.',
  too_many_requests: 'Too many sign-in attempts. Please wait a moment and try again.',
  auth_timeout: 'Sign-in is taking too long. Check your connection and try again.',
  network_error: 'Could not reach the auth service. Please try again.',
};

function normalizeBilling(value: string | null): BillingCycle {
  return value === 'annual' ? 'annual' : 'monthly';
}

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
}: TeamSignupClientProps) {
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
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(normalizeBilling(searchParams.get('billing')));
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState(claim?.contactEmail ?? '');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  const busy = !!busyLabel;
  const cleanTeamName = teamName.trim();
  const previewSlug = slugPreview(cleanTeamName) || 'your-team';
  const planPrice = billingCycle === 'annual'
    ? `${formatPriceAmount(PLAN_CONFIG.team.annualPrice)} CAD / season`
    : `${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)} CAD / month`;
  const accountReady = isAuthenticated || (email.trim() && password.length >= (authMode === 'signup' ? 8 : 1));
  const claimEmailMismatch = !!claim && isAuthenticated && !!email && email.trim().toLowerCase() !== claim.contactEmail.toLowerCase();
  const canSubmit = !teamIsGated && !claimEmailMismatch && cleanTeamName.length >= 2 && !!accountReady && !busy;
  // Isolate the draft per claim / per originating free team so a stale generic draft can't clobber a
  // team-specific pre-fill (and vice versa).
  const draftKey = claim
    ? `${DRAFT_KEY}.${claim.token.slice(0, 12)}`
    : prefillBasicTeamId
      ? `${DRAFT_KEY}.team.${prefillBasicTeamId.slice(0, 12)}`
      : DRAFT_KEY;
  const claimPath = claim ? `${COACHES_CLAIM_PATH}/${encodeURIComponent(claim.token)}` : COACHES_START_PATH;
  const claimReturnPath = `${claimPath}?billing=${billingCycle}`;
  const returnPath = isReactivation
    ? `${COACHES_START_PATH}?reactivateOrgSlug=${encodeURIComponent(reactivationOrgSlug ?? '')}`
    : claimReturnPath;

  const seasonName = useMemo(() => {
    return cleanTeamName ? `${cleanTeamName} ${seasonYear}` : `Team ${seasonYear}`;
  }, [cleanTeamName, seasonYear]);

  useEffect(() => {
    window.queueMicrotask(() => {
      const stored = window.sessionStorage.getItem(draftKey);
      if (stored) {
        try {
          const draft = JSON.parse(stored) as Partial<{
            teamName: string;
            sport: string;
            billingCycle: BillingCycle;
            email: string;
          }>;
          if (draft.teamName) setTeamName(draft.teamName);
          // In a warm upgrade the sport is locked to the free team's (the picker is hidden) — don't
          // let a stale saved draft override that prefill.
          if (draft.sport && !isWarmUpgrade) setSport(draft.sport);
          if (draft.billingCycle) setBillingCycle(draft.billingCycle);
          if (draft.email) setEmail(draft.email);
        } catch {
          window.sessionStorage.removeItem(draftKey);
        }
      }

      const billing = normalizeBilling(searchParams.get('billing'));
      setBillingCycle(billing);
    });

    getUser()
      .then(user => {
        setIsAuthenticated(!!user);
        if (user?.email) setEmail(user.email);
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => setCheckingAuth(false));
  }, [draftKey, searchParams, isWarmUpgrade]);

  function saveDraft() {
    window.sessionStorage.setItem(draftKey, JSON.stringify({
      teamName,
      sport,
      billingCycle,
      email,
    }));
  }

  function validateForm() {
    if (teamIsGated) return 'Coaches Portal self-serve signup is not open yet.';
    if (cleanTeamName.length < 2) return 'Enter your team name.';
    if (!isAuthenticated && !email.trim()) return 'Enter your email address.';
    if (claim && email.trim().toLowerCase() !== claim.contactEmail.toLowerCase()) {
      return `This team claim is reserved for ${claim.contactEmail}.`;
    }
    if (claimEmailMismatch) {
      return `You are signed in as ${email}. Sign in with ${claim.contactEmail} to claim this team.`;
    }
    if (!isAuthenticated && authMode === 'signup' && password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (!isAuthenticated && authMode === 'signin' && !password) {
      return 'Enter your password.';
    }
    return '';
  }

  async function ensureAccount() {
    if (isAuthenticated) return true;

    setBusyLabel(authMode === 'signup' ? 'Creating account...' : 'Signing in...');
    saveDraft();

    if (authMode === 'signup') {
      const signupRes = await fetch('/api/auth/team-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next: claimPath }),
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
        setVerificationEmail(typeof signupPayload.email === 'string' ? signupPayload.email : email);
        return false;
      }
    }

    const signin = await signIn(email, password);
    if (signin.error) {
      throw new Error(AUTH_ERRORS[signin.error] ?? signin.error);
    }

    setIsAuthenticated(true);
    return true;
  }

  async function startCheckout() {
    setBusyLabel('Starting checkout...');
    saveDraft();

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

    window.sessionStorage.removeItem(draftKey);
    window.location.assign(payload.url);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setVerificationEmail('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const accountReadyForCheckout = await ensureAccount();
      if (!accountReadyForCheckout) return;
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
              : 'One team, one place — roster, schedule, dues, budget, and documents, managed without a club admin account. Plus a free local tournament slot when your team wants more games.'}
          </p>

          {!claim && !isWarmUpgrade && (
            <div className={styles.heroActions}>
              <a href="#team-signup-form" className={styles.heroPrimary}>Get started</a>
              <Link href="/pricing#team-pricing" className={styles.heroSecondary}>Compare pricing</Link>
            </div>
          )}

          <div className={styles.pricePanel}>
            <div>
              <p className={styles.priceLabel}>Premium Coaches Portal</p>
              <p className={styles.price}>{planPrice}</p>
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

        <form id="team-signup-form" className={styles.formPane} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <div>
              <p className={styles.formKicker}>{claim ? 'Secure claim' : isWarmUpgrade ? 'Confirm your upgrade' : 'Start setup'}</p>
              <h2>{claim ? 'Activate from tournament' : isWarmUpgrade ? 'Confirm and pay' : isReactivation ? 'Reactivate Premium' : 'Create your Coaches Portal'}</h2>
            </div>
            <Users size={22} />
          </div>

          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>
              <ClipboardList size={16} />
              Team details
            </div>
            <label className={styles.field}>
              <span>Team name</span>
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
            <div className={styles.segmented} role="group" aria-label="Billing cycle">
              <button
                type="button"
                className={billingCycle === 'annual' ? styles.segmentActive : ''}
                onClick={() => setBillingCycle('annual')}
                disabled={busy}
                aria-pressed={billingCycle === 'annual'}
              >
                Seasonal{' '}
                <span>{formatPriceAmount(PLAN_CONFIG.team.annualPrice)} CAD</span>
              </button>
              <button
                type="button"
                className={billingCycle === 'monthly' ? styles.segmentActive : ''}
                onClick={() => setBillingCycle('monthly')}
                disabled={busy}
                aria-pressed={billingCycle === 'monthly'}
              >
                Monthly{' '}
                <span>{formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)} CAD</span>
              </button>
            </div>
          </div>

          {!isAuthenticated && !checkingAuth && (
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
              <label className={styles.field}>
                <span>Email</span>
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
          )}

          {(isAuthenticated || checkingAuth) && (
            <div className={claimEmailMismatch ? styles.errorBox : styles.sessionState}>
              <ShieldCheck size={16} />
              {checkingAuth
                ? 'Checking your session...'
                : claimEmailMismatch
                  ? `Signed in as ${email}. This claim is reserved for ${claim?.contactEmail}.`
                  : 'Signed in and ready for checkout.'}
            </div>
          )}

          {verificationEmail && (
            <div className={styles.successBox}>
              Verification email sent to {verificationEmail}. After verifying, return here and continue checkout.
            </div>
          )}
          {teamIsGated && (
            <div className={styles.errorBox}>Coaches Portal self-serve signup is not open yet.</div>
          )}
          {error && <div className={styles.errorBox}>{error}</div>}

          <button type="submit" className={styles.primaryButton} disabled={!canSubmit}>
            <span>{busyLabel || (isAuthenticated ? (isWarmUpgrade ? 'Upgrade now' : isReactivation ? 'Start reactivation' : 'Start checkout') : authMode === 'signup' ? 'Create account and checkout' : 'Sign in and checkout')}</span>
            <ArrowRight size={16} />
          </button>

          <div className={styles.footerRow}>
            <span><CalendarDays size={14} /> {seasonName}</span>
            {isWarmUpgrade
              ? <span className={styles.footerNote}>Cancel anytime</span>
              : <Link href="/pricing">Compare plans</Link>}
          </div>
        </form>
      </section>
    </main>
  );
}
