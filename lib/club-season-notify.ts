import 'server-only';
import { listActiveStaffUserIds } from './coach-membership';
import { clubSeasonNotice, type ClubSeasonAction, type ClubSeasonCarried } from './club-season-notice';
import { notify } from './notify';

/**
 * Tell a club team's staff that the club changed its season (Club Tier Stage 2, specimen 4) — the
 * one sender behind every club season door: start next season, close, reopen, and the first season.
 * The words are `clubSeasonNotice`'s (pure, unit-tested); this only sends them.
 *
 * ⚠ The team's ACTIVE staff (memberships), never the person who pressed the button.
 * ⚠ BEST-EFFORT BY DESIGN: the season change has already landed, and a failed bell must not turn it
 * into an error.
 */
export async function tellClubTeamStaff(p: {
  org: { id: string; slug: string; name: string };
  team: { id: string; name: string };
  actorUserId: string;
  action: ClubSeasonAction;
  seasonName: string;
  previousSeasonName?: string | null;
  carried?: ClubSeasonCarried | null;
}): Promise<void> {
  try {
    const userIds = await listActiveStaffUserIds(p.team.id);
    if (userIds.length === 0) return;
    const { title, body } = clubSeasonNotice({
      clubName: p.org.name, teamName: p.team.name, action: p.action, seasonName: p.seasonName,
      previousSeasonName: p.previousSeasonName, carried: p.carried,
    });
    const base = `/${p.org.slug}/coaches/teams/${p.team.id}`;
    await notify({
      orgId: p.org.id,
      eventType: 'club_season_changed',
      title,
      body,
      userIds,
      excludeUserIds: [p.actorUserId],
      link: p.action === 'closed' ? `${base}/season-end` : base,
      metadata: { teamId: p.team.id, action: p.action },
    });
  } catch (e) {
    console.error('[club-season-notify] staff notice failed (the season change landed):', e);
  }
}
