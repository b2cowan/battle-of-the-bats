import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import CoachTournamentRecord from '@/components/coaches/CoachTournamentRecord';

export const metadata = { title: 'Tournament Record' };

type RouteParams = {
  params: Promise<{ orgSlug: string; teamId: string; registrationId: string }>;
};

export default async function PremiumCoachTournamentRecordPage({ params }: RouteParams) {
  const { orgSlug, teamId, registrationId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect(`/auth/login?next=/${orgSlug}/coaches/teams/${teamId}/tournaments/${registrationId}`);
  }

  // The shared record re-checks the user's access to the registration and 404s if absent —
  // a paying coach sees the full record (live schedule/scores, status, roster, announcements)
  // in the Premium shell, with the free-tier upsells suppressed and a back link to the list.
  return (
    <CoachTournamentRecord
      registrationId={registrationId}
      userId={user.id}
      email={user.email}
      suppressUpsell
      backHref={`/${orgSlug}/coaches/teams/${teamId}/tournaments`}
    />
  );
}
