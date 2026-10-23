import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getCoachingAssignmentsForUser, getOrganizationBySlug } from '@/lib/db';
import { canOpenTournaments, isMoneyRedactedForTeam } from '@/lib/coach-capabilities';
import { registrationBelongsToRepTeam, tournamentEntryNames, tournamentEntryTabTitle } from '@/lib/coach-registration-access';
import { CoachTournamentRecordHeader } from '@/components/coaches/CoachTournamentRecordParts';
import CoachTournamentRecord from '@/components/coaches/CoachTournamentRecord';

type RouteParams = {
  params: Promise<{ orgSlug: string; teamId: string; registrationId: string }>;
};

/** "Invitational 2026 · 15U AAA" (Stage 7d, T1) — behind the page's own gate, else the generic title. */
export async function generateMetadata({ params }: RouteParams) {
  const { orgSlug, teamId, registrationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const org = user ? await getOrganizationBySlug(orgSlug) : null;
  const assignment = org?.id && user ? (await getCoachingAssignmentsForUser(org.id, user.id)).find(a => a.teamId === teamId) : undefined;
  if (!assignment || !canOpenTournaments(assignment.capabilities) || !(await registrationBelongsToRepTeam(registrationId, teamId))) {
    return { title: 'Tournament' };
  }
  return { title: (await tournamentEntryTabTitle(registrationId)) ?? 'Tournament' };
}

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
  // The record follows the Tournaments door (staff access review, 2026-09-10): a coach the door
  // hides for is sent to the list, which says so. And the record follows the LIST (2026-09-13,
  // Part D): the entry must be one this team's list would show — reachable from this rep team by
  // either bridge — so a registration id from some other team the same coach happens to hold
  // cannot render under this team's URL. The shared record then re-checks the user's own right.
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment || !canOpenTournaments(assignment.capabilities) || !(await registrationBelongsToRepTeam(registrationId, teamId))) {
    redirect(`/${orgSlug}/coaches/teams/${teamId}/tournaments`);
  }

  // The shared record re-checks the user's access to the registration and 404s if absent —
  // a paying coach sees the full record (live schedule/scores, status, roster, announcements)
  // in the Premium shell, with the free-tier upsells suppressed and a back link to the list.
  // The page header is drawn HERE, by the page: inside the team layout its "?" is the masthead's (the one
  // help door, Stage 7d T3), and the header guard places a header by the page that renders it.
  const names = await tournamentEntryNames(registrationId);
  const backHref = `/${orgSlug}/coaches/teams/${teamId}/tournaments`;
  return (
    <CoachTournamentRecord
      headerSlot={
        <CoachTournamentRecordHeader
          title={names?.tournamentName ?? names?.teamName ?? 'Tournament'}
          backHref={backHref}
          help={{ module: 'coaches', sectionIds: ['tournaments'], label: 'Tournaments', fullGuideHref: `/${orgSlug}/coaches/help#tournaments` }}
        />
      }
      registrationId={registrationId}
      userId={user.id}
      email={user.email}
      suppressUpsell
      moneyRedacted={moneyRedacted}
      allowAssignmentAccess
      backHref={backHref}
      scheduleHref={`/${orgSlug}/coaches/teams/${teamId}/schedule`}
      helpGuideHref={`/${orgSlug}/coaches/help#tournaments`}
    />
  );
}
