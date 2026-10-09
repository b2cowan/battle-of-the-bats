import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { refused, type Moved, type Refused } from './club-money-route';
import { teamIdsInScope } from './club-team-route';
import { allocationYear, loadClubLoop } from './club-money-reads';
import { isClosedYearError, loadFiscalSetting } from './club-fiscal-year-server';
import { latestClosedYear, type FiscalSetting, type FiscalYear } from './club-fiscal-year';
import { ALLOCATION_WINDOW_WORDS, CLUB_BUDGET_REFUSAL } from './club-money-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * AN ALLOCATION'S NAME AND NOTE — the one change its window offers (Club Tier Stage 3d, Ask 3; S3D-02, S3D-03).
 *
 * The pencil edits only what can honestly change after a bill is made: its NAME and the club's NOTE. Its terms — each
 * team's share, the schedule, which teams — have no writer, by ruling (Ask 7b): changing them moves received payments,
 * a team's own schedule, the line's "left" and what each coach was told.
 *
 * Checked FIRST, in words, before anything is written:
 *   - a blank name (400 `description_required`), a name over 200 (400 `bad_description` — New allocation's limit), a
 *     note over 2,000 (400 `note_too_long` — the column's own check, mig 318), nothing to change (400);
 *   - the allocation must be one of the club's, and EVERY team it reaches inside the member's team groups (B11 — the
 *     guard the retired Rep Teams PATCH carried: a member limited to some groups changes only a bill wholly theirs);
 *   - a bill counting in a CLOSED fiscal year is refused in the lock's own words (409 `year_closed`), with the year
 *     Reopen would unlock when it is the latest closed one. The database's lock (`rep_cost_allocations_fiscal_lock`,
 *     mig 318) refuses any change to a locked bill; a write that reaches it anyway (a close raced it) says the same.
 * The year is `allocationYear` — the one rule the window's read uses, so the lock the screen shows is the one met here.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export const ALLOCATION_NAME_MAX = 200;
export const ALLOCATION_NOTE_MAX = 2000;

export interface AllocationEdited { id: string; description: string; notes: string | null }

/** A text's length as the database counts it (`char_length`: characters, not UTF-16 units — an emoji is one). */
const chars = (s: string) => [...s].length;

/** A bill in a closed year: the window's locked line, as a refusal. Reopen is offered only for the LATEST closed year. */
function closedRefusal(year: FiscalYear, setting: FiscalSetting): Refused {
  const latest = latestClosedYear(setting);
  const reopen = latest && latest.key === year.key ? latest : null;
  return refused(409, {
    error: ALLOCATION_WINDOW_WORDS.closedLine(year.name, reopen?.name ?? null),
    code: 'year_closed',
    year: { key: year.key, name: year.name },
    reopen: reopen ? { key: reopen.key, name: reopen.name } : null,
  });
}

export async function editClubAllocation(
  ctx: AuthContextWithRole,
  allocationId: string,
  body: { description?: unknown; notes?: unknown },
): Promise<Moved<{ allocation: AllocationEdited }>> {
  const W = ALLOCATION_WINDOW_WORDS;
  const patch: { description?: string; notes?: string | null } = {};
  if (body.description !== undefined) {
    const name = typeof body.description === 'string' ? body.description.trim() : '';
    if (!name) return refused(400, { error: W.nameMissing, code: 'description_required' });
    if (chars(name) > ALLOCATION_NAME_MAX) return refused(400, { error: CLUB_BUDGET_REFUSAL.bad_description, code: 'bad_description' });
    patch.description = name;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== 'string') return refused(400, { error: W.noteTooLong, code: 'bad_note' });
    const note = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (chars(note) > ALLOCATION_NOTE_MAX) return refused(400, { error: W.noteTooLong, code: 'note_too_long' });
    patch.notes = note || null;
  }
  if (patch.description === undefined && patch.notes === undefined) {
    return refused(400, { error: W.nothingToChange, code: 'nothing_to_change' });
  }

  const orgId = ctx.org.id;
  // Every team the bill reaches, whoever is asking (scope null) — the group check below is against all of them.
  const [loop, inScope, setting] = await Promise.all([
    loadClubLoop(orgId, null, { allocationId }),
    teamIdsInScope(ctx),
    loadFiscalSetting(orgId),
  ]);
  const allocation = loop.allocations.get(allocationId);
  const splits = loop.splits.filter(s => s.allocationId === allocationId);
  if (!allocation || splits.length === 0) return refused(404, { error: W.notFound, code: 'not_found' });
  if (inScope && splits.some(s => !inScope.has(s.teamId))) return refused(403, { error: 'Forbidden' });

  const firstDue = splits.flatMap(s => s.installments.map(i => i.dueDate)).sort()[0] ?? null;
  const { year } = await allocationYear(orgId, allocation, firstDue, setting);
  if (year.locked) return closedRefusal(year, setting);

  const { data, error } = await supabaseAdmin.from('rep_cost_allocations')
    .update(patch).eq('id', allocationId).eq('org_id', orgId)
    .select('id, description, notes').maybeSingle();
  if (error) {
    if (!isClosedYearError(error)) throw error;
    // The year closed between the check and the write: the same refusal, from a fresh read of the years.
    const now = await loadFiscalSetting(orgId);
    const { year: closed } = await allocationYear(orgId, allocation, firstDue, now);
    return closedRefusal(closed, now);
  }
  if (!data) return refused(404, { error: W.notFound, code: 'not_found' });
  return { ok: true, allocation: { id: data.id, description: data.description, notes: data.notes ?? null } };
}
