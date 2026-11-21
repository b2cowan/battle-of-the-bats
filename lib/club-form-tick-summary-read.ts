import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { summariseTicks, type TickRow, type TickSummary } from './club-form-tick-summary';

/**
 * Every house-league registration's document-tick summary, in bulk: one paged read per chunk of ids (a select stops silently at
 * 1,000 rows; a long `.in()` list fails on its length — lib/supabase-paging.ts). A registration with no tick is absent from the map.
 * Org-scoped like every staff read; a failed read throws, as the sign-up reads beside each caller do.
 */
export async function readTickSummaries(orgId: string, registrationIds: readonly string[]): Promise<Map<string, TickSummary>> {
  // An extra never takes the child page, the duplicates or the families export down (/review 2026-11-20): a failed read
  // shows no documents line, as a registration with no tick does, and is logged.
  try {
    const rows = await fetchAllIn<TickRow>(registrationIds, (chunk, from, to) =>
      supabaseAdmin.from('club_form_ticks').select('subject_id, sentence, ticked_at')
        .eq('org_id', orgId).eq('subject_table', 'league_registrations').in('subject_id', chunk).order('id').range(from, to));
    return summariseTicks(rows);
  } catch (e) {
    console.error('[club-form] the document ticks didn’t read:', (e as { code?: string })?.code ?? 'no code');
    return new Map();
  }
}
