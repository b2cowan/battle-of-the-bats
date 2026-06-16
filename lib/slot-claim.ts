import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * J1-066 — claim the next open pool slot for a team when it is accepted into a
 * slot-configured division.
 *
 * Accepting a team marks it `accepted` but historically never dropped it into a
 * playing slot, so in a slot-configured division the team vanished from the
 * board (the board IS the slots). This places the team into the lowest empty
 * slot for its division when one exists. When the division has NO empty slot,
 * it is a no-op — the team surfaces in the always-on "Unplaced" attention list
 * (see lib/registration-attention.ts) instead of disappearing.
 *
 * This is intentionally NOT plan-gated: every plan needs an accepted team to
 * stay on the board. The Plus-only `promote-from-waitlist` tool remains for
 * *manual* placement into a chosen slot.
 *
 * Slot ordering matches promote-from-waitlist: pool display_order, then slot_number.
 *
 * Returns the claimed slot id, or null when no empty slot was available (left unplaced).
 */
export async function claimNextOpenSlot(
  teamId: string,
  divisionId: string | null | undefined,
): Promise<string | null> {
  if (!divisionId) return null;

  const { data: emptySlots } = await supabaseAdmin
    .from('pool_slots')
    .select('id, slot_number, pools(display_order)')
    .eq('division_id', divisionId)
    .is('team_id', null);

  if (!emptySlots || emptySlots.length === 0) return null;

  const sorted = [...emptySlots].sort((a: any, b: any) => {
    const oa = (a.pools as any)?.display_order ?? 0;
    const ob = (b.pools as any)?.display_order ?? 0;
    return oa !== ob ? oa - ob : a.slot_number - b.slot_number;
  });

  const slotId = sorted[0].id as string;
  await supabaseAdmin.from('pool_slots').update({ team_id: teamId }).eq('id', slotId);
  await supabaseAdmin.from('teams').update({ slot_id: slotId }).eq('id', teamId);
  return slotId;
}
