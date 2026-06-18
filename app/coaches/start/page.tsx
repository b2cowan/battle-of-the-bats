import { Suspense } from 'react';
import TeamSignupClient from '@/app/team/TeamSignupClient';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { createClient } from '@/lib/supabase-server';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import CoachStartInterest from '@/components/coaches/CoachStartInterest';

export const metadata = {
  title: 'Coaches Portal - FieldLogicHQ',
  description: 'Activate Coaches Portal Premium for one competitive team, with coach-scoped roster, schedule, documents, dues, budget, and lineup tools.',
};

export default async function CoachesPortalStartPage({
  searchParams,
}: {
  searchParams?: Promise<{ basicTeamId?: string }>;
}) {
  const gatingMap = await getPlanGatingMap();

  // GATED (self-serve checkout not open) → a real express-interest capture instead of a disabled
  // checkout dead-end (Phase 5m / J5-051). The single destination all "express interest" labels
  // point to. Prefilled from the session when signed in; works signed-out. Never a purchase.
  if (gatingMap.team) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; first_name?: string; last_name?: string };
    const defaultName = [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() || meta.full_name || '';
    return <CoachStartInterest defaultName={defaultName} defaultEmail={user?.email ?? ''} />;
  }

  // UNGATED (dev / post-launch): the real self-serve checkout. When the coach arrived from an
  // existing free team's "Upgrade to Premium" CTA (?basicTeamId=…), pre-fill the signup from that
  // team so the upgrade reads as confirm-and-pay, not create-from-scratch. Ownership-checked — a
  // coach can only pre-fill from a team they actually own; anything else falls through to a blank
  // form. (Phase 2 will carry this id through checkout to back-link + migrate the team's data.)
  const basicTeamId = (await searchParams)?.basicTeamId?.trim() || null;
  let prefillTeamName: string | null = null;
  let prefillSport: string | null = null;
  let prefillBasicTeamId: string | null = null;
  if (basicTeamId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
      if (team) {
        prefillTeamName = team.name;
        prefillSport = team.sport;
        prefillBasicTeamId = team.id;
      }
    }
  }

  return (
    <Suspense fallback={null}>
      <TeamSignupClient
        teamIsGated={false}
        prefillTeamName={prefillTeamName}
        prefillSport={prefillSport}
        prefillBasicTeamId={prefillBasicTeamId}
      />
    </Suspense>
  );
}
