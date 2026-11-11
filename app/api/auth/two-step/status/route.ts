import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { twoStepRequirementsFor } from '@/lib/two-step-requirements';
import { backupCodesLeft } from '@/lib/two-step-codes';
import { isReplacingAuthenticator } from '@/lib/two-step-session';
import { filterWorkspaceContexts, getUserAccessContexts } from '@/lib/user-contexts';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * "Go to my other teams instead" (Part 3, tab 8): only for a person with somewhere to go that no club is holding back —
 * a workspace outside the clubs that require it now, or the family app.
 */
async function hasPlaceOutside(user: { id: string; email?: string | null }, heldSlugs: Set<string>): Promise<boolean> {
  if (heldSlugs.size === 0) return false;
  try {
    const contexts = filterWorkspaceContexts(await getUserAccessContexts({ id: user.id, email: user.email ?? '' }));
    if (contexts.some(c => !c.orgSlug || !heldSlugs.has(c.orgSlug))) return true;
    const { count } = await supabaseAdmin.from('family_links').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'verified');
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

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
  const held = new Set(requirements.reasons.flatMap(r => (r.kind === 'club' && r.requirement.kind === 'required' ? [r.orgSlug] : [])));
  return NextResponse.json({
    ...base,
    /** A place to go that no club is holding back (only asked when a club holds one). */
    elsewhere: state.hasFactor ? false : await hasPlaceOutside(state.user, held),
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
