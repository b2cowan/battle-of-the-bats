/**
 * A DIVISION'S PLAYOFF PLAN — what its bracket is: who advances and how it is played (Tournament admin redesign, Stage 3
 * addendum, A63 ruled 2026-10-12).
 *
 * The plan is the part of `divisions.playoff_config` the PUBLIC pages read — the standings' cut line and "Top 4 advance",
 * the Playoffs page's format, a team page's playoff spot, the Bracket view's caption. Before this it was never saved by
 * the generator, and a division added on the Divisions page carried "top 4, single elimination" that nobody chose. Now:
 *   - the Playoff generator writes it, in the same step as the bracket (`replace_division_playoff_games`, mig 327);
 *   - nothing else writes a plan, and a division with no plan shows no cut line and no format (every reader treats an
 *     absent `teamsQualifying` as "no cut line"; tests/unit/playoff-plan.test.ts holds each reader to it).
 *
 * The OTHER keys of playoff_config are the division's standings rules — its tie-breakers, run-differential cap and
 * recorded coin tosses — written by the Divisions page and the coin toss, and kept by every plan write.
 *
 * Pure: no React, no reads. The SQL function holds the same key list (mig 327); a test reads both.
 */
import type { PlayoffConfig } from './types';

/** The plan's keys, in playoff_config. Everything else there is a standings rule the plan never touches. */
export const PLAYOFF_PLAN_KEYS = [
  'teamsQualifying', 'format', 'type', 'crossover', 'hasThirdPlace', 'grandFinalReset', 'splitConfigs', 'tierConfigs',
] as const;

export type PlayoffPlanKey = typeof PLAYOFF_PLAN_KEYS[number];
export type PlayoffPlan = Partial<Pick<PlayoffConfig, PlayoffPlanKey>>;

/** Does this division have a saved plan? A config holding only tie-breakers, a cap or a toss is not a plan. */
export function hasPlayoffPlan(cfg: Partial<PlayoffConfig> | null | undefined): boolean {
  if (!cfg) return false;
  return cfg.teamsQualifying != null || cfg.format != null || cfg.crossover != null || cfg.tierConfigs != null
    || cfg.splitConfigs != null;
}

/** The plan keys of a config, and nothing else (what the generator sends; the function filters the same way). */
export function pickPlayoffPlan(cfg: Partial<PlayoffConfig> | null | undefined): PlayoffPlan {
  const out: Record<string, unknown> = {};
  if (!cfg) return out;
  for (const k of PLAYOFF_PLAN_KEYS) {
    const v = (cfg as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out as PlayoffPlan;
}

/** The function's merge, in TypeScript (the window's statement reads what a save will leave): the plan keys replaced
 *  whole by `plan`, every other key kept. `plan` null leaves the config as it is. */
export function mergePlayoffPlan(
  cfg: Partial<PlayoffConfig> | null | undefined,
  plan: PlayoffPlan | null,
): Partial<PlayoffConfig> | null {
  if (plan == null) return cfg ?? null;
  const kept: Record<string, unknown> = { ...(cfg ?? {}) };
  for (const k of PLAYOFF_PLAN_KEYS) delete kept[k];
  return { ...kept, ...pickPlayoffPlan(plan as Partial<PlayoffConfig>) };
}
