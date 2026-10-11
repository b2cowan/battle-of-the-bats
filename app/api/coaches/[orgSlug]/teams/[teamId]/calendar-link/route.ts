import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { canViewSchedule, denyUnless } from '@/lib/coach-capabilities';
import { getActiveCalendarLinkState, resetCalendarLink, type CalendarLinkState } from '@/lib/coach-membership';
import { calendarLinkSecret, coachFeedUrl, signCoachCalendarToken } from '@/lib/coach-calendar-link';
import { teamCalendarName } from '@/lib/export/team-feed-words';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { tournamentToday } from '@/lib/timezone';

/**
 * THE COACH'S SUBSCRIBE WINDOW (Club Tier Stage 6d, A2 + B1) — the link, rebuilt, and Reset.
 *
 * GET  the coach's OWN link to the team's live-season schedule, rebuilt from their membership every time the window
 *      opens — the same link until Reset (Ask 8: signed, never stored, so a database read alone can't produce it) — and
 *      what the window says about it: the calendar's name (the Outlook door's), whether a calendar has read it, and
 *      whether it carries the tryout days (a coach who runs tryouts).
 * POST Reset: the next generation, the last read cleared; the old link answers an EMPTY calendar from then on.
 *
 * Every coach with schedule access gets their own (Ask 1) — one per coach per team by construction. A link is
 * personal, so there is no "someone else's link" here: the membership is always the caller's own.
 */

const LINKS_UNAVAILABLE = 'Calendar links aren’t available right now. Try again later.';

function windowPayload(
  req: Request,
  link: CalendarLinkState,
  secret: string,
  teamName: string,
  clubName: string,
  includesTryouts: boolean,
) {
  return {
    url: coachFeedUrl(resolveTrustedAppOrigin(req), signCoachCalendarToken(link.membershipId, link.generation, secret)),
    calendarName: teamCalendarName(teamName, clubName),
    // "Read by your calendar today" — the club's clock decides what today is, as it does for the write.
    lastReadOn: link.lastReadOn,
    // The link's generation — Reset names the link it means, so a stale tab can't reset a link it never showed.
    generation: link.generation,
    today: tournamentToday(),
    includesTryouts,
  };
}

/** Both verbs' one preamble: a coach of this team's LIVE season, with schedule access, the signing secret, and their
 *  own active seat — so the gate can't drift between reading the link and resetting it. */
type OwnLink = { link: CalendarLinkState; secret: string; teamName: string; clubName: string; includesTryouts: boolean };
async function resolveOwnLink(params: Promise<{ orgSlug: string; teamId: string }>): Promise<{ error: Response } | OwnLink> {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return { error: resolved.error };
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(canViewSchedule(assignment.capabilities), 'You do not have access to the schedule.');
  if (denied) return { error: denied };
  const secret = calendarLinkSecret();
  if (!secret) return { error: NextResponse.json({ error: LINKS_UNAVAILABLE }, { status: 503 }) };
  const link = await getActiveCalendarLinkState(ctx.org.id, team.id, ctx.user.id);
  if (!link) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { link, secret, teamName: team.name, clubName: ctx.org.name, includesTryouts: assignment.capabilities.tryouts };
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const own = await resolveOwnLink(params);
  if ('error' in own) return own.error;
  return NextResponse.json(windowPayload(req, own.link, own.secret, own.teamName, own.clubName, own.includesTryouts));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/calendar-link' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const own = await resolveOwnLink(params);
  if ('error' in own) return own.error;
  // A double press resets ONCE (the second answers 409 and the window reloads the current link), and a removal landing
  // first leaves nothing to reset.
  // Compare-and-set on the generation the WINDOW showed (not just the one read here): a second tab still showing an
  // older link answers 409 instead of silently retiring the link another device has just subscribed with.
  const body = await req.json().catch(() => ({})) as { generation?: unknown };
  const shown = typeof body.generation === 'number' ? body.generation : own.link.generation;
  const after = shown === own.link.generation ? await resetCalendarLink(own.link.membershipId, shown) : null;
  if (!after) {
    return NextResponse.json({ error: 'Your link changed a moment ago. Close this and open it again.' }, { status: 409 });
  }
  return NextResponse.json(windowPayload(req, after, own.secret, own.teamName, own.clubName, own.includesTryouts));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/calendar-link' });
