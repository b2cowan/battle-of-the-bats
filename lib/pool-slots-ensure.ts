/**
 * THE POOL-SLOTS ROUTE'S ONE WRITE — "ensure", which creates the spots a pool schedule plays on
 * (`app/api/admin/pool-slots/route.ts`; its one caller is the schedule generator's save, Generator.tsx).
 *
 * Until 2026-10-16 the route checked the organization against the request's `tournamentId` and then trusted the
 * division and every pool id it was sent: spots were added to another organization's pool, and that pool's spots and
 * team names were read back. Its other actions (sync-capacity, assign, unassign, swap, rename) did the same with pools,
 * spots and teams — sync-capacity DELETED another organization's empty spots; rename rewrote game labels by spot id,
 * past the completed-event lock — and had had no caller since their screens moved (June 1; the Teams redraw of
 * 2026-09-30 moved the spot swap to the teams route); they were removed.
 *
 * Pure — the route makes the two reads (the division, the pools); this file decides.
 */

export type EnsurePool = { poolId: string; slotCount: number; namePrefix: string };
export type EnsureRead = { ok: true; tournamentId: string; divisionId: string; pools: EnsurePool[] } | { ok: false; error: string };

/** More spots than a pool can mean; it only stops a runaway number creating rows without end. */
export const MAX_SLOTS_PER_POOL = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The sentences a refused request carries (the generator shows the error on its save). */
export const POOL_SLOT_REFUSALS = {
  shape: 'That request isn’t one the schedule generator sends.',
  count: `A pool takes from 0 to ${MAX_SLOTS_PER_POOL} spots.`,
  outside: 'Those pools aren’t in this tournament’s division.',
} as const;

/** The request body → its checked parts, or the reason it is refused. */
export function readEnsureRequest(body: unknown): EnsureRead {
  if (typeof body !== 'object' || body === null) return { ok: false, error: POOL_SLOT_REFUSALS.shape };
  const { tournamentId, divisionId, pools } = body as Record<string, unknown>;
  if (typeof tournamentId !== 'string' || !UUID_RE.test(tournamentId)) return { ok: false, error: POOL_SLOT_REFUSALS.shape };
  if (typeof divisionId !== 'string' || !UUID_RE.test(divisionId)) return { ok: false, error: POOL_SLOT_REFUSALS.shape };
  if (!Array.isArray(pools)) return { ok: false, error: POOL_SLOT_REFUSALS.shape };
  const out: EnsurePool[] = [];
  for (const p of pools) {
    if (typeof p !== 'object' || p === null) return { ok: false, error: POOL_SLOT_REFUSALS.shape };
    const { poolId, slotCount, namePrefix } = p as Record<string, unknown>;
    if (typeof poolId !== 'string' || !UUID_RE.test(poolId)) return { ok: false, error: POOL_SLOT_REFUSALS.shape };
    if (typeof namePrefix !== 'string' || namePrefix.length > 200) return { ok: false, error: POOL_SLOT_REFUSALS.shape };
    if (typeof slotCount !== 'number' || !Number.isInteger(slotCount) || slotCount < 0 || slotCount > MAX_SLOTS_PER_POOL) {
      return { ok: false, error: POOL_SLOT_REFUSALS.count };
    }
    out.push({ poolId, slotCount, namePrefix });
  }
  return { ok: true, tournamentId, divisionId, pools: out };
}

/**
 * Is the division outside the tournament, or any pool outside the division? `division` is the division row read by
 * id (null when there is none); `poolRows` are the pools read by the requested ids. A pool that doesn't exist refuses.
 */
export function ensureOutsideDivision(
  read: { tournamentId: string; divisionId: string; pools: EnsurePool[] },
  division: { tournament_id: string | null } | null,
  poolRows: ReadonlyArray<{ id: string; division_id: string }>,
): boolean {
  if (!division || division.tournament_id !== read.tournamentId) return true;
  const poolDivision = new Map(poolRows.map(p => [p.id, p.division_id]));
  return read.pools.some(p => poolDivision.get(p.poolId) !== read.divisionId);
}
