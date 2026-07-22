import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getCoachingAssignmentsForUser, getOrganizationBySlug } from '@/lib/db';
import { isMoneyRedactedForTeam } from '@/lib/coach-capabilities';
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

  // WI-5 (security): assistant coaches whose team-money capability is 'off' must see no fee data
  // anywhere in the record. Resolve the caller's capability on THIS rep team from the same
  // assignment resolver that keys the whole portal, and FAIL CLOSED — if no assignment resolves
  // (suspended entitlement, etc.), redact rather than leak. Head coaches + money='read' assistants
  // resolve `canViewMoney === true`, so their record is byte-identical to today.
  const org = await getOrganizationBySlug(orgSlug);
  const assignments = org?.id
    ? await getCoachingAssignmentsForUser(org.id, user.id)
    : [];
  const moneyRedacted = isMoneyRedactedForTeam(assignments, teamId);

  // The shared record re-checks the user's access to the registration and 404s if absent —
  // a paying coach sees the full record (live schedule/scores, status, roster, announcements)
  // in the Premium shell, with the free-tier upsells suppressed and a back link to the list.
  return (
    <CoachTournamentRecord
      registrationId={registrationId}
      userId={user.id}
      email={user.email}
      suppressUpsell
      moneyRedacted={moneyRedacted}
      backHref={`/${orgSlug}/coaches/teams/${teamId}/tournaments`}
    />
  );
}
