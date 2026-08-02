import { withObservability } from '@/lib/observability';
import {
  checkNoLoginRateLimit,
  isPlausibleNoLoginToken,
  tooManyRequests,
} from '@/lib/no-login-token';
import {
  getEnabledFamilyOrg,
  resolveLinkByCalendarToken,
  resolveTeamByCalendarToken,
} from '@/lib/family-access';
import { getFamilyTeamView } from '@/lib/family-view';
import { composeICSFromInstants } from '@/lib/export/ics';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';

/**
 * The calendar subscription feed — probably the highest day-to-day value per unit of work
 * in this slice ("the calendar is just right, always").
 *
 * ONE route, TWO token kinds, because they are the same product idea at two visibility
 * levels and splitting them would let the two drift on what a feed contains:
 *   • a per-FAMILY token, minted from the family view, valid while their link is verified;
 *   • a team-wide token, handed out only at `public_link`.
 *
 * Visibility is re-checked on every read. A team that drops from `public_link` to
 * `families` stops serving its team-wide feed immediately, and a team closed to `staff`
 * serves neither — the subscription goes quiet rather than continuing to leak a schedule
 * the coach has since closed. Calendar apps poll on their own schedule, so this is the one
 * rail where re-checking per request genuinely matters.
 *
 * No identity appears in the feed: team-level events only, no player names, no roster.
 */

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;

  const verdict = await checkNoLoginRateLimit('family_calendar', req);
  if (!verdict.allowed) return tooManyRequests(verdict);

  if (!isPlausibleNoLoginToken(token)) return notFound();

  // Family token first (the common case), then the team-wide one.
  const link = await resolveLinkByCalendarToken(token);
  const team = link ? null : await resolveTeamByCalendarToken(token);
  if (!link && !team) return notFound();

  const repTeamId = link ? link.repTeamId : team!.repTeamId;
  const orgId = link ? link.orgId : team!.orgId;

  if (!(await getEnabledFamilyOrg(orgId, repTeamId))) return notFound();

  const view = await getFamilyTeamView({
    repTeamId,
    // A family token passes at `families`; a team-wide token requires `public_link`.
    requireVisibility: link ? 'families' : 'public_link',
  });
  if (!view) return notFound();

  const origin = resolveTrustedAppOrigin(req);
  const ics = await composeICSFromInstants(
    view.entries
      .filter(e => e.status !== 'cancelled')
      .map(e => ({
        uid: e.id,
        title: e.eventType === 'practice'
          ? `${view.teamName} — Practice`
          : `${view.teamName}${e.opponent ? ` vs ${e.opponent}` : ''}`,
        startsAtIso: e.startsAt,
        // The coach's own end time when they entered one; these defaults only fill the gap.
        endsAtIso: e.endsAt,
        durationHours: e.eventType === 'practice' ? 1.5 : 2,
        location: [e.location, e.fieldNumber, e.locationAddress].filter(Boolean).join(', ') || undefined,
        description: e.arrivalTime ? `Arrive by ${e.arrivalTime}` : undefined,
        // Only link out to a page that actually exists for this reader.
        url: e.shared ? `${origin}/${view.orgSlug}/teams/${view.teamSlug}/games/${e.id}` : undefined,
      })),
    `${view.teamName} schedule`,
  );
  if (!ics) return new Response('Could not build calendar', { status: 500 });

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="schedule.ics"',
      // Short cache: a calendar app polls anyway, and a moved game should reach a
      // family's phone in minutes rather than whenever a CDN felt like expiring.
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}, { route: '/api/family/calendar/[token]' });
