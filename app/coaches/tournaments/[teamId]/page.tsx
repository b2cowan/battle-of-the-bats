import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canUserAccessTournamentRegistration } from '@/lib/basic-coach-teams';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
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

  return (
    <CoachTournamentRecord
      registrationId={teamId}
      userId={user.id}
      email={user.email}
      welcome={welcome === '1'}
    />
  );
}
