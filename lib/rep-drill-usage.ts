/**
 * Two questions answered by walking a team's practice plans (Practice Plans Phase 2).
 *
 *  1. **"In 8 plans"** — how many plans a drill appears in.
 *  2. **"Add drills from a past season"** — what a coach already wrote, offered as drills to save.
 *
 * Both live here rather than in a route because both walk the same jsonb shape, and a second copy
 * of that walk is exactly how two surfaces end up disagreeing about what counts.
 *
 * ⚠ **PLANS, NEVER PRACTICES — the planned-vs-done rule (§4) binds here too.** Nothing in this
 * product records what was actually run (D4), so "used 8×" or "ran 6×" would be claims the data
 * cannot support: a coach may have planned a drill and skipped it in the rain. Every count here,
 * and every string that renders one, says *plans*.
 *
 * ⚠ **No ranking, and nothing here counts a child (§4).** These are facts about a DRILL. The import
 * list is ordered by how many plans an ACTIVITY appears in — the ordering rule that is forbidden is
 * one that ranks people.
 */
import type { PracticePlan, PracticeStation } from './rep-practice-plan';
import { blockToDrillInput, stationToDrillInput, type DrillInput } from './rep-drills';

/** Every station in a plan, flattened — one place that knows where stations live. */
function stationsOf(plan: PracticePlan | null | undefined): PracticeStation[] {
  if (!plan) return [];
  return plan.blocks.flatMap(b => b.stations ?? []);
}

/**
 * How many stations across these plans were picked from each drill, keyed by drill id.
 *
 * ⚠ Counts only stations that are STILL attached to their drill. A station a coach detached to edit
 * has stopped being that drill by definition (owner ruling 2026-08-01), and counting it would make
 * the number mean "eight things that started out as this" — exactly the noise the read-only rule
 * exists to prevent.
 */
export function countDrillUses(plans: readonly (PracticePlan | null)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const plan of plans) {
    for (const station of stationsOf(plan)) {
      if (!station.drillId) continue;
      counts.set(station.drillId, (counts.get(station.drillId) ?? 0) + 1);
    }
  }
  return counts;
}

/** One activity a coach already planned, offered for import into the live library. */
export interface ImportableDrill {
  /** Stable within one response — derived from the name, so the client can key a list on it. */
  key: string;
  drill: DrillInput;
  /**
   * How many past PLANS it appears in. A fact about the ACTIVITY, never about a child.
   *
   * ⚠ Plans, not practices: nothing records what was actually run (D4), so "ran 6×" would be a
   * claim the data cannot support.
   */
  planCount: number;
  /**
   * The date of the most recent PLAN it appears in, so a coach can recognise it. ISO instant,
   * formatted by the caller. ⚠ "Last planned", never "last run" — see the module header.
   */
  lastPlannedAt: string | null;
  /** Already in the current library — shown and greyed rather than hidden. */
  alreadyInLibrary: boolean;
}

/**
 * Turn a team's PAST-SEASON practice plans into a list of drills they could save.
 *
 * ⚠ **This is the concrete shape of the owner's 2026-08-01 archive ruling**: the library itself is
 * not browsable in a finished season, but a coach can reach back and pull what they wrote forward.
 * It reads only; nothing is written into the finished season.
 *
 * ⚠ **Deduplicated by NAME, case-insensitively, keeping the most recent version's words.** A coach
 * who ran "Front toss" thirty times wants one row, not thirty — and the newest wording is the one
 * they refined, so it is the one worth keeping. Older variants are counted, never merged: inventing
 * a blend of two descriptions would be a fabrication.
 *
 * ⚠ A station that was ITSELF picked from a drill is skipped. It came out of a library, so offering
 * to import it back in is a loop that produces duplicates of drills the coach already has.
 *
 * ⚠ **A BARE WRITTEN BLOCK is offered too** (practices re-evaluation stage 4, owner ruling L1,
 * 2026-09-16) — a titled block with NO stations is the activity (stage 3's D13), and last year's
 * written warm-up was the one thing this list could not see. It arrives with its minutes as the
 * drill's "usually" (`blockToDrillInput`). The blocks and the stations share ONE name key: a
 * warm-up written as a block one night and as a station another is one row, the newest wording
 * kept, never two texts merged. Kit on a past block is tag IDS (D11) and this walk has no library
 * to resolve them against, so it carries none — the coach's tags are asked for on the save anyway.
 * A block WITH stations is a circuit's shape, not a drill's: only its written stations are offered
 * here (the Circuits tab's own import takes the whole block), and the block's intro words — the
 * circuit's, not any one station's — are not offered as a drill.
 *
 * @param plans past-season plans ONLY — the caller excludes the live season, because a station in
 *   this season's plan is reachable through "Save to my drills…" on the plan itself.
 * @param existingNames active drill names already in the library, for the greyed-out state.
 */
export function collectImportableDrills(
  plans: readonly { plan: PracticePlan | null; startsAt: string | null }[],
  existingNames: readonly string[],
): ImportableDrill[] {
  const have = new Set(existingNames.map(n => n.trim().toLowerCase()));
  const byName = new Map<string, ImportableDrill>();

  // Newest first, so the FIRST time a name is seen carries the words worth keeping.
  const ordered = [...plans].sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));

  const offer = (name: string, drill: DrillInput, startsAt: string | null) => {
    const key = name.toLowerCase();
    const seen = byName.get(key);
    if (seen) { seen.planCount += 1; return; }
    byName.set(key, { key, drill, planCount: 1, lastPlannedAt: startsAt, alreadyInLibrary: have.has(key) });
  };

  for (const { plan, startsAt } of ordered) {
    for (const block of plan?.blocks ?? []) {
      if ((block.stations?.length ?? 0) === 0) {
        const name = block.title.trim();
        if (!name) continue;
        // ⚠ NOT inferred. A past block carries no tags, and guessing them from keywords is the
        // confident lie §4 forbids — the coach is asked when they save it.
        offer(name, blockToDrillInput(block, []), startsAt);
        continue;
      }
      for (const station of block.stations ?? []) {
        if (station.drillId) continue; // already came from the library
        const name = station.name.trim();
        if (!name) continue;
        offer(name, stationToDrillInput({ ...station, name }), startsAt);
      }
    }
  }

  // Most-planned first, then alphabetical — the coach's own staples, which is what makes this list
  // worth opening rather than a wall of every warm-up they ever typed. Orders ACTIVITIES, never
  // people, so the no-ranking rule is untouched.
  return [...byName.values()].sort((a, b) => b.planCount - a.planCount || a.drill.name.localeCompare(b.drill.name));
}
