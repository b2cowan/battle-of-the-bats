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

export function applyDivisionRoundRobinDeleteScope<TQuery extends EqDeleteQuery<TQuery>>(
  query: TQuery,
  divisionId: string,
): TQuery {
  return query.eq('division_id', divisionId).eq('is_playoff', false);
}
