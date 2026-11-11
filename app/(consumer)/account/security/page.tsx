import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionTwoStep } from '@/lib/api-auth';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { twoStepRequirementsFor, type TwoStepReason } from '@/lib/two-step-requirements';
import { backupCodesLeft } from '@/lib/two-step-codes';
import { isReplacingAuthenticator } from '@/lib/two-step-session';
import { formatStoredDate } from '@/lib/timezone';
import { roleLabel } from '@/lib/member-access';
import SecurityClient, { type SecurityView } from './SecurityClient';
import accountStyles from '../account.module.css';

// The signed-in person's own facts, never static, never indexed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign-in & security',
  robots: { index: false, follow: false },
};

/** "Required for your role as Treasurer at Milton Minor Ball" — the first reason that covers the person (tab 5). */
function reasonSentence(reasons: TwoStepReason[]): string | null {
  const staff = reasons.find(r => r.kind === 'staff');
  if (staff) return 'Required for FieldLogicHQ staff';
  const club = reasons.find(r => r.kind === 'club');
  if (club && club.kind === 'club') return `Required for your role as ${roleLabel(club.role)} at ${club.orgName}`;
  return null;
}

/**
 * ACCOUNT › SIGN-IN & SECURITY (Board Ready · two-step sign-in, Part 2; drawings tab 5). One page for every portal: the
 * Account page every account menu already opens gains this section (a rail row on desktop, a row on the phone list that
 * opens this page). Platform staff reach it from their own menu's new row.
 *
 * The two-step card, in the four drawn states — on and required (no Turn off, the reason), on and not required (Turn
 * off), off and offered, off and required inside the 14 days (the club's deadline) — then "Signed in on other devices"
 * (one button, no device list, ask 5) and Password (ask 7). Every action that asks for a code is answered by the one
 * window (components/shared/CodeAgainProvider.tsx).
 */
export default async function AccountSecurityPage() {
  const state = await getSessionTwoStep();

  if (!state?.passed) {
    return (
      <div className={accountStyles.sectionPane}>
        <h2 className={accountStyles.paneHeading}>Sign-in &amp; security</h2>
        <div className={accountStyles.ctaStack}>
          <Link href="/auth/login?next=%2Faccount%2Fsecurity" className={accountStyles.ctaPrimary}>Sign in</Link>
        </div>
      </div>
    );
  }

  const { user } = state;
  const isDemo = isDemoOrganizerEmail(user.email);
  const [requirements, left] = await Promise.all([
    twoStepRequirementsFor(user),
    state.hasFactor ? backupCodesLeft(user.id).catch(() => 0) : Promise.resolve(0),
  ]);

  const verified = (user.factors ?? []).filter(f => f.status === 'verified');
  const onSince = verified.length > 0
    ? verified.map(f => f.created_at).sort()[0] ?? null
    : null;
  const grace = requirements.reasons.find(r => r.kind === 'club' && r.requirement.kind === 'grace');

  const view: SecurityView = {
    on: state.hasFactor,
    replacing: isReplacingAuthenticator(user),
    onSince: onSince ? formatStoredDate(onSince, { withYear: true }) : null,
    covered: requirements.reasons.length > 0,
    reason: reasonSentence(requirements.reasons),
    graceNotice: !state.hasFactor && grace && grace.kind === 'club' && grace.requirement.kind === 'grace'
      ? {
        lead: `${grace.orgName} requires two-step sign-in for your role as ${roleLabel(grace.role)}.`,
        by: formatStoredDate(grace.requirement.until.toISOString(), { withYear: false }),
      }
      : null,
    requiredNow: requirements.requiredNow,
    backupCodesLeft: left,
    isDemo,
    hasPassword: Boolean(user.email),
  };

  return (
    <div className={accountStyles.sectionPane}>
      <h2 className={accountStyles.paneHeading}>Sign-in &amp; security</h2>
      <SecurityClient view={view} />
    </div>
  );
}
