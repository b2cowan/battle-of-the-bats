import { withObservability } from '@/lib/observability';
import { isPlausibleNoLoginToken } from '@/lib/no-login-token';
import {
  getEnabledFamilyOrg,
  getTeamFamilyAccess,
  resolveLinkByCalendarToken,
} from '@/lib/family-access';
import { getFamilyTeamView } from '@/lib/family-view';
import { teamCalendarName, teamFeedEntries } from '@/lib/export/team-feed-words';
import { PRIVATE_FEED_CACHE, refusedFeedResponse, calendarResponse } from '@/lib/calendar-feed-response';

/**
 * A CONNECTED FAMILY'S CALENDAR FEED — one per family, minted from the family view, valid while their link is verified.
 *
 * Visibility is re-checked on every read: a team closed to `staff`, a club that cancels or a team that loses its
 * premium entitlement stops serving the feed immediately. Calendar apps poll on their own schedule, so this is the one
 * rail where re-checking per request genuinely matters.
 *
 * ⚠ CLUB TIER STAGE 6d (2026-10-11) — THE FEED'S WORDS, AND WHAT A STOPPED FEED SAYS:
 *   · its entries are the family reader's from the feed recipe (`teamFeedEntries`, F1–F10): the team leads the title,
 *     "@" away, a CANCELLED event is KEPT and marked (it used to be dropped — a called-off game looked like an empty
 *     evening), "Arrive by 5:30 p.m. (Eastern time)" (it wrote the stored "17:30"), an outside tournament all day;
 *   · a family whose link still resolves but whose team stopped serving them answers an EMPTY calendar under the
 *     team's name, so the old events leave instead of freezing in their calendar (S6D-04);
 *   · the TEAM-WIDE token branch is gone — the token was never handed out (it rotated on every mint, S6D-02); the team's
 *     public feed now lives at the team page's own address (`/{org}/teams/{team}/calendar`);
 *   · the read limit counts only REFUSED reads (an unknown token), never a good one (A4 — the same change as the new
 *     feeds, and trivially safe here: the token lookup still runs on every read, the counter simply stops writing a row
 *     for each of them and stops sharing one budget across every family behind a calendar company's server).
 * ⚠ What 6d does NOT touch: the family's door and its mint (`app/api/family/teams/[teamId]`), which still makes a new
 * link on every press and stops the old (S6D-02, found and not fixed) — that door waits for counsel and is rebuilt to the
 * hub's drawing then. A revoked family's token is nulled, so it reads as never issued: "not found", as before.
 *
 * No identity appears in the feed: team-level events only, no player names, no roster, no coach's notes.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;

  const link = isPlausibleNoLoginToken(token) ? await resolveLinkByCalendarToken(token) : null;
  if (!link) return refusedFeedResponse(req);

  const org = await getEnabledFamilyOrg(link.orgId, link.repTeamId);
  const view = org ? await getFamilyTeamView({ repTeamId: link.repTeamId, requireVisibility: 'families' }) : null;
  if (!view) {
    // Stopped: the team's name is read only here — a good read names the calendar from its view.
    const team = await getTeamFamilyAccess(link.repTeamId);
    const calendarName = teamCalendarName(team?.teamName ?? 'Team schedule', org?.name);
    return calendarResponse({ calendarName, entries: [], cacheControl: PRIVATE_FEED_CACHE });
  }

  return calendarResponse({
    calendarName: teamCalendarName(view.teamName, view.orgName),
    entries: teamFeedEntries({ teamName: view.teamName, sport: view.sport, reader: 'family', events: view.entries }),
    cacheControl: PRIVATE_FEED_CACHE,
  });
}, { route: '/api/family/calendar/[token]' });
