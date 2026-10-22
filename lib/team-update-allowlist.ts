/**
 * THE TEAMS SCREEN'S UPDATE — what a person may change on a tournament team through the teams route
 * (`app/api/admin/teams/route.ts`, the POST update branch), and nothing else.
 *
 * Until 2026-10-16 that branch wrote every key it was sent straight into `teams`, and checked the
 * organization against the team's CURRENT tournament only — so an organizer could move a team into
 * another organization's event (`tournament_id`), point it at another event's pool, or stamp the
 * check-in and registration columns (FREE_TOURNAMENT_TIER_REVIEW_PLAN.md §12, "Pre-existing").
 *
 * The list is built from what the screens SEND, not from the table: the team record window
 * (`TeamRecordUpdates`: name, coach, email, seed, adminNotes, poolId) and the Teams page (status for Accept/Reject,
 * paymentStatus for Mark paid/unpaid, poolId for the pool moves). The PAID FIGURES are not here since mig 345: a payment is
 * recorded through the payments route, and the database keeps `total_paid` / `deposit_paid` as the sum of the team's payments.
 * A key no caller sends is not here. A key that is not here refuses the WHOLE request — a caller
 * sending one is a bug to surface, not a field to drop quietly. `tournament_id`, `division_id` and
 * `slot_id` are never settable here: moving a team between events or divisions is not a feature of
 * this route, and a spot is taken through the promote and swap actions.
 *
 * Pure — the route does the two reads (the staff-email test and the pools); this file decides.
 */
import type { Team } from './types';

/** The key each screen sends → the `teams` column it writes. */
export const TEAM_UPDATE_COLUMNS = {
  name: 'name',
  coach: 'coach',
  email: 'email',
  seed: 'seed',
  adminNotes: 'admin_notes',
  poolId: 'pool_id',
  status: 'status',
  paymentStatus: 'payment_status',
} as const;

export type TeamUpdateKey = keyof typeof TEAM_UPDATE_COLUMNS;

/** A checked update, as columns. */
export type TeamUpdateColumns = Partial<{
  name: string;
  coach: string | null;
  email: string;
  seed: number | null;
  admin_notes: string | null;
  pool_id: string | null;
  status: Team['status'];
  payment_status: Team['paymentStatus'];
}>;

export const TEAM_STATUSES: ReadonlySet<string> = new Set<Team['status']>(['pending', 'accepted', 'waitlist', 'rejected']);
export const TEAM_PAYMENT_STATUSES: ReadonlySet<string> = new Set<Team['paymentStatus']>(['pending', 'paid']);

/** The registration route's and the coach's own contact route's address test. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The sentences a refused update carries (shown in the Teams screen's "That didn’t save" window). */
export const TEAM_UPDATE_REFUSALS = {
  noUpdates: 'No updates provided',
  badTeam: 'That team couldn’t be found.',
  unknownKey: (key: string) => `“${key}” can’t be changed here.`,
  name: 'Enter a team name.',
  email: 'Enter a valid email address.',
  staffEmail: 'That email belongs to FieldLogicHQ staff and can’t be used as a team contact.',
  /** A team with payments is taken back to unpaid by removing them, not by flipping the status. */
  removePayments: 'Remove the team’s payments to take it back to unpaid.',
  status: 'That isn’t a team status.',
  paymentStatus: 'A payment is either paid or pending.',
  text: 'That field takes text.',
  pool: 'That pool isn’t in this team’s division.',
  oneTournament: 'These teams aren’t all in one tournament.',
} as const;

