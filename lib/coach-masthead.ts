import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { WRAPPED_RECORD_EVENT_TYPES } from './season-wrapped';
import { tallyResults } from './coach-season-record';
import type { MastheadEvent, MastheadRecord } from './coach-masthead-status';

export type { MastheadRecord };

/**
 * The team masthead's ONE feed (desktop shell A2).
 *
 * The masthead renders on every premium team page, so the numbers behind it are read once, by the
 * team-segment layout, and ride down with the page — a segment layout is not re-rendered when the
 * coach moves between pages inside the team, so every page after the first costs nothing.
 *
 * ⚠ THE ARCHIVE RULE (CLAUDE.md, binding): this adds NO live-data read to a finished season. The
 * next-event query addresses the ACTIVE year and nothing else; a past season contributes only its
 * own frozen final record — the same figure Season's End and the season history already show, i.e.
 * what the coach could see at the time. No API route is added, so the opt-in archive contract lists
 * are untouched.
 */

export interface CoachMastheadFeed {
  /**
   * Record per program year id — the CANONICAL rule (`WRAPPED_RECORD_EVENT_TYPES`: league +
   * tournament + legacy external, scrimmages out), the same one Season's End and the season history
   * count by. Owner ruling 2026-08-02: the masthead does NOT follow the per-device "count
   * scrimmages" switch that Insights offers — shell chrome that reads differently on a phone than
   * on a laptop is worse than one page disagreeing.
   *
   * A season with no decided game is ABSENT from this map, never present as 0–0.
   */
  records: Record<string, MastheadRecord>;
  /** The next scheduled event on the ACTIVE season. Never an archived season's. */
  next: MastheadEvent | null;
}

export const EMPTY_MASTHEAD_FEED: CoachMastheadFeed = { records: {}, next: null };

export interface CoachMastheadFeedOpts {
  /**
   * Every program year of this team the coach may open, ALREADY access-checked by the caller
   * (they come from the coach's own assignment rows) and already filtered to the seasons whose
   * `schedule` capability is granted. This function does no authorization of its own.
   */
  yearIds: string[];
  /** The live season's id, or null — a closed-only team triggers no live read at all. */
  activeYearId: string | null;
}

export async function getCoachMastheadFeed(opts: CoachMastheadFeedOpts): Promise<CoachMastheadFeed> {
  const { yearIds, activeYearId } = opts;
  if (yearIds.length === 0) return EMPTY_MASTHEAD_FEED;

  try {
    const [recordsRes, nextRes] = await Promise.all([
      // `status` comes back so cancelled-but-scored games can be dropped in JS — exactly the
      // predicate `computeSeasonWrapped` uses (`result != null && status !== 'cancelled'`). A SQL
      // `.neq('status', …)` would also drop rows whose status is NULL, which is a different rule.
      supabaseAdmin
        .from('rep_team_events')
        .select('program_year_id, result, status')
        .in('program_year_id', yearIds)
        .in('event_type', WRAPPED_RECORD_EVENT_TYPES)
        .not('result', 'is', null),
      activeYearId
        ? supabaseAdmin
            .from('rep_team_events')
            .select('event_type, starts_at, opponent, name')
            .eq('program_year_id', activeYearId)
            .eq('status', 'scheduled')
            // Same window the Overview's own "next up" uses: scheduled, and not already started.
            .gte('starts_at', new Date().toISOString())
            .order('starts_at', { ascending: true })
            .limit(1)
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (recordsRes.error) throw recordsRes.error;
    if (nextRes.error) throw nextRes.error;

    // Group by season, then hand each group to the CANONICAL tally. The counting arithmetic is
    // deliberately not repeated here: `lib/coach-season-record.ts` exists because three surfaces
    // once counted a record by hand and drifted, and a fourth copy in the one place that shows the
    // record on every screen would be the worst possible place for that to happen again.
    const bySeason = new Map<string, { result: string | null }[]>();
    for (const row of recordsRes.data ?? []) {
      if (row.status === 'cancelled') continue;
      const group = bySeason.get(row.program_year_id) ?? [];
      group.push({ result: row.result });
      bySeason.set(row.program_year_id, group);
    }
    const records: Record<string, MastheadRecord> = {};
    for (const [yearId, rows] of bySeason) records[yearId] = tallyResults(rows);

    const nextRow = (nextRes.data ?? [])[0];
    const next: MastheadEvent | null = nextRow
      ? {
          eventType: nextRow.event_type,
          startsAt: nextRow.starts_at,
          opponent: nextRow.opponent ?? null,
          name: nextRow.name ?? '',
        }
      : null;

    return { records, next };
  } catch {
    // ⚠ The masthead sits on the portal's critical path. A query blip costs the status line and
    // degrades the bar to identity-only (A1) — it must never cost the page (the `resolveOrgHomeHref`
    // lesson, /review 2026-08-02).
    return EMPTY_MASTHEAD_FEED;
  }
}
