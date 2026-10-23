import 'server-only';
import { coachListedNotice } from './coach-names-notice';
import type { ListingChange } from './coach-names-policy';
import { notify } from './notify';

/**
 * Tell each coach a club's new choice newly lists (mig 352, A5) — ONE notice per person however many teams, linked to that
 * coach's own Team settings, where their row says "Listed by your club".
 *
 * ⚠ BEST-EFFORT BY DESIGN: the choice has already been saved, and a failed bell must not turn it into an error.
 * ⚠ Never the owner who pressed the button (they chose it). No notice when names are hidden or control is given back:
 * `change.newlyListedUserIds` is empty then, so this sends nothing.
 */
export async function tellCoachesNewlyListed(p: {
  org: { id: string; slug: string; name: string };
  actorUserId: string;
  change: Pick<ListingChange, 'newlyListedUserIds' | 'newlyListedFirstTeam'>;
}): Promise<void> {
  try {
    const { title, body } = coachListedNotice({ clubName: p.org.name });
    for (const userId of p.change.newlyListedUserIds) {
      if (userId === p.actorUserId) continue;
      const teamId = p.change.newlyListedFirstTeam.get(userId);
      if (!teamId) continue;
      await notify({
        orgId: p.org.id,
        eventType: 'club_coach_listed',
        title,
        body,
        userIds: [userId],
        link: `/${p.org.slug}/coaches/teams/${teamId}/settings`,
        metadata: { teamId },
      });
    }
  } catch (e) {
    console.error('[coach-names-notify] notice failed (the choice was saved):', e);
  }
}
