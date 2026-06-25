import { resolveCoachTeamPage } from '@/lib/coach-team-page';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import CoachExploreCatalog from '@/components/coaches/CoachExploreCatalog';
import TeamSectionShell from '@/components/coaches/TeamSectionShell';

type RouteParams = { params: Promise<{ basicTeamId: string }> };

export async function generateMetadata({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || (user.email && (await isPlatformAdminEmail(user.email)))) return { title: 'Explore' };
  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  return { title: team ? `${team.name} — Explore` : 'Explore' };
}

export default async function CoachTeamExplorePage({ params }: RouteParams) {
  const { basicTeamId } = await params;
  const { team } = await resolveCoachTeamPage(basicTeamId, '/explore');
  // Same server-side checkout gate the rest of the portal uses (see ScopeShelf): open in dev
  // (team plan ungated) → the real self-serve upgrade; gated in prod → the info explainer.
  const checkoutOpen = !(await getPlanGatingMap()).team;

  return (
    <TeamSectionShell teamName={team.name} title="Explore">
      <CoachExploreCatalog
        basicTeamId={basicTeamId}
        activatedFeatures={team.activatedFeatures}
        checkoutOpen={checkoutOpen}
      />
    </TeamSectionShell>
  );
}
