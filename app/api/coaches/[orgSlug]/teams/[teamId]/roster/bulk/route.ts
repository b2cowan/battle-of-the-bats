import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  createRepRosterPlayer,
  getNextRepRosterDisplayOrder,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import {
  validateDraftRoster,
  committableRows,
  MAX_BULK_ROSTER_ROWS,
  type DraftRosterPlayer,
} from '@/lib/coach-roster-bulk';
import type { RepRosterPlayer } from '@/lib/types';
import {
  readPastPlayers,
  bringBackChild,
  storeNotSameChild,
} from '@/lib/past-players';
import { decideAddDoor, parseSameChildAnswer, isChildAlreadyOnSeason, type AddDoorDecision } from '@/lib/past-player-rules';
import { alreadyOnRoster, pasteNeedsAnswer } from '@/lib/past-player-words';
import { playerName } from '@/lib/coach-roster-name';

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
  if (!assignment) return { error: await refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId) };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

/**
 * Per-field ceilings mirroring the form's own `maxLength` attributes. The client enforces them,
 * but a direct POST doesn't go through the client — and bulk accepts up to 200 rows per request,
 * so an unbounded field here is 200× the abuse surface of the single-add route.
 */
const FIELD_MAX = 500;
const NAME_MAX = 120;

function str(value: unknown, max = FIELD_MAX): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Accept only the fields we write, from whatever the client posted. */
function toDraftRow(raw: unknown, index: number): DraftRosterPlayer {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    rowNumber:         typeof source.rowNumber === 'number' ? source.rowNumber : index + 1,
    playerFirstName:   str(source.playerFirstName, NAME_MAX),
    playerLastName:    str(source.playerLastName, NAME_MAX),
    playerNumber:      str(source.playerNumber, 10),
    primaryPosition:   str(source.primaryPosition, 60),
    playerDateOfBirth: str(source.playerDateOfBirth, 40),
    guardianFirstName: str(source.guardianFirstName, NAME_MAX),
    guardianLastName:  str(source.guardianLastName, NAME_MAX),
    guardianEmail:     str(source.guardianEmail, 160),
    guardianPhone:     str(source.guardianPhone, 40),
    notes:             str(source.notes, FIELD_MAX),
  };
}

