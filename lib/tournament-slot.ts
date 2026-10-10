/**
 * ONE TOURNAMENT AT A TIME — what holds a slot (A23, owner 2026-10-10, BUSINESS_DECISIONS.md "One at a time").
 *
 * On a plan with a finite number of tournament slots (the free Tournament plan and the Premium Coaches Portal's
 * included tournament: `tournamentLimit` 1), only a **Draft** or an **Active** event holds one. A finished
 * (Completed) event does not — its results, public site and shared links stay online while next year's event is set
 * up — and an Archived one never did. Until 2026-10-10 every event that wasn't archived held a slot.
 *
 * THE ONE HOME of that rule. Every limit check reads it, and nothing else decides it:
 *   - New tournament (`api/admin/setup-tournament`) and the clone (`api/admin/tournaments/[id]/clone`);
 *   - a status change (`api/admin/tournaments`, set-status): moving an event INTO Draft or Active from outside them
 *     (Reopen, Move back to draft of a finished event) needs a free slot; Bring back (Archived → Completed) does not;
 *   - the downgrade's keep/archive step and the platform admin's plan change (`lib/billing-retention.ts`): only Draft
 *     and Active events beyond the new limit are archived, never a finished one;
 *   - the restores after a re-upgrade or a reactivation: a finished event comes back without a slot;
 *   - the Tournaments list's slot line, the rail's +, the event's record, the finished board, Plan & billing's usage
 *     and the coach portal's "Tournaments you run".
 * The words live beside it, in `lib/tournament-status-words.ts` and `lib/after-event-words.ts`.
 *
 * No plan value moves with it: `tournamentLimit` stays 1 (`lib/plan-config.ts`). Pure — safe on the client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** The statuses that hold a slot. Read with `.in('status', SLOT_STATUSES)` on the server. */
export const SLOT_STATUSES = ['draft', 'active'] as const;

/** Does an event in this status hold one of its plan's tournament slots? */
export function holdsSlot(status: string | null | undefined): boolean {
  return status === 'draft' || status === 'active';
}

/**
 * Does a status change need a FREE slot? Only one that moves an event INTO Draft or Active from outside them:
 * Reopen (Completed → Active), Move back to draft (Completed → Draft), or an archived event straight back to either.
 * Bring back (Archived → Completed) and Mark complete need none; Draft ⇄ Active keeps the slot the event holds.
 */
export function needsFreeSlot(from: string | null | undefined, to: string): boolean {
  return holdsSlot(to) && !holdsSlot(from);
}

/** The plan has a finite number of slots (an unlimited plan stores 9999). */
export function hasFiniteSlots(limit: number | null | undefined): boolean {
  return (limit ?? 9999) < 9999;
}

/** An event that holds a slot, named so a refusal can say which one. */
export type SlotHolder = { id: string; name: string; status: 'draft' | 'active' };

/**
 * The org's slot holders, Active first (the one a refusal names: "mark it complete when it's done"), then Draft.
 * `exceptId` leaves out the event being changed. Throws on a failed read — a limit check never guesses.
 */
export async function readSlotHolders(db: SupabaseClient, orgId: string, exceptId?: string): Promise<SlotHolder[]> {
  let query = db.from('tournaments').select('id, name, status').eq('org_id', orgId).in('status', [...SLOT_STATUSES]);
  if (exceptId) query = query.neq('id', exceptId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as SlotHolder[]).sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
}

/**
 * The holder a refusal may NAME: the first one the caller can see. A member limited to certain tournaments
 * (`assignedTournamentIds`, null = unrestricted) is never told the name of one outside them — the refusal then says
 * "another tournament".
 */
export function visibleHolder(holders: readonly SlotHolder[], assignedTournamentIds: readonly string[] | null | undefined): SlotHolder | null {
  if (assignedTournamentIds === undefined) return null;
  return holders.find(h => assignedTournamentIds === null || assignedTournamentIds.includes(h.id)) ?? null;
}

/**
 * A restore brings back the rows it can, in their order: one that comes back finished needs no slot; one that comes
 * back as a Draft or Active takes one while any are free. (Before A23 every row took a slot.)
 */
export function withinFreeSlots<T>(rows: readonly T[], freeSlots: number, statusOf: (row: T) => string): T[] {
  let free = freeSlots;
  return rows.filter(row => {
    if (!holdsSlot(statusOf(row))) return true;
    if (free <= 0) return false;
    free -= 1;
    return true;
  });
}
