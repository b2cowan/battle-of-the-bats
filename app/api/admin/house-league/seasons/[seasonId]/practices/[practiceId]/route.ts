import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, cancelPractice, updatePractices } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant } from '@/lib/league-venue';
import { utcToZonedInputs, zonedWallClockToUtc } from '@/lib/timezone';
import { SCHEDULE_WORDS } from '@/lib/club-schedule-words';
import { PRACTICE_WINDOW_WORDS } from '@/lib/league-practice-time';

/**
 * ONE PRACTICE: cancel it (`{ action: 'cancel', scope: one | remaining | all }`), or move a hand-booked one
 * (`{ action: 'edit', scope: one | rest, scheduledDate?, startTime, endTime, orgVenueId?, orgVenueFacilityId?, location?,
 * notes? }` — Club Tier Stage 11b Part 4, h2's pencil; "rest" keeps each date and moves this one and the ones after it in
 * its series). ⚖ A practice handed out from the club's time is refused both (9d2·5): only the club's schedule moves or
 * cancels it, and the window offers neither.
 */
export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ seasonId: string; practiceId: string }> },) => {
  const { seasonId, practiceId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!; // a signed-out ctx is always refused

  // Ownership: the practice must live in THIS org's season. This route used to trust the
  // raw id — and scope 'all' cancels an entire recurring series, which makes a guessed
  // foreign UUID a destructive cross-org write. Same rails as the sibling routes now.
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const { data: practice } = await supabaseAdmin
    .from('league_practices')
    .select('id, team_id, status, scheduled_at, recurrence_group_id, club_schedule_slot_id, notes')
    .eq('id', practiceId)
    .eq('season_id', seasonId)
    .single();
  if (!practice) return NextResponse.json({ error: 'Practice not found' }, { status: 404 });
  if (practice.club_schedule_slot_id) {
    return NextResponse.json({ error: SCHEDULE_WORDS.onlyTheClub, code: 'from_club' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, scope = 'one' } = body ?? {};
  if (action === 'edit') return editPractice(ctx.org.id, practice, scope, body);
  if (action !== 'cancel')
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  if (!['one', 'remaining', 'all'].includes(scope))
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });

  await cancelPractice(practiceId, scope as 'one' | 'remaining' | 'all');
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/practices/[practiceId]' });

/** "18:00", a real clock; "2027-06-16", a real calendar day (never one that rolls over into another). */
const isClock = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;

/** The pencil's save: this practice, or this one and the rest of its series (each keeping its own date). */
async function editPractice(
  orgId: string,
  practice: { id: string; team_id: string; status: string; scheduled_at: string | null; recurrence_group_id: string | null; notes: string | null },
  scope: unknown,
  body: Record<string, unknown>,
) {
  const W = PRACTICE_WINDOW_WORDS.refusals;
  if (scope !== 'one' && scope !== 'rest') return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  if (practice.status === 'cancelled') return NextResponse.json({ error: W.cancelled, code: 'cancelled' }, { status: 409 });
  const startTime = typeof body.startTime === 'string' ? body.startTime : '';
  const endTime = typeof body.endTime === 'string' && body.endTime ? body.endTime : null;
  if (!isClock(startTime) || (endTime && !isClock(endTime))) return NextResponse.json({ error: W.badTime, code: 'bad_request' }, { status: 400 });
  if (scope === 'one' && (typeof body.scheduledDate !== 'string' || !isDay(body.scheduledDate))) {
    return NextResponse.json({ error: W.badTime, code: 'bad_request' }, { status: 400 });
  }

  // The dates it moves: this one, or this one and the ones after it in its series that aren't cancelled.
  let targets: { id: string; scheduled_at: string | null; notes: string | null }[] = [{ id: practice.id, scheduled_at: practice.scheduled_at, notes: practice.notes }];
  if (scope === 'rest' && practice.recurrence_group_id && practice.scheduled_at) {
    const { data } = await supabaseAdmin.from('league_practices').select('id, scheduled_at, notes')
      .eq('org_id', orgId).eq('recurrence_group_id', practice.recurrence_group_id).is('club_schedule_slot_id', null)
      .neq('status', 'cancelled').gte('scheduled_at', practice.scheduled_at).order('scheduled_at');
    targets = (data ?? []) as typeof targets;
  }

  const selection = await resolveLeagueVenueSelection({
    orgId,
    orgVenueId: (body.orgVenueId as string | null) ?? null,
    orgVenueFacilityId: (body.orgVenueFacilityId as string | null) ?? null,
    locationText: (body.location as string | null) ?? null,
  });
  if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: 400 });
  const { orgVenueId, orgVenueFacilityId, location } = selection.value;
  // Notes the form left as they were stay each practice's own (/review 2026-10-27); changed notes go to every one it moves.
  const typed = typeof body.notes === 'string' ? body.notes.trim() || null : undefined;
  const notesOf = (own: string | null) => (typed === undefined || typed === (practice.notes?.trim() || null) ? own : typed);

  const rows = targets.filter(t => t.scheduled_at || scope === 'one').map(t => {
    const date = scope === 'one' ? (body.scheduledDate as string) : utcToZonedInputs(t.scheduled_at).date;
    const scheduledAt = zonedWallClockToUtc(date, startTime) ?? `${date}T${startTime}:00`;
    const endsAt = endTime ? (resolveEndInstant(scheduledAt, date, endTime) ?? `${date}T${endTime}:00`) : null;
    return { id: t.id, scheduledAt, endsAt, orgVenueId, orgVenueFacilityId, location, notes: notesOf(t.notes) };
  });
  if (!rows.length) return NextResponse.json({ error: W.cancelled, code: 'cancelled' }, { status: 409 });

  // One booking pool, as Add practice: a picked facility that clashes refuses, named on its date; typed text warns.
  const { data: team } = await supabaseAdmin.from('league_teams').select('name').eq('id', practice.team_id).maybeSingle();
  const check = await checkLeagueBookings({
    orgId,
    excludePracticeIds: rows.map(r => r.id),
    proposed: rows.map((r, i) => ({
      id: `edit-${i}`, kind: 'practice' as const, startsAt: r.scheduledAt, endsAt: r.endsAt,
      orgVenueId: r.orgVenueId, orgVenueFacilityId: r.orgVenueFacilityId, location: r.location,
      label: `${team?.name ?? 'Team'} practice`,
    })),
  });
  if (check.blocking.length) return NextResponse.json({ error: check.blocking[0].message, conflicts: check.blocking }, { status: 409 });

  await updatePractices(rows);
  return NextResponse.json({ ok: true, count: rows.length, warnings: check.warnings.map(w => w.message) });
}
