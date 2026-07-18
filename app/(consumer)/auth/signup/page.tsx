'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { signIn } from '@/lib/auth';
import { safeNextPath } from '@/lib/safe-redirect';
import styles from '../auth.module.css';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Account-only mode (signup/org decoupling): reached as /auth/signup?account=1 from the
  // "I was invited / joining a team" option on /start. No org is created — the user makes
  // an account, verifies, lands on /home, and accepts their pending invite there. The
  // default (no ?account) is the owner path: org name field + org created at signup.
  const accountOnly = searchParams.get('account') === '1';
  // Fan / account-only signups can carry a return path (e.g. /discover or /following) so they
  // don't land on the org-oriented /home. Validated to a same-origin relative path so it can
  // never become an open redirect (safeNextPath handles tab/backslash/protocol-relative smuggling).
  const safeNext = safeNextPath(searchParams.get('next'), null);
  const [orgName, setOrgName]   = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  // Sign-up Invite Guard: the server detects (at submit) whether this email was already
  // invited or already has an account, and returns a branch instead of creating an org.
  const [inviteBranch, setInviteBranch] = useState<null | 'invited' | 'account_exists'>(null);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [showEscape, setShowEscape] = useState(false);

  // The public URL is auto-generated server-side from the org name; this is just a
  // friendly preview (the final slug may get a number suffix if the name is taken).
  const previewSlug = slugify(orgName) || 'your-org';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!accountOnly && !orgName.trim()) {
      setError('Enter an organization name.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    await submitSignup();
  }

  async function submitSignup() {
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Account-only mode omits orgName — the server creates no org. The owner path
      // sends the org name and gets an org created in one shot.
      body: JSON.stringify({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(accountOnly ? (safeNext ? { next: safeNext } : {}) : { orgName }),
      }),
    });

    const json = await res.json();

    // Sign-up Invite Guard (owner mode only): the server recognized this email before creating
    // anything. Adapt the screen instead of proceeding into org creation. The `!accountOnly`
    // guard is defensive — the server only returns inviteBranch on the owner path, never for the
    // account-only ("I was invited") flow, which surfaces its own 409 handled below.
    if (!accountOnly && json.inviteBranch === 'invited') {
      setInviteBranch('invited');
      setInviteOrgName(json.orgName ?? null);
      setInviteRole(json.role ?? null);
      setResendState('idle');
      setShowEscape(false);
      setLoading(false);
      return;
    }
    if (!accountOnly && json.inviteBranch === 'account_exists') {
      setInviteBranch('account_exists');
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    if (json.requiresEmailVerification) {
      setVerificationEmail(json.email ?? email);
      setLoading(false);
      return;
    }

    const { error: signInErr } = await signIn(email, password);
    if (signInErr) {
      setError(signInErr);
      setLoading(false);
      return;
    }

    // Account-only (dev / verification-off): land on Home (/discover), where reconciliation +
    // the pending-invitations card take over.
    if (accountOnly) {
      router.push(safeNext ?? '/discover');
      router.refresh();
      return;
    }

    const plan = searchParams.get('plan');
    const billing = searchParams.get('billing') === 'annual' ? 'annual' : searchParams.get('billing') === 'monthly' ? 'monthly' : null;
    const onboardingParams = new URLSearchParams({ choosePlan: '1' });
    if (plan) onboardingParams.set('plan', plan);
    if (billing) onboardingParams.set('billing', billing);
    const dest = json.orgSlug ? `/${json.orgSlug}/admin/onboarding?${onboardingParams.toString()}` : '/admin';
    router.push(dest);
    router.refresh();
  }

  async function handleResendInvite() {
    setResendState('sending');
    try {
      // Always returns neutral — we surface the same "check your inbox" regardless.
      await fetch('/api/auth/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Network hiccup — still guide them to their inbox; they can retry the link there.
    }
    setResendState('sent');
  }

  // Escape hatch: an already-invited email can't cleanly spin up its own org (it's tied to the
  // invite). Route them back to the form with a cleared email so a genuinely different org can
  // be created under a different address — never clobbering the pending account.
  function handleUseDifferentEmail() {
    setInviteBranch(null);
    setShowEscape(false);
    setResendState('idle');
    setEmail('');
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    staff: 'Staff',
    official: 'Scorekeeper',
    league_admin: 'League Administrator',
    league_registrar: 'League Registrar',
    treasurer: 'Treasurer',
    coach: 'Coach',
  };
  const roleDisplay = inviteRole ? (ROLE_LABELS[inviteRole] ?? inviteRole) : null;
  const isInvited = inviteBranch === 'invited';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div
            className={styles.iconWrap}
            style={isInvited ? { color: 'var(--logic-lime)', borderColor: 'rgba(163,230,53,0.4)', background: 'rgba(163,230,53,0.06)' } : undefined}
          >
            {isInvited ? (
              <MailCheck size={20} strokeWidth={1.6} aria-hidden />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 21h18M9 21V7l3-3 3 3v14M9 12h6" />
              </svg>
            )}
          </div>
          <h1 className={styles.title}>
            {isInvited ? "You've Been Invited" : accountOnly ? 'Create your account' : 'Create Your Organization'}
          </h1>
          <p className={styles.sub}>
            {isInvited
              ? 'FieldLogicHQ — accept your invitation'
              : accountOnly
                // Fans are this mode's main audience now (conversion sweep 2026-07-14,
                // Journey B finding 3) — no invitation is implied.
                ? 'FieldLogicHQ — your teams, scores & alerts in one place'
                : 'FieldLogicHQ — run your tournament, league, or club'}
          </p>
        </div>

        {isInvited ? (
          <>
            <div className={styles.invitePanel}>
              <div className={styles.inviteOrg}>
                You&apos;ve been invited to {inviteOrgName ?? 'this organization'}
              </div>
              {roleDisplay && <span className={styles.inviteRole}>{roleDisplay}</span>}
              <p className={styles.inviteBody}>
                You don&apos;t need to create an organization — just accept your invitation to get started.
              </p>
            </div>

            {resendState === 'sent' ? (
              <div className={styles.inviteSent}>
                <MailCheck size={16} strokeWidth={1.8} aria-hidden style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <span>Check your inbox — open the email from FieldLogicHQ and click &ldquo;Accept Invitation&rdquo;.</span>
              </div>
            ) : (
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleResendInvite}
                disabled={resendState === 'sending'}
              >
                {resendState === 'sending' ? 'Sending…' : 'Email me my invitation link'}
              </button>
            )}

            {!showEscape && (
              <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
                <button type="button" className={styles.linkMuted} onClick={() => setShowEscape(true)}>
                  Not you? Create a new organization instead
                </button>
              </div>
            )}

            {showEscape && (
              <div className={styles.confirmBox}>
                <span>
                  This email already has an invitation to {inviteOrgName ?? 'an organization'}. To finish, accept it
                  above. If you&apos;re setting up a different organization, use a different email address.
                </span>
                <div className={styles.confirmActions}>
                  <button type="button" className={styles.btnGhost} onClick={handleUseDifferentEmail}>
                    Use a different email
                  </button>
                </div>
              </div>
            )}

            <div className={styles.footer}>
              <p className={styles.footerText}>
                Already have an account?{' '}
                <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
              </p>
            </div>
          </>
        ) : verificationEmail ? (
          <>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--fl-text)', lineHeight: 1.65, marginBottom: '1rem' }}>
              {accountOnly
                ? 'Your account is almost ready. For security, verify your email to finish.'
                : 'Your organization has been created. For security, verify your email before choosing a plan and opening onboarding.'}
            </p>
            <div className={styles.error} style={{ color: 'var(--logic-lime)', borderColor: 'rgba(163,230,53,0.28)', background: 'rgba(163,230,53,0.08)' }}>
              Verification email sent to {verificationEmail}.
            </div>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.72rem', color: 'var(--data-gray)', lineHeight: 1.6, marginTop: '1rem' }}>
              {accountOnly
                // Neutral for both audiences of account-only signup: fans (the common
                // case) and invited users — /home surfaces any pending invitation.
                ? 'After you confirm, FieldLogicHQ signs you in and takes you to your home screen — any pending invitations will be waiting there.'
                : 'After you confirm, FieldLogicHQ will bring you back to start on the free Tournament plan or choose an upgrade.'}
            </p>
            <div className={styles.footer}>
              <p className={styles.footerText}>
                Already verified?{' '}
                <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
              </p>
            </div>
            {/* Install nudge now comes from the consumer shell layout (auth pages
                live inside it) — no page-level duplicate. */}
          </>
        ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Account-only mode (invited users) creates no org, so there's no org-name
              field. The owner path collects it and creates the org at signup. */}
          {!accountOnly && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-org">Organization Name</label>
                <input
                  id="signup-org"
                  type="text"
                  className="form-input"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Milton Softball Association"
                  required
                  autoComplete="organization"
                />
                <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', marginTop: '0.35rem' }}>
                  Your public address: <span style={{ color: 'var(--logic-lime)' }}>fieldlogichq.ca/{previewSlug}</span> — you can change this later.
                </p>
              </div>

              <div className={styles.divider}>account credentials</div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-first-name">First Name</label>
              <input
                id="signup-first-name"
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
              <label className="form-label" htmlFor="signup-last-name">Last Name</label>
              <input
                id="signup-last-name"
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
            <label className="form-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => { setEmail(e.target.value); if (inviteBranch) setInviteBranch(null); }}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            {inviteBranch === 'account_exists' && (
              <div className={styles.inlineNotice}>
                An account already exists for this email.{' '}
                <Link href="/auth/login" className={styles.footerLink}>Sign in</Link> instead.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <div className={styles.pwWrap}>
              <input
                id="signup-password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button type="button" className={styles.pwToggle} onClick={() => setShowPw(s => !s)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || inviteBranch === 'account_exists'}
            id="signup-submit"
          >
            {loading ? 'Creating…' : accountOnly ? 'Create account' : 'Create Organization'}
          </button>

          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', textAlign: 'center' }}>
            {accountOnly
              ? 'Free to join. No credit card required.'
              : 'Start on the free Tournament plan. No credit card required.'}
          </p>
        </form>
        )}

        {!verificationEmail && !isInvited && (
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Already have an account?{' '}
            <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
          </p>
        </div>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <SignupForm />
    </Suspense>
  );
}