/**
 * Commit a reviewed batch of roster rows (Batch 2, P0 #7).
 *
 * Rows are created one at a time through the same `createRepRosterPlayer` the single-player form
 * uses — same columns, same tenancy, no new write path. A row that fails does NOT abort the rest:
 * the response names what landed and what didn't, so a coach pasting fifteen names with one bad
 * line gets fourteen players plus an honest error instead of a silent all-or-nothing rollback.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.rosterWrite, 'Only the head coach can edit the roster.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const incoming: unknown[] = Array.isArray(body?.players) ? body.players : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No players were sent.' }, { status: 400 });
  }
  if (incoming.length > MAX_BULK_ROSTER_ROWS) {
    return NextResponse.json(
      { error: `You can add up to ${MAX_BULK_ROSTER_ROWS} players at a time.` },
      { status: 400 },
    );
  }

  // Re-validate server-side against the CURRENT roster — the client's preview may be stale if
  // another head coach added players while this sheet was open.
  const existing = await getRepRosterPlayers(programYear.id);
  const drafts = incoming.map(toDraftRow);
  const validated = validateDraftRoster(drafts, existing);
  const rows = committableRows(validated);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Every row is missing a first name.' }, { status: 400 });
  }

  // Append position is read ONCE and handed to each insert, so the batch costs one query per player
  // instead of two — and with positions pre-assigned there's no read-modify-write race, which is
  // what lets the inserts run concurrently at all. Order still follows the coach's list.
  const firstOrder = await getNextRepRosterDisplayOrder(programYear.id, team.id);

  /* ⚖ "SAME CHILD?" ON PASTE A LIST (Club Tier Stage 14 S3, tab 4). The check step asked each row whose first + last
     name matches a past player of THIS team; this re-check makes it true. Any row still unanswered refuses the WHOLE
     batch (nothing written) — Add waits until each match is answered. "Same child" rows bring that child back; "New
     player" rows add a new child and store the "no". A same-season name keeps today's warning (that child is on the
     roster, so it is never a "same child?" candidate). */
  const read = await readPastPlayers({
    orgId: ctx!.org.id,
    team: { id: team.id, sport: team.sport ?? null },
    workingSeason: programYear,
    cutoffs: ctx!.org.birthdayCutoffs,
    access: { rosterPii: assignment.capabilities.rosterPii, money: false },
  });
  const rawByRow = new Map(drafts.map((d, i) => [d.rowNumber, incoming[i] as Record<string, unknown>]));
  const decisionByRow = new Map<number, AddDoorDecision>();
  for (const row of rows) {
    const raw = rawByRow.get(row.rowNumber);
    decisionByRow.set(row.rowNumber, decideAddDoor(read, row.playerFirstName, row.playerLastName, parseSameChildAnswer(raw)));
  }
  const unanswered = rows.filter(r => { const k = decisionByRow.get(r.rowNumber)?.kind; return k === 'ask' || k === 'unknown'; });
  if (unanswered.length > 0) {
    return NextResponse.json({
      error: pasteNeedsAnswer(unanswered.length),
      code: 'needs_answer',
      rows: unanswered.map(r => {
        const d = decisionByRow.get(r.rowNumber)!;
        return { rowNumber: r.rowNumber, candidate: d.kind === 'ask' ? d.candidate : null };
      }),
    }, { status: 409 });
  }

  const created: RepRosterPlayer[] = [];
  const failed: { rowNumber: number; name: string; error: string }[] = [];

  // Bounded concurrency: a 200-player paste finishes in ~20 waves rather than 200 sequential
  // round trips, without opening 200 connections at once. Settled per row, so one bad row is
  // reported by name and every other player still lands.
  const CONCURRENCY = 10;
  for (let start = 0; start < rows.length; start += CONCURRENCY) {
    const chunk = rows.slice(start, start + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(async (row, i) => {
      const typed = {
        playerFirstName:   row.playerFirstName,
        playerLastName:    row.playerLastName || null,
        playerDateOfBirth: row.playerDateOfBirth || null,
        playerNumber:      row.playerNumber || null,
        primaryPosition:   row.primaryPosition || null,
        guardianFirstName: row.guardianFirstName || null,
        guardianLastName:  row.guardianLastName || null,
        guardianEmail:     row.guardianEmail || null,
        guardianPhone:     row.guardianPhone || null,
        notes:             row.notes || null,
      };
      const d = decisionByRow.get(row.rowNumber)!;
      if (d.kind === 'already_here') {
        throw new Error(alreadyOnRoster(playerName(d.entry), read.workingSeason));
      }
      if (d.kind === 'same') {
        try {
          return (await bringBackChild({
            orgId: ctx!.org.id, teamId: team.id, workingSeasonId: programYear.id, prior: d.prior,
            userId: ctx!.user.id, overrides: typed, displayOrder: firstOrder + start + i,
          })).player;
        } catch (e) {
          if (isChildAlreadyOnSeason(e)) {
            throw new Error(alreadyOnRoster(playerName(d.prior), read.workingSeason));
          }
          throw e;
        }
      }
      const player = await createRepRosterPlayer({
        programYearId: programYear.id,
        teamId: team.id,
        orgId: ctx!.org.id,
        source: 'admin_manual',
        displayOrder:      firstOrder + start + i,
        ...typed,
        secondaryPosition: null,
      });
      if (d.kind === 'new' && d.notSameChildIds.length > 0) {
        try {
          await storeNotSameChild(player.childId, d.notSameChildIds, 'paste_list', ctx!.user.id);
        } catch (e) {
          console.error('[roster bulk] storing "not the same child" failed (non-blocking):', e);
        }
      }
      return player;
    }));

    settled.forEach((outcome, i) => {
      const row = chunk[i];
      if (outcome.status === 'fulfilled') { created.push(outcome.value); return; }
      failed.push({
        rowNumber: row.rowNumber,
        name: [row.playerFirstName, row.playerLastName].filter(Boolean).join(' ') || `Row ${row.rowNumber}`,
        error: outcome.reason instanceof Error ? outcome.reason.message : 'Could not be added.',
      });
    });
  }

  // Rows the coach never fixed — reported so "13 of 14 added" is always explainable.
  const skipped = validated
    .filter(row => row.errors.length > 0)
    .map(row => ({ rowNumber: row.rowNumber, error: row.errors[0] }));

  // Warnings from the FRESH re-validation above — the coach's preview was built against the roster
  // as it looked when the sheet opened, so a clash created by someone else in the meantime is only
  // visible here. Returning them means a genuinely stale preview can still be reported honestly
  // instead of silently creating a duplicate number.
  const warnings = validated
    .filter(row => row.errors.length === 0 && row.warnings.length > 0)
    .map(row => ({ rowNumber: row.rowNumber, warning: row.warnings[0] }));

  return NextResponse.json({ created, failed, skipped, warnings });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/bulk' });
