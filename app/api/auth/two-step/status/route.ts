import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { twoStepRequirementsFor } from '@/lib/two-step-requirements';
import { backupCodesLeft } from '@/lib/two-step-codes';
import { isReplacingAuthenticator } from '@/lib/two-step-session';

/**
 * Where this session stands on two-step sign-in (Board Ready · two-step sign-in, Part 1): the sign-in page's code step,
 * the set-up step, and Part 2's account page read it. It reads the session BEFORE the code is typed (that is the point:
 * the code step asks it "who is signing in"), so it says only what the person signing in may know about themselves.
 */
export const GET = withObservability(async () => {
  const state = await getSessionTwoStep();
  if (!state) return NextResponse.json({ signedIn: false });

  const base = {
    signedIn: true,
    email: state.user.email ?? null,
    hasFactor: state.hasFactor,
    /** This session has typed the code (or a backup code let it through). */
    passed: state.passed,
    /** A shared demo account can never set it up (tab 9). */
    isDemo: isDemoOrganizerEmail(state.user.email),
  };
  // Before the code is typed, nothing about seats or codes: a stolen password learns only "a code is asked".
  if (!state.passed) return NextResponse.json(base);

  const [requirements, left] = await Promise.all([
    twoStepRequirementsFor(state.user),
    state.hasFactor ? backupCodesLeft(state.user.id) : Promise.resolve(0),
  ]);
  return NextResponse.json({
    ...base,
    viaBackupCode: state.viaBackupCode,
    /** Replacing a lost phone: the old authenticator is gone and the new one not finished. */
    replacing: isReplacingAuthenticator(state.user),
    backupCodesLeft: left,
    requiredNow: requirements.requiredNow,
    requiredBy: requirements.reasons.map(r => r.kind === 'staff'
      ? { kind: 'staff' }
      : {
        kind: 'club',
        orgName: r.orgName,
        role: r.role,
        state: r.requirement.kind,
        until: r.requirement.kind === 'grace' ? r.requirement.until.toISOString() : null,
      }),
  });
}, { route: '/api/auth/two-step/status' });
