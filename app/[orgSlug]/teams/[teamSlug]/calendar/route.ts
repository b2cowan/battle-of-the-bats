import { withObservability } from '@/lib/observability';
import { getOrganizationBySlug, getRepTeamBySlug } from '@/lib/db';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { getPublicTeamSchedule } from '@/lib/public-team-schedule';
import { teamCalendarName, teamFeedEntries } from '@/lib/export/team-feed-words';
import { PUBLIC_FEED_CACHE, refusedFeedResponse, calendarResponse } from '@/lib/calendar-feed-response';

/**
 * THE TEAM'S PUBLIC CALENDAR FEED (Club Tier Stage 6d, A3 — Ask 3) — `/{org}/teams/{team}/calendar`, the team page's own
 * address with /calendar on the end. Anyone who can read the page can already read the schedule, so a secret adds
 * nothing: there is nothing to reset, and one address per team means every family's calendar reads the same feed —
 * which is what lets a shared cache serve them all one read (`PUBLIC_FEED_CACHE`, the owner's cost ruling).
 *
 * It asks the page's question (`getPublicTeamSchedule` — Public link, the club open, the family layer, not archived, a
 * live season), so the page, its Subscribe button and this feed can never disagree (S6D-09). A known team that fails it
 * answers an EMPTY calendar under its name, so its families' entries leave (F10); an org or team we don't know is "not
 * found", and only that is counted against the read limit (A4).
 *
 * What it carries is the family list's: the season's events in the family's words (arrival only — no uniform, no coach's
 * notes, no tryout days, no organizer overlay), each linking back to the team page (F7). No session is read and the
 * proxy never runs here (not in its matcher), so a check costs the reads below and nothing else.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamSlug: string }> },) => {
  const { orgSlug, teamSlug } = await params;

  const org = await getOrganizationBySlug(orgSlug);
  const team = org ? await getRepTeamBySlug(org.id, teamSlug) : null;
  if (!org || !team) return refusedFeedResponse(req);

  const calendarName = teamCalendarName(team.name, org.name);
  const view = await getPublicTeamSchedule({ org, team });
  if (!view) return calendarResponse({ calendarName, entries: [], cacheControl: PUBLIC_FEED_CACHE });

  const page = `${resolveSameHostOrigin(req).replace(/\/$/, '')}/${orgSlug}/teams/${teamSlug}`;
  return calendarResponse({
    calendarName,
    entries: teamFeedEntries({
      teamName: view.teamName,
      sport: view.sport,
      reader: 'family',
      events: view.entries,
      linkFor: () => page,
    }),
    cacheControl: PUBLIC_FEED_CACHE,
  });
}, { route: '/[orgSlug]/teams/[teamSlug]/calendar' });
