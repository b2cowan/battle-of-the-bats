import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamEvents,
  createRepTeamEvent,
  updateRepTeamEvent,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule } from '@/lib/coach-capabilities';
import { isMirroredEvent } from '@/lib/coach-tournament-games';
import { utcToZonedInputs } from '@/lib/timezone';
import {
  reviewScheduleRows, committableScheduleRows, isBlankScheduleRow,
  MAX_SCHEDULE_IMPORT_ROWS,
  type DraftScheduleRow, type ExistingScheduleEvent, type ReviewedScheduleRow,
} from '@/lib/coach-schedule-import';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

/**
 * Commit a reviewed schedule import (chunk C, P1 #7).
 *
 * The client has already shown the coach a verdict per row. This route **reviews again,
 * independently, against live data** (H2 rule 2) — the schedule may have moved since the preview
 * was built, so a row the client called an add can legitimately become an update here, and only
 * this second verdict is acted on.
 *
 * ⚠ MIRRORED TOURNAMENT GAMES ARE NEVER TOUCHED. They are excluded from the update candidates
 * before matching even runs, so no bulk path can reach one; a row that looks like one comes back
 * as `organizer` for the coach to keep-both or skip (Batch 4 — surfaced, never auto-merged). The
 * response reports how many mirrored rows were left alone so the probe can assert it at the data
 * level rather than trusting the UI.
 *
 * Zero writes is an ERROR, never a quiet success (H2 rule 2). Writes go through the SAME event
 * writers the Add Event form uses, so the wall-clock→UTC conversion (C0) cannot be bypassed by the
 * bulk path (H2 rule 5).
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(
    canManageSchedule(assignment.capabilities),
    'You do not have permission to change the schedule. Ask the head coach to grant it.',
  );
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const submitted: DraftScheduleRow[] = Array.isArray(body?.rows) ? body.rows : [];
  const keepBothRowNumbers: number[] = Array.isArray(body?.keepBothRowNumbers)
    ? body.keepBothRowNumbers.filter((n: unknown) => typeof n === 'number')
    : [];

  const rows = submitted.slice(0, MAX_SCHEDULE_IMPORT_ROWS).filter(r => r && !isBlankScheduleRow(r));
  if (!rows.length) {
    return NextResponse.json({ error: 'There were no rows to import.' }, { status: 400 });
  }

  // Live state, read fresh. Every stored instant is resolved to the ORG'S calendar day and clock
  // before matching, because that is the day the coach's spreadsheet means — a raw UTC slice would
  // put every evening game on the wrong date.
  const liveEvents = await getRepTeamEvents(programYear.id);
  const existing: ExistingScheduleEvent[] = liveEvents.map(e => {
    const zoned = utcToZonedInputs(e.startsAt);
    return {
      id: e.id,
      eventType: e.eventType,
      day: zoned.date,
      time: zoned.time,
      opponent: e.opponent ?? null,
      name: e.name,
      location: e.location ?? null,
      isMirrored: isMirroredEvent(e),
    };
  });

  const reviewed = reviewScheduleRows(rows, existing, { keepBothRowNumbers });
  const writable = committableScheduleRows(reviewed);

  if (!writable.length) {
    const firstReason = reviewed.find(r => r.reason)?.reason;
    return NextResponse.json(
      {
        error: firstReason
          ? `Nothing could be imported. ${firstReason}`
          : 'Nothing in this sheet could be imported.',
        rows: reviewed,
      },
      { status: 400 },
    );
  }

  // Belt and braces: the reviewer already excludes mirrored rows from update matching, but an
  // update target is re-checked against the live row here so no future change to the reviewer can
  // let a bulk write reach an organizer-owned game.
  const mirroredIds = new Set(existing.filter(e => e.isMirrored).map(e => e.id));

  const results: { rowNumber: number; outcome: string; reason?: string; eventId?: string }[] = [];
  let created = 0;
  let updated = 0;

  for (const row of writable) {
    const r = row.resolved!;
    try {
      if (row.outcome === 'update' && row.matchedEventId) {
        if (mirroredIds.has(row.matchedEventId)) {
          results.push({ rowNumber: row.rowNumber, outcome: 'skipped', reason: 'That game belongs to the tournament organizer.' });
          continue;
        }
        // ⚠ An update sets ONLY what the sheet actually carries. A league sheet with just dates
        // and times has no uniform column — writing `null` for every absent cell would silently
        // wipe five fields the coach filled in by hand, on a screen that promised "time changes
        // from 2:00 PM to 6:00 PM". A blank cell means "not in this sheet", never "clear it".
        const changes: Parameters<typeof updateRepTeamEvent>[1] = {};
        // Likewise the time: with no time cell there is nothing to move the game to, and
        // `startsAt` would otherwise resolve to midnight.
        if (row.time.trim()) changes.startsAt = r.startsAt;
        if (row.location.trim()) changes.location = row.location.trim();
        if (row.address.trim()) changes.locationAddress = row.address.trim();
        if (row.arrival.trim()) changes.arrivalTime = row.arrival.trim();
        if (row.field.trim()) changes.fieldNumber = row.field.trim();
        if (row.uniform.trim()) changes.uniform = row.uniform.trim();
        if (r.opponent !== null) changes.opponent = r.opponent;
        if (r.homeAway !== null) changes.homeAway = r.homeAway as 'home' | 'away' | 'neutral';

        if (Object.keys(changes).length === 0) {
          results.push({ rowNumber: row.rowNumber, outcome: 'unchanged', eventId: row.matchedEventId });
          continue;
        }
        await updateRepTeamEvent(row.matchedEventId, changes);
        updated += 1;
        results.push({ rowNumber: row.rowNumber, outcome: 'updated', eventId: row.matchedEventId });
      } else {
        const event = await createRepTeamEvent({
          programYearId: programYear.id,
          teamId: team.id,
          orgId: ctx!.org.id,
          eventType: r.eventType,
          name: r.name,
          startsAt: r.startsAt,
          location: row.location.trim() || null,
          locationAddress: row.address.trim() || null,
          arrivalTime: row.arrival.trim() || null,
          fieldNumber: row.field.trim() || null,
          uniform: row.uniform.trim() || null,
          opponent: r.opponent,
          homeAway: (r.homeAway as 'home' | 'away' | 'neutral' | null) ?? null,
        });
        created += 1;
        results.push({ rowNumber: row.rowNumber, outcome: 'created', eventId: event.id });
      }
    } catch {
      // One bad row must not lose the other twenty-nine — record it and carry on.
      results.push({ rowNumber: row.rowNumber, outcome: 'failed', reason: 'We could not save this one.' });
    }
  }

  // "Nothing changed" is a real, honest outcome — importing the same sheet twice is a no-op, not
  // a failure. Only a run where nothing was even ATTEMPTED successfully is an error.
  const unchanged = results.filter(r => r.outcome === 'unchanged').length;
  if (created + updated + unchanged === 0) {
    return NextResponse.json(
      { error: 'Nothing was imported — none of those rows could be saved.', results },
      { status: 400 },
    );
  }

  return NextResponse.json({
    created,
    updated,
    unchanged,
    skipped: reviewed.length - writable.length,
    // Reported so a probe can assert at the DATA level that organizer-owned rows were left alone.
    organizerRowsLeftAlone: reviewed.filter(r => r.outcome === 'organizer').length,
    results,
    rows: reviewed as ReviewedScheduleRow[],
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/import' });