export type TeamUpdateItem = { id: string; updates: TeamUpdateColumns };
export type TeamUpdateRead = { ok: true; items: TeamUpdateItem[] } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** One update object → its columns, or the reason it is refused. */
export function readTeamUpdate(raw: unknown): { ok: true; updates: TeamUpdateColumns } | { ok: false; error: string } {
  if (!isPlainObject(raw)) return { ok: false, error: TEAM_UPDATE_REFUSALS.noUpdates };
  const out: TeamUpdateColumns = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!Object.hasOwn(TEAM_UPDATE_COLUMNS, key)) return { ok: false, error: TEAM_UPDATE_REFUSALS.unknownKey(key) };
    if (value === undefined) continue;
    switch (key as TeamUpdateKey) {
      case 'name': {
        const name = typeof value === 'string' ? value.trim() : '';
        if (!name) return { ok: false, error: TEAM_UPDATE_REFUSALS.name };
        out.name = name;
        break;
      }
      case 'coach': {
        if (value !== null && typeof value !== 'string') return { ok: false, error: TEAM_UPDATE_REFUSALS.text };
        // "No coach" is NULL, never '' — the encoding every other write path uses (migrations 202 + 204).
        out.coach = value?.trim() || null;
        break;
      }
      case 'email': {
        if (value !== null && typeof value !== 'string') return { ok: false, error: TEAM_UPDATE_REFUSALS.email };
        const email = (value ?? '').trim().toLowerCase();
        // An empty address clears it, as the team record allows; Add team stores the same ''.
        if (email && !EMAIL_RE.test(email)) return { ok: false, error: TEAM_UPDATE_REFUSALS.email };
        out.email = email;
        break;
      }
      case 'seed': {
        // As before this list existed: anything but a whole 1–999 clears the seed.
        const n = Number(value);
        out.seed = Number.isInteger(n) && n > 0 && n <= 999 ? n : null;
        break;
      }
      case 'adminNotes': {
        if (value !== null && typeof value !== 'string') return { ok: false, error: TEAM_UPDATE_REFUSALS.text };
        out.admin_notes = value;
        break;
      }
      case 'poolId': {
        // '' or null takes the team out of its pool. Anything else is a pool id, checked against the team's division
        // by `poolOutsideDivision` once the route has read the pools.
        if (value === '' || value === null) { out.pool_id = null; break; }
        if (typeof value !== 'string' || !UUID_RE.test(value)) return { ok: false, error: TEAM_UPDATE_REFUSALS.pool };
        out.pool_id = value;
        break;
      }
      case 'status': {
        if (typeof value !== 'string' || !TEAM_STATUSES.has(value)) return { ok: false, error: TEAM_UPDATE_REFUSALS.status };
        out.status = value as Team['status'];
        break;
      }
      case 'paymentStatus': {
        if (typeof value !== 'string' || !TEAM_PAYMENT_STATUSES.has(value)) return { ok: false, error: TEAM_UPDATE_REFUSALS.paymentStatus };
        out.payment_status = value as Team['paymentStatus'];
        break;
      }
    }
  }
  return { ok: true, updates: out };
}

/**
 * The request body → one checked update per team. Two shapes, as the screens send them:
 * `{ ids, updates }` (one change to several teams) and `{ updates: [{ id, updates }] }` (a change each).
 */
export function readTeamUpdates(body: unknown): TeamUpdateRead {
  if (!isPlainObject(body)) return { ok: false, error: TEAM_UPDATE_REFUSALS.noUpdates };
  let pairs: Array<{ id: unknown; updates: unknown }>;
  if (body.ids !== undefined && body.updates !== undefined && !Array.isArray(body.updates)) {
    if (!Array.isArray(body.ids)) return { ok: false, error: TEAM_UPDATE_REFUSALS.badTeam };
    pairs = body.ids.map(id => ({ id, updates: body.updates }));
  } else if (Array.isArray(body.updates)) {
    pairs = body.updates.map(item => (isPlainObject(item) ? { id: item.id, updates: item.updates } : { id: undefined, updates: undefined }));
  } else {
    return { ok: false, error: TEAM_UPDATE_REFUSALS.noUpdates };
  }
  if (pairs.length === 0) return { ok: false, error: TEAM_UPDATE_REFUSALS.noUpdates };

  const items: TeamUpdateItem[] = [];
  for (const pair of pairs) {
    if (typeof pair.id !== 'string' || !UUID_RE.test(pair.id)) return { ok: false, error: TEAM_UPDATE_REFUSALS.badTeam };
    const read = readTeamUpdate(pair.updates);
    if (!read.ok) return read;
    items.push({ id: pair.id, updates: read.updates });
  }
  return { ok: true, items };
}

/** The addresses an update would set, for the route's staff-email test (the one read this file can't make). */
export function emailsToCheck(items: TeamUpdateItem[]): string[] {
  return [...new Set(items.map(i => i.updates.email).filter((e): e is string => Boolean(e)))];
}

/** The pool ids an update would set, for the route's one read of `pools`. */
export function poolIdsToCheck(items: TeamUpdateItem[]): string[] {
  return [...new Set(items.map(i => i.updates.pool_id).filter((p): p is string => Boolean(p)))];
}

/**
 * Does any update put a team in a pool that isn't its own division's, in its own tournament? Every pool control on
 * the Teams screen offers only the team's division's pools, so this admits each of them and refuses a pool from
 * another division, another event or another organization — and a pool id that doesn't exist.
 */
export function poolOutsideDivision(
  items: TeamUpdateItem[],
  teams: ReadonlyMap<string, { tournament_id: string | null; division_id: string | null }>,
  pools: ReadonlyMap<string, { division_id: string; tournament_id: string | null }>,
): boolean {
  for (const item of items) {
    const poolId = item.updates.pool_id;
    if (!poolId) continue;
    const team = teams.get(item.id);
    const pool = pools.get(poolId);
    if (!team || !pool) return true;
    if (!team.division_id || pool.division_id !== team.division_id) return true;
    if (!team.tournament_id || pool.tournament_id !== team.tournament_id) return true;
  }
  return false;
}
