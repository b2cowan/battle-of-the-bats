import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * lib/family-engagement.ts — "did anyone read it?", answered in integers only.
 *
 * ⚠ THIS MODULE EXPORTS NO ROW READER, AND MUST NOT GAIN ONE. Owner ruling for Chunk D 3.5:
 * coach-side aggregates, never per-person read receipts. The table stores which link opened
 * which season's recap because de-duplicating "12 of 15 families" cannot be done without it —
 * but the identity exists to be counted and for no other purpose. A function here that
 * returned link ids, emails or timestamps would turn a count into a receipt, which is a
 * different product and a worse one. If a future feature seems to need one, that is a
 * decision for the owner, not a helper.
 */

/** Record that a guardian opened this season's recap. Idempotent: the first open wins and
 *  every later one is a no-op, so this is a "has read" flag, not a hit counter. */
export async function recordRecapView(params: {
  orgId: string;
  repTeamId: string;
  programYearId: string;
  linkId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('family_recap_views')
    .upsert({
      org_id: params.orgId,
      rep_team_id: params.repTeamId,
      program_year_id: params.programYearId,
      link_id: params.linkId,
    }, { onConflict: 'link_id,program_year_id', ignoreDuplicates: true });
  // Telemetry must never cost a family their recap. A failure here is swallowed on purpose:
  // the page's job is to show a child's season, not to guarantee the coach's counter.
  if (error) console.error('[family-engagement] recap view not recorded', error);
}

export interface RecapEngagement {
  /** Guardians who opened this season's recap. */
  viewers: number;
  /** Guardians who COULD — verified, player-attached links on this season's roster. The
   *  denominator matters: "12" alone reads as either a triumph or a failure. */
  eligible: number;
}

/**
 * How many of a season's guardians opened the recap.
 *
 * Both numbers are counts, and `eligible` is counted from the links themselves rather than a
 * stored total, so it can never drift from the rows it describes (the same rule
 * `getFamilyAdoptionCounts` follows).
 *
 * ⚠ THE NUMERATOR IS RESOLVED FROM THE DENOMINATOR, deliberately, and the two queries are
 * therefore SEQUENTIAL rather than parallel. Counting every view row for the season
 * independently looked equivalent and was not: a view row outlives the link that made it
 * (revoking a guardian is a status change, not a delete), so a revoked guardian — or an
 * ordinary guardian swap mid-season — stayed in the numerator while dropping out of the
 * denominator, and the coach was shown "3 of 2 families opened it". A count that can exceed
 * its own total is exactly the kind of thing this feature promises not to print.
 */
export async function countRecapViewers(params: {
  repTeamId: string;
  programYearId: string;
}): Promise<RecapEngagement> {
  // Guardians of THIS season's players, as they stand today. `player_id` is season-scoped (a
  // rollover mints new roster rows), so the join through the roster is what makes this a
  // per-season number. Bounded by two per player, so the id list stays small.
  const { data: links, error: linksError } = await supabaseAdmin
    .from('family_links')
    .select('id, rep_roster_players!inner(program_year_id)')
    .eq('rep_team_id', params.repTeamId)
    .eq('role', 'guardian')
    .eq('status', 'verified')
    .eq('rep_roster_players.program_year_id', params.programYearId);
  if (linksError) throw linksError;

  const eligibleIds = (links ?? []).map(l => (l as { id: string }).id);
  if (eligibleIds.length === 0) return { viewers: 0, eligible: 0 };

  const { count, error: viewError } = await supabaseAdmin
    .from('family_recap_views')
    .select('id', { count: 'exact', head: true })
    .eq('program_year_id', params.programYearId)
    .in('link_id', eligibleIds);
  if (viewError) throw viewError;

  return { viewers: count ?? 0, eligible: eligibleIds.length };
}
