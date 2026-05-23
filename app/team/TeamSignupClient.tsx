'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import styles from './page.module.css';

type BillingCycle = 'monthly' | 'annual';
type AuthMode = 'signup' | 'signin';

export type TeamClaimPrefill = {
  token: string;
  contactEmail: string;
  teamName: string;
  coachName: string | null;
  ageGroup: string | null;
  tournamentName: string;
  seasonYear: number;
};

type TeamSignupClientProps = {
  teamIsGated: boolean;
  claim?: TeamClaimPrefill | null;
};

const DRAFT_KEY = 'fieldlogichq.team.signup.draft';

const SPORT_OPTIONS = [
  'Softball',
  'Baseball',
  'Hockey',
  'Soccer',
  'Lacrosse',
  'Basketball',
  'Volleyball',
  'Other',
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

export default function TeamSignupClient({ teamIsGated, claim = null }: TeamSignupClientProps) {
  const searchParams = useSearchParams();
  const currentYear = new Date().getFullYear();
  const [teamName, setTeamName] = useState(claim?.teamName ?? '');
  const [sport, setSport] = useState('Softball');
  const [ageGroup, setAgeGroup] = useState(claim?.ageGroup ?? '');
  const [seasonYear, setSeasonYear] = useState(String(claim?.seasonYear ?? currentYear));
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
  const cleanAgeGroup = ageGroup.trim();
  const parsedSeasonYear = Number.parseInt(seasonYear, 10);
  const validSeasonYear = Number.isInteger(parsedSeasonYear) && parsedSeasonYear >= 2000 && parsedSeasonYear <= 2100;
  const previewSlug = slugPreview(cleanTeamName) || 'your-team';
  const planPrice = billingCycle === 'annual' ? '$290 CAD / season' : '$29 CAD / month';
  const accountReady = isAuthenticated || (email.trim() && password.length >= (authMode === 'signup' ? 8 : 1));
  const claimEmailMismatch = !!claim && isAuthenticated && !!email && email.trim().toLowerCase() !== claim.contactEmail.toLowerCase();
  const canSubmit = !teamIsGated && !claimEmailMismatch && cleanTeamName.length >= 2 && validSeasonYear && !!accountReady && !busy;
  const draftKey = claim ? `${DRAFT_KEY}.${claim.token.slice(0, 12)}` : DRAFT_KEY;
  const claimReturnPath = claim ? `/team/claim/${encodeURIComponent(claim.token)}?billing=${billingCycle}` : `/team?billing=${billingCycle}`;

  const seasonName = useMemo(() => {
    return cleanTeamName ? `${cleanTeamName} ${parsedSeasonYear || currentYear}` : `Team ${parsedSeasonYear || currentYear}`;
  }, [cleanTeamName, currentYear, parsedSeasonYear]);

  useEffect(() => {
    window.queueMicrotask(() => {
      const stored = window.sessionStorage.getItem(draftKey);
      if (stored) {
        try {
          const draft = JSON.parse(stored) as Partial<{
            teamName: string;
            sport: string;
            ageGroup: string;
            seasonYear: string;
            billingCycle: BillingCycle;
            email: string;
          }>;
          if (draft.teamName) setTeamName(draft.teamName);
          if (draft.sport) setSport(draft.sport);
          if (draft.ageGroup) setAgeGroup(draft.ageGroup);
          if (draft.seasonYear) setSeasonYear(draft.seasonYear);
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
  }, [draftKey, searchParams]);

  function saveDraft() {
    window.sessionStorage.setItem(draftKey, JSON.stringify({
      teamName,
      sport,
      ageGroup,
      seasonYear,
      billingCycle,
      email,
    }));
  }

  function validateForm() {
    if (teamIsGated) return 'Team workspace self-serve signup is not open yet.';
    if (cleanTeamName.length < 2) return 'Enter your team name.';
    if (!validSeasonYear) return 'Season year must be a valid four-digit year.';
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
        body: JSON.stringify({ email, password, next: claim ? `/team/claim/${claim.token}` : '/team' }),
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
        workspaceName: `${cleanTeamName} Team Workspace`,
        sport,
        ageGroup: cleanAgeGroup || null,
        seasonName,
        seasonYear: parsedSeasonYear,
        billingCycle,
        returnTo: claimReturnPath,
        claimToken: claim?.token ?? null,
      }),
    });

    const payload = await readJson(response);
    if (response.status === 401) {
      window.location.assign(`/auth/login?next=${encodeURIComponent(claim ? `/team/claim/${claim.token}` : '/team')}`);
      return;
    }
    if (!response.ok) {
      throw new Error(getPayloadError(payload, 'Could not start Team checkout.'));
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
      <section className={styles.signupSurface}>
        <div className={styles.copyPane}>
          <p className={styles.eyebrow}>{claim ? 'Tournament team claim' : 'Standalone Team workspace'}</p>
          <h1 className={styles.title}>{claim ? 'Claim your Team workspace' : 'Team workspace'}</h1>
          <p className={styles.lede}>
            {claim
              ? `${claim.tournamentName} already has your team details. Confirm the season setup, create or sign into the contact account, and activate your coach portal.`
              : 'One competitive team gets its own coach portal for the season: roster, schedule, player documents, dues, budget, and a free local tournament slot.'}
          </p>

          <div className={styles.pricePanel}>
            <div>
              <p className={styles.priceLabel}>Selected plan</p>
              <p className={styles.price}>{planPrice}</p>
            </div>
            <div className={styles.priceMeta}>
              <ShieldCheck size={16} />
              Team-scoped access only
            </div>
          </div>

          <div className={styles.benefitGrid}>
            {[
              claim
                ? ['Prefilled claim', 'Your tournament team details start the workspace setup.']
                : ['Coach-owned', 'The buyer lands in the coaches portal, not org onboarding.'],
              ['One team', 'Access is limited to the entitled rep team and active coach.'],
              ['Club-safe', 'Club org rep-team modules stay behind Club entitlements.'],
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
        </div>

        <form className={styles.formPane} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <div>
              <p className={styles.formKicker}>{claim ? 'Secure claim' : 'Start setup'}</p>
              <h2>{claim ? 'Activate from tournament' : 'Create your Team workspace'}</h2>
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
            <div className={styles.twoCol}>
              <label className={styles.field}>
                <span>Sport</span>
                <select value={sport} onChange={event => setSport(event.target.value)} disabled={busy}>
                  {SPORT_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Age group</span>
                <input
                  value={ageGroup}
                  onChange={event => setAgeGroup(event.target.value)}
                  placeholder="U15, 16U, Varsity"
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Season year</span>
              <input
                value={seasonYear}
                onChange={event => setSeasonYear(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]{4}"
                disabled={busy}
              />
            </label>
            <p className={styles.previewLine}>
              Workspace URL preview: <span>fieldlogichq.ca/{previewSlug}</span>
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
                Seasonal
                <span>$290 CAD</span>
              </button>
              <button
                type="button"
                className={billingCycle === 'monthly' ? styles.segmentActive : ''}
                onClick={() => setBillingCycle('monthly')}
                disabled={busy}
                aria-pressed={billingCycle === 'monthly'}
              >
                Monthly
                <span>$29 CAD</span>
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
            <div className={styles.errorBox}>Team workspace self-serve signup is not open yet.</div>
          )}
          {error && <div className={styles.errorBox}>{error}</div>}

          <button type="submit" className={styles.primaryButton} disabled={!canSubmit}>
            <span>{busyLabel || (isAuthenticated ? 'Start checkout' : authMode === 'signup' ? 'Create account and checkout' : 'Sign in and checkout')}</span>
            <ArrowRight size={16} />
          </button>

          <div className={styles.footerRow}>
            <span><CalendarDays size={14} /> {seasonName}</span>
            <Link href="/pricing">Compare plans</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
