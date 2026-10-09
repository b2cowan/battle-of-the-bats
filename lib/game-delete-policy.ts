export interface DeletePolicyGameRow {
  status?: string | null;
  is_playoff?: boolean | null;
  generator_locked?: boolean | null;
}

export interface EqDeleteQuery<TQuery> {
  eq(column: string, value: unknown): TQuery;
}

export const ROUND_ROBIN_REPLACE_ERROR = 'Only unlocked scheduled round-robin games can be replaced by the generator.';
export const PLAYOFF_REPLACE_ERROR = 'Only unlocked scheduled playoff games can be replaced by the playoff generator.';

export function sanitizeGameIds(gameIds: unknown): string[] | null {
  if (!Array.isArray(gameIds)) return null;
  return Array.from(new Set(
    gameIds
      .filter((id): id is string => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean),
  ));
}

export function isReplaceableRoundRobinGame(row: DeletePolicyGameRow): boolean {
  return row.status === 'scheduled' && !row.is_playoff && !row.generator_locked;
}

export function isReplaceablePlayoffGame(row: DeletePolicyGameRow): boolean {
  return row.status === 'scheduled' && Boolean(row.is_playoff) && !row.generator_locked;
}

export function validateReplaceableRoundRobinRows(rows: DeletePolicyGameRow[]): string | null {
  return rows.some(row => !isReplaceableRoundRobinGame(row)) ? ROUND_ROBIN_REPLACE_ERROR : null;
}

export function validateReplaceablePlayoffRows(rows: DeletePolicyGameRow[]): string | null {
  return rows.some(row => !isReplaceablePlayoffGame(row)) ? PLAYOFF_REPLACE_ERROR : null;
}

/**
 * The division's round-robin delete (`delete-division-games`). F70 (Tournament admin redesign, Stage 3 defects pass):
 * it used to take every round-robin game of the division in ANY state — final, submitted, forfeited, cancelled and
 * kept games with them — and it was the generator's default "Replace all". It now takes only what a draft may
 * replace (`isReplaceableRoundRobinGame`), for EVERY caller, so no door can delete a played game through it.
 */
export function applyDivisionRoundRobinDeleteScope<TQuery extends EqDeleteQuery<TQuery>>(
  query: TQuery,
  divisionId: string,
): TQuery {
  return query
    .eq('division_id', divisionId)
    .eq('is_playoff', false)
    .eq('status', 'scheduled')
    .eq('generator_locked', false);
}

/** What `replace_division_round_robin_games` (mig 320, the generator's one-step save) returns. */
export type DraftReplaceResult =
  | { ok: true; inserted: string[]; replaced: number }
  | { ok: false; code: string };

/**
 * The games route's reply to the one-step save (F70 + P1), from the database function's result or its error. The
 * save is one transaction, so every failure means nothing was written — and every failure reply says so.
 */
export function draftReplaceReply(
  result: unknown,
  rpcError: unknown,
  words: { scheduleChanged: string; other: string; divisionNotFound: string; invalid: string },
): { status: number; body: { success: true; inserted: string[]; replaced: number } | { error: string; code?: string } } {
  if (rpcError || !result || typeof result !== 'object') return { status: 500, body: { error: words.other } };
  const r = result as Partial<DraftReplaceResult> & { inserted?: unknown; replaced?: unknown; code?: unknown };
  if (r.ok === true) {
    const inserted = Array.isArray(r.inserted) ? r.inserted.filter((id): id is string => typeof id === 'string') : [];
    return { status: 200, body: { success: true, inserted, replaced: typeof r.replaced === 'number' ? r.replaced : 0 } };
  }
  if (r.code === 'schedule_changed') return { status: 409, body: { error: words.scheduleChanged, code: 'schedule_changed' } };
  if (r.code === 'division_not_found') return { status: 404, body: { error: words.divisionNotFound } };
  // A team, pool slot or temporary facility from another tournament — not something the generator produces.
  if (r.code === 'foreign_reference') return { status: 400, body: { error: words.invalid } };
  return { status: 500, body: { error: words.other } };
}
