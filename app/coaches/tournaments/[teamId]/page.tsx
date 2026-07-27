import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  canUserAccessTournamentRegistration,
  findLinkedBasicTeamForRegistration,
} from '@/lib/basic-coach-teams';
import { COACHES_TEAM_PATH, COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import CoachTournamentRecord from '@/components/coaches/CoachTournamentRecord';

type RouteParams = {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<{ welcome?: string }>;
};

export async function generateMetadata({ params }: RouteParams) {
  const { teamId } = await params;
  // J5-035: mirror the page's access gate. A pending/rejected team name isn't public, so the
  // title must NOT expose it to a viewer who can't access the registration — fall back to a
  // generic title (the record body itself stays gated by canUserAccessTournamentRegistration).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { title: 'Tournament Record' };

  const access = await canUserAccessTournamentRegistration({
    userId: user.id,
    email: user.email.toLowerCase(),
    registrationId: teamId,
  });
  if (!access) return { title: 'Tournament Record' };

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .maybeSingle();
  return { title: team?.name ?? 'Tournament Record' };
}

export default async function CoachTournamentRecordDetailPage({ params, searchParams }: RouteParams) {
  const { teamId } = await params;
  const { welcome } = (await searchParams) ?? {};

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=${COACHES_TOURNAMENTS_PATH}/${teamId}`);
  }

  // A3.3 (◆G): back returns to the TEAM-SCOPED Tournaments list — the A2 tab's actual
  // destination, mirroring Premium's team-scoped back link. The account-wide hub stays
  // the fallback for a registration-only coach with no linked free team (for whom the
  // hub is the only list that exists).
  const linkedBasicTeamId = await findLinkedBasicTeamForRegistration(user.id, teamId);
  const backHref = linkedBasicTeamId
    ? `${COACHES_TEAM_PATH}/${linkedBasicTeamId}/tournaments`
    : COACHES_TOURNAMENTS_PATH;

  return (
    <CoachTournamentRecord
      registrationId={teamId}
      userId={user.id}
      email={user.email}
      welcome={welcome === '1'}
      backHref={backHref}
      /* A2: the shell's persistent header carries this page's identity + Flip. */
      hideHeader
    />
  );
}
