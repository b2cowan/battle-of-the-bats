import { NextResponse } from 'next/server';
import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canManageSchedule } from '@/lib/coach-capabilities';
import { wallClockStringToUtc } from '@/lib/timezone';
import { checkClubClashes, resolveClubVenueSelection } from '@/lib/venue-clash-lookup';
import { checkClubPermitsQuietly } from '@/lib/permit-lookup';
import type { PermitOutside } from '@/lib/permit-words';
import { repEventBooking, type ClubBooking, type ClashFinding } from '@/lib/venue-clash';

/** The most dates one check reads — a season of weekly practices, with room. */
const MAX_OCCURRENCES = 60;

/**
 * THE COACH'S LIVE CLASH CHECK (Club Tier Stage 6a, Asks 4–5) — the Venue field asks it as soon as the date, the
 * times and one of the club's venues are set, and again on any change (debounced), so the amber line is under the
 * place before Save. Save checks again on the server (the events and tryout writers), with the same lookup.
 *
 * ⚠ A COACH SEES ANOTHER TEAM'S NAME, THE KIND OF EVENT AND ITS TIME — NOTHING ELSE (Ask 5). The findings carry
 * only that (`ClashOther`): no ids, no opponent, no players, no notes.
 *
 * BESIDE THEM, ITS OWN FIELD (Club Tier Stage 10a, Ask 3): `permits`, per date — the date's answer when it falls OUTSIDE
 * a permit the club holds at that venue (null otherwise: inside, or no permit there). It names a facility, days and hours
 * (`PermitOutside`), never a cost, issuer or reference (owner 2026-10-11, plan §6 Ask 1). A failed permit read says
 * nothing, never an error on the form.
 *
 * Read-only. A coach who can schedule (the schedule switch) or run tryouts (a tryout day uses the same field) may
 * ask. A venue that isn't this club's answers nothing — never an error that would confirm it exists.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const assignment = (await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id)).find(a => a.teamId === teamId);
  if (!assignment) return refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId);
  if (!canManageSchedule(assignment.capabilities) && !assignment.capabilities.tryouts) {
    return NextResponse.json({ error: 'You can’t check this schedule.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const occurrences = (Array.isArray(body.occurrences) ? body.occurrences : []).slice(0, MAX_OCCURRENCES) as { startsAt?: unknown; endsAt?: unknown }[];
  const empty = { results: occurrences.map(() => [] as ClashFinding[]), permits: occurrences.map(() => null as PermitOutside | null) };
  if (!occurrences.length) return NextResponse.json(empty);

  const sel = await resolveClubVenueSelection({ org: ctx.org, orgVenueId: body.orgVenueId, orgVenueFacilityId: body.orgVenueFacilityId });
  if (!sel.ok || !sel.value.venue) return NextResponse.json(empty);
  const { venue, facility } = sel.value;

  // The form sends wall clocks in the club's zone ("2026-11-03T18:00"), as every coach write does. Each date is
  // built by the rule's own constructor, so a missing end means the same one booking length here as at save.
  const proposed: (ClubBooking | null)[] = occurrences.map((o, i) => repEventBooking({
    id: `proposed-${i}`, team_id: teamId, event_type: 'practice', status: 'scheduled',
    starts_at: typeof o.startsAt === 'string' ? wallClockStringToUtc(o.startsAt) : null,
    ends_at: typeof o.endsAt === 'string' && o.endsAt ? wallClockStringToUtc(o.endsAt) : null,
    org_venue_id: venue.id, org_venue_facility_id: facility?.id ?? null,
  }, { team: team.name, venue: venue.name, facility: facility?.name ?? null }));
  // The team's own bookings never answer (a team against itself, Ask 3) — the owner rule drops them, so an edit
  // never meets its own stored row.
  const placed = proposed.filter((p): p is ClubBooking => !!p);
  const [found, outside] = await Promise.all([
    checkClubClashes(ctx.org.id, placed),
    checkClubPermitsQuietly(ctx.org.id, placed),
  ]);
  return NextResponse.json({
    results: proposed.map(p => (p ? found.get(p.key) ?? [] : [])),
    permits: proposed.map(p => (p ? outside.get(p.key) ?? null : null)),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/venue-clashes' });
