import { Suspense } from 'react';
import TeamSignupClient from '@/app/team/TeamSignupClient';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { getAuthUserCached } from '@/lib/supabase-server';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { foundingSeasonOfferFor } from '@/lib/founding-season';
import { readStartDoor } from '@/lib/start-door';
import CoachStartInterest from '@/components/coaches/CoachStartInterest';

export const metadata = {
  title: 'Coaches Portal - FieldLogicHQ',
  description: 'Activate Premium Coaches Portal for one competitive team, with coach-scoped roster, schedule, documents, dues, budget, and lineup tools.',
};

export default async function CoachesPortalStartPage({
  searchParams,
}: {
  searchParams?: Promise<{ basicTeamId?: string; confirmed?: string }>;
}) {
  const sp = await searchParams;
  const gatingMap = await getPlanGatingMap();

  // GATED (self-serve checkout not open) → a real express-interest capture instead of a disabled
  // checkout dead-end (Phase 5m / J5-051). The single destination all "express interest" labels
  // point to. Prefilled from the session when signed in; works signed-out. Never a purchase.
  if (gatingMap.team) {
    const user = await getAuthUserCached();
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; first_name?: string; last_name?: string };
    const defaultName = [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() || meta.full_name || '';
    return <CoachStartInterest defaultName={defaultName} defaultEmail={user?.email ?? ''} />;
  }

  // UNGATED (dev / post-launch): the real self-serve checkout. When the coach arrived from an
  // existing free team's "Upgrade to Premium" CTA (?basicTeamId=…), pre-fill the signup from that
  // team so the upgrade reads as confirm-and-pay, not create-from-scratch. Ownership-checked — a
  // coach can only pre-fill from a team they actually own; anything else falls through to a blank
  // form. (Phase 2 will carry this id through checkout to back-link + migrate the team's data.)
  const basicTeamId = sp?.basicTeamId?.trim() || null;
  const user = await getAuthUserCached();
  let prefillTeamName: string | null = null;
  let prefillSport: string | null = null;
  let prefillBasicTeamId: string | null = null;
  if (basicTeamId && user) {
    const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
    if (team) {
      prefillTeamName = team.name;
      prefillSport = team.sport;
      prefillBasicTeamId = team.id;
    }
  }

  // Account-first (Part 3): the offer is the server's answer, the same rule the checkout applies (edge (b), 2026-10-19);
  // the billing picked on the pricing page rides on the account across the email (screens only).
  return (
    <Suspense fallback={null}>
      <TeamSignupClient
        teamIsGated={false}
        prefillTeamName={prefillTeamName}
        prefillSport={prefillSport}
        prefillBasicTeamId={prefillBasicTeamId}
        confirmed={sp?.confirmed === '1'}
        foundingOffer={foundingSeasonOfferFor(user, 'premium')}
        rememberedBilling={readStartDoor(user?.user_metadata)?.billing ?? null}
        signedInEmail={user?.email ?? null}
      />
    </Suspense>
  );
}
