import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getAuthUserCached } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getAuthDestination } from '@/lib/auth-destination';
import { userBelongsToOtherRealOrg } from '@/lib/org-membership-policy';
import { parseStartPricing, readStartDoor } from '@/lib/start-door';
import { startStepViewer } from '@/lib/start-door-server';
import StartTournamentForm from './StartTournamentForm';

export const metadata: Metadata = {
  title: 'Run a tournament — FieldLogicHQ',
};

type Param = string | string[] | undefined;
const first = (value: Param) => (Array.isArray(value) ? value[0] : value);

/**
 * /start/tournament — the organizer on-ramp.
 *  - Signed OUT → step 1, the account alone, here at once (The first look, Ask 6, 2026-10-19: the one-screen intro
 *    folded into it, and /auth/signup forwards here with the pricing page's plan).
 *  - Signed IN with NO org yet → step 2: name the organization (the email link lands here, and so does Home's waiting
 *    workspace). One tap makes it, then the plan step opens.
 *  - Signed IN who ALREADY has an org → redirect home. Identity model is "single-org by default"
 *    (decision 2026-06-19): a second organization is reached only by a deliberate invite or a
 *    Coaches Portal purchase — never by self-serve spinning up another empty workspace here.
 */
export default async function StartTournamentPage({ searchParams }: {
  searchParams: Promise<{ confirmed?: Param; plan?: Param; billing?: Param }>;
}) {
  const sp = await searchParams;
  const user = await getAuthUserCached();

  // Signed out: step 1, the account form at once (The first look, Ask 6, 2026-10-19 — the intro page folded in), with
  // the plan picked on the pricing page riding on it (A6). /auth/signup forwards here with that plan.
  if (!user?.email) {
    return <StartTournamentForm viewer={null} pricing={parseStartPricing(first(sp.plan), first(sp.billing))} />;
  }
  // The three gates are independent reads: one round trip, then the redirects in their order.
  const [isStaff, inRealOrg, { count: pendingInvites }] = await Promise.all([
    isPlatformAdminEmail(user.email),
    userBelongsToOtherRealOrg(user.id),
    supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'invited'),
  ]);
  if (isStaff) {
    redirect('/platform-admin');
  }

  // Single-org by default: an existing member of a REAL org can't self-serve a second empty org.
  // A user's own Coaches Portal doesn't count (exemption-aware helper), so a portal-owning coach can
  // still create their first real org. Only a brand-new account (or portal-only coach) reaches the form.
  if (inRealOrg) {
    // Drop them into their existing workspace — getAuthDestination carries the
    // single-context fast-path the retired /home launchpad used to provide.
    redirect(await getAuthDestination());
  }

  // A pending invite means they already have somewhere to go — send them to Home's
  // pending-invite card instead of creating a stray org (Sign-up Invite Guard, Phase 3).
  if ((pendingInvites ?? 0) > 0) {
    redirect('/discover');
  }

  // The plan picked on the pricing page (A6): carried through sign-in by an account that already existed, else
  // remembered on the account at sign-up. The newer choice — the one in the address — wins (/review). A preselection
  // on the plan step, never a price.
  const pricing = parseStartPricing(first(sp.plan), first(sp.billing)) ?? readStartDoor(user.user_metadata)?.pricing ?? null;

  return (
    <StartTournamentForm
      viewer={await startStepViewer(user)}
      confirmed={first(sp.confirmed) === '1'}
      pricing={pricing}
    />
  );
}
