import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { houseLeagueCoachAccess } from '@/lib/house-league-access';
import { readCoachFeedTeam } from '@/lib/house-league-coach';
import {
  getOwnLeagueCoachLink, resetLeagueCoachLink, LEAGUE_COACH_DOMAIN, type LeagueCoachLink,
} from '@/lib/league-coach-calendar';
import { calendarLinkSecret, coachFeedUrl, signCoachCalendarToken } from '@/lib/coach-calendar-link';
import { teamCalendarName } from '@/lib/export/team-feed-words';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { tournamentToday } from '@/lib/timezone';

/**
 * A HOUSE-LEAGUE COACH'S SUBSCRIBE WINDOW (House League 9d-3 Part 6, 9d3·5) — the rep coach's `…/calendar-link` route for
 * the coach's team page: GET the coach's OWN link, rebuilt from their row every time the window opens (the same link
 * until Reset), and what the window says about it; POST Reset (the next generation; the old link answers an empty
 * calendar from then on). Only the signed-in coach of this team's LIVE season (`houseLeagueCoachAccess` = open), only
 * their own seat: there is no "someone else's link" here.
 */

const LINKS_UNAVAILABLE = 'Calendar links aren’t available right now. Try again later.';
const NOT_FOUND = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

type Params = Promise<{ orgSlug: string; seasonSlug: string; teamId: string }>;
type OwnLink = { link: LeagueCoachLink; secret: string; teamName: string; clubName: string };

function windowPayload(req: Request, own: OwnLink) {
  return {
    url: coachFeedUrl(resolveTrustedAppOrigin(req), signCoachCalendarToken(own.link.id, own.link.generation, own.secret, LEAGUE_COACH_DOMAIN), LEAGUE_COACH_DOMAIN),
    calendarName: teamCalendarName(own.teamName, own.clubName),
    lastReadOn: own.link.lastReadOn,
    generation: own.link.generation,
    today: tournamentToday(),
  };
}

/** Both verbs' one preamble, so the gate can't drift between reading the link and resetting it. */
async function resolveOwnLink(params: Params): Promise<{ error: Response } | OwnLink> {
  const { orgSlug, seasonSlug, teamId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) return { error: NOT_FOUND() };
  const user = await getAuthenticatedUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in to see your calendar link.' }, { status: 401 }) };
  const [link, team] = await Promise.all([getOwnLeagueCoachLink(user.id, teamId), readCoachFeedTeam(teamId)]);
  if (!link || !team || team.card.orgSlug !== orgSlug || team.card.seasonSlug !== seasonSlug) return { error: NOT_FOUND() };
  if (houseLeagueCoachAccess([link], user.id, teamId, team.season) !== 'open') return { error: NOT_FOUND() };
  const secret = calendarLinkSecret();
  if (!secret) return { error: NextResponse.json({ error: LINKS_UNAVAILABLE }, { status: 503 }) };
  return { link, secret, teamName: team.card.teamName, clubName: team.card.orgName };
}

export const GET = withObservability(async (req: Request, { params }: { params: Params }) => {
  const own = await resolveOwnLink(params);
  if ('error' in own) return own.error;
  return NextResponse.json(windowPayload(req, own));
}, { route: '/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/calendar-link' });

export const POST = withObservability(async (req: Request, { params }: { params: Params }) => {
  // Every POST under the public league API is throttled first (public-form guard); a Reset is cheap to cap.
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  const own = await resolveOwnLink(params);
  if ('error' in own) return own.error;
  // Compare-and-set on the generation the WINDOW showed: a double press or a stale tab answers 409, never a second reset.
  const body = await req.json().catch(() => ({})) as { generation?: unknown };
  // No generation sent means no window showed one: that is a 409 too, never a Reset on the current value.
  const shown = typeof body.generation === 'number' ? body.generation : null;
  const after = shown !== null && shown === own.link.generation ? await resetLeagueCoachLink(own.link.id, shown) : null;
  if (!after) {
    return NextResponse.json({ error: 'Your link changed a moment ago. Close this and open it again.' }, { status: 409 });
  }
  return NextResponse.json(windowPayload(req, { ...own, link: after }));
}, { route: '/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/calendar-link' });
