/**
 * ONE HOUSE-LEAGUE SEASON AT A TIME — what holds the free League plan's slot (9f·5, owner 2026-11-04,
 * BUSINESS_DECISIONS.md "House League 9f·5"; the tournament's same rule is `lib/tournament-slot.ts`).
 *
 * On the free League plan (`free_floor = 'league_starter'`, `houseLeagueSeasonCap` 1), only a live season holds the one
 * slot: getting ready, registration open, registration closed, or running. A finished season (completed, or archived
 * before Archive was retired) holds nothing — it stays on the club's site while next year's season is set up. Until
 * 9f-1 every season that wasn't archived held the slot, so last year's completed season blocked next year's.
 *
 * THE ONE HOME of that rule. Every limit check reads it, and nothing else decides it:
 *   - Create season (`api/admin/house-league/seasons`, POST): refused while the slot is held;
 *   - a status change (`api/admin/house-league/seasons/[seasonId]`, PATCH): moving a season INTO the set from outside it
 *     (Reopen) needs a free slot;
 *   - the season GET's `reopen` block, which the Reopen window reads to refuse before the tap — the same holders.
 * The words live in `lib/free-floor.ts` (`seasonCapBody`, `reopenRefusal`, `REOPEN_CAP_ERROR`).
 *
 * No plan value moves with it: the cap stays 1 / 1 / 8 (`lib/free-floor.ts`). Pure — safe on the client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** The statuses that hold the slot. Read with `.in('status', SLOT_STATUSES)` on the server. */
export const SLOT_STATUSES = ['draft', 'registration_open', 'registration_closed', 'active'] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

/** Does a season in this status hold the free League plan's slot? */
export function holdsSlot(status: string | null | undefined): boolean {
  return (SLOT_STATUSES as readonly string[]).includes(status ?? '');
}

/**
 * Does a status change need a FREE slot? Only one that moves a season INTO the set from outside it: Reopen (completed or
 * archived → running). Every forward move inside the set keeps the slot the season already holds, and Complete frees it.
 */
export function needsFreeSlot(from: string | null | undefined, to: string): boolean {
  return holdsSlot(to) && !holdsSlot(from);
}

/** A season that holds the slot, named so a refusal can say which one. */
export type SlotHolder = { id: string; name: string; status: SlotStatus };

/** Running first (the one a refusal names: "complete it first"), then the registration states, then getting ready. */
const ORDER: Record<SlotStatus, number> = { active: 0, registration_closed: 1, registration_open: 2, draft: 3 };

/**
 * The club's slot holders, the most under-way first. `exceptId` leaves out the season being changed. Throws on a failed
 * read — a limit check never guesses.
 */
export async function readSlotHolders(db: SupabaseClient, orgId: string, exceptId?: string): Promise<SlotHolder[]> {
  let query = db.from('league_seasons').select('id, name, status').eq('org_id', orgId).in('status', [...SLOT_STATUSES]);
  if (exceptId) query = query.neq('id', exceptId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as SlotHolder[]).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}

/**
 * The holder that blocks one more live season, or null when the plan has room. `cap` is the plan's live-season count
 * (`houseLeagueSeasonCap`; Infinity on a paid plan, which never reads). The holder named is the most under-way one.
 */
export function slotBlocker(holders: readonly SlotHolder[], cap: number): SlotHolder | null {
  return holders.length >= cap ? holders[0] ?? null : null;
}
