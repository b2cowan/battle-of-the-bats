import 'server-only';
import { getRepTeam } from './db';
import { listActiveStaffUserIds } from './coach-membership';
import { STAFF_KIND_COPY, type StaffKind } from './coach-capabilities';
import { notify } from './notify';
import { supabaseAdmin } from './supabase-admin';

/**
 * WHO IS TOLD WHEN A COACH INVITATION IS ANSWERED — one place for both doors an invitee answers
 * from: the emailed link's accept page and (Club Tier Stage 2, specimen 6 · 2b) the home page's
 * invitation card. Moved here from the accept route so the two cannot tell different people.
 *
 *   accepted, an ASSISTANT seat — the team's head coach(es), from team MEMBERSHIP (a season-row
 *            read told nobody between seasons);
 *   accepted, a seat the CLUB offered — the person at the club who sent it, in the club's words;
 *   declined (the club's invitations only — the home card is their door) — that same person, so the
 *            team's red "No head coach" row is never a mystery.
 * ⚠ BEST-EFFORT: the answer has already landed; a failed bell never turns it into an error.
 */
export async function tellInviteAccepted(result: {
  orgSlug: string;
  teamId: string;
  staffKind: StaffKind | null;
  coachRole: 'head_coach' | 'assistant_coach';
  sentBy: 'portal' | 'club';
  invitedByUserId: string;
}, user: { id: string; email?: string | null }): Promise<void> {
  try {
    const team = await getRepTeam(result.teamId);
    if (!team) return;
    const who = user.email ?? 'Someone';
    if (result.coachRole === 'assistant_coach') {
      const headUserIds = await listActiveStaffUserIds(result.teamId, { headCoachesOnly: true });
      if (headUserIds.length > 0) {
        const copy = STAFF_KIND_COPY[result.staffKind ?? 'assistant'];
        await notify({
          orgId: team.orgId,
          eventType: 'assistant_coach_joined',
          title: `${copy.name} joined`,
          body: result.sentBy === 'club'
            ? `${who} accepted the club’s invite and joined as ${copy.asA}.`
            : `${who} accepted your invite and joined as ${copy.asA}.`,
          userIds: headUserIds,
          excludeUserIds: [user.id],
          link: `/${result.orgSlug}/coaches/teams/${result.teamId}/settings`,
        });
      }
    }
    if (result.sentBy === 'club') {
      const seat = result.coachRole === 'head_coach' ? 'head coach' : 'an assistant coach';
      await notify({
        orgId: team.orgId,
        eventType: 'club_coach_joined',
        title: result.coachRole === 'head_coach' ? `${team.name} has its head coach` : `A coach joined ${team.name}`,
        body: `${who} accepted your invitation and joined ${team.name} as ${seat}.`,
        userIds: [result.invitedByUserId],
        excludeUserIds: [user.id],
        link: `/${result.orgSlug}/admin/rep-teams/teams/${result.teamId}`,
      });
    }
  } catch { /* notification is best-effort */ }
}

export async function tellClubInviteDeclined(declined: {
  orgId: string;
  teamId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  invitedByUserId: string;
  teamName: string | null;
}, user: { id: string; email?: string | null }): Promise<void> {
  try {
    const team = await getRepTeam(declined.teamId);
    const teamName = team?.name ?? declined.teamName ?? 'the team';
    const seat = declined.coachRole === 'head_coach' ? 'head coach' : 'an assistant coach';
    const { data: org } = await supabaseAdmin
      .from('organizations').select('slug').eq('id', declined.orgId).maybeSingle<{ slug: string }>();
    await notify({
      orgId: declined.orgId,
      eventType: 'club_coach_declined',
      title: `${user.email ?? 'A coach'} declined your invitation`,
      body: declined.coachRole === 'head_coach'
        ? `They won’t be ${teamName}’s head coach. Its row on Rep Teams stays red until someone accepts.`
        : `They won’t be ${seat} for ${teamName}.`,
      userIds: [declined.invitedByUserId],
      excludeUserIds: [user.id],
      link: org?.slug ? `/${org.slug}/admin/rep-teams/teams/${declined.teamId}/coaches` : undefined,
    });
  } catch { /* notification is best-effort */ }
}
