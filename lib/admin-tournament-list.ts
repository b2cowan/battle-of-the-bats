/**
 * The tournament admin's list of events — ONE read, used by `GET /api/admin/tournaments` (the browser's read) and by the
 * admin layout's first paint (`readAdminTournamentSeed`), so the two can never disagree about which events a person may
 * open or what an event's phase is (Navigation Phase 0).
 *
 * Server only (service-role client). Scope: the caller's organization, narrowed to their tournament assignments when they
 * have any (`getAuthContextWithScope`: null = unrestricted).
 */
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContextWithScope } from '@/lib/api-auth';
import { OrgBillingSuspendedError } from '@/lib/org-billing-access';
import { hasFirstGameStarted, type GameStartFact } from '@/lib/tournament-phase';
import { tournamentNow } from '@/lib/timezone';
import { adminEventCookieName } from '@/lib/admin-event-choice';

export type AdminTournamentRow = Record<string, unknown> & {
  id: string;
  status?: string | null;
  /** Computed here, not a column (the game-day rule's "first game started" half). */
  first_game_started: boolean;
};

/** Every event of the organization the caller may open, newest year first. Throws on a failed read. */
export async function readAdminTournamentRows(
  orgId: string,
  assignedTournamentIds: string[] | null,
): Promise<AdminTournamentRow[]> {
  let query = supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('org_id', orgId)
    .order('year', { ascending: false });

  if (assignedTournamentIds !== null) {
    query = query.in('id', assignedTournamentIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // The event header's chip follows the board's game-day rule (Tournament admin redesign G1): the
  // dates, OR the first game having started. The second half needs games, so it is read here, once,
  // for the ACTIVE events only (the only status the phase splits) — a few rows, never the org's history.
  const rows = (data ?? []) as Array<Record<string, unknown> & { id: string; status?: string | null }>;
  const activeIds = rows.filter(r => r.status === 'active').map(r => r.id);
  const started = new Set<string>();
  if (activeIds.length > 0) {
    const { data: games } = await supabaseAdmin
      .from('games')
      .select('tournament_id, status, game_date, game_time')
      .in('tournament_id', activeIds)
      .neq('status', 'cancelled');
    const now = tournamentNow();
    const byTournament = new Map<string, GameStartFact[]>();
    for (const g of (games ?? []) as Array<{ tournament_id: string; status: string | null; game_date: string | null; game_time: string | null }>) {
      const list = byTournament.get(g.tournament_id) ?? [];
      list.push({ status: g.status, date: g.game_date, time: g.game_time });
      byTournament.set(g.tournament_id, list);
    }
    for (const [id, list] of byTournament) {
      if (hasFirstGameStarted(list, now)) started.add(id);
    }
  }

  return rows.map(r => ({ ...r, first_game_started: started.has(r.id) }));
}

/** What the tournament provider starts from on a full load: the list, the remembered choice and the address's choice. The
 *  provider applies `chooseTournament` itself, so the server's paint and the browser's first render run the same code. */
export type AdminTournamentSeed = {
  rows: AdminTournamentRow[];
  savedId: string | null;
  urlId: string | null;
  urlSlug: string | null;
};

/**
 * The seed for the admin layout, or undefined (the provider then reads in the browser, as it always did). Asks with the
 * SAME auth call and options as the list route, so a person the route would refuse (no membership, a cancelled
 * organization) gets no seed rather than a list the browser's read would then take away. Never throws (the billing
 * rail's throw for a cancelled organization included, `tests/unit/org-billing-access-guard.test.ts`): this runs in every
 * tournament page's layout, and a failed read must cost only the head start.
 */
export function readAdminTournamentSeed(
  orgSlug: string,
  search: string | null,
): Promise<AdminTournamentSeed | undefined> {
  return readSeed(orgSlug, search).catch(error => {
    // A cancelled organization's refusal is expected (its admin is sent to the billing page), not a failure to report.
    if (!(error instanceof OrgBillingSuspendedError)) {
      console.error('[admin-tournament-list] first-paint read failed; the browser will read', error);
    }
    return undefined;
  });
}

/** An id or slug from a cookie or the address, or null: only ever looked up in the scoped list, and capped so an
 *  oversized query never rides into the page's props. */
const asKey = (v: string | null | undefined) => (v && v.length <= 200 ? v : null);

async function readSeed(orgSlug: string, search: string | null): Promise<AdminTournamentSeed | undefined> {
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx || ctx.org.slug !== orgSlug) return undefined;
  const [rows, cookieStore] = await Promise.all([
    readAdminTournamentRows(ctx.org.id, ctx.assignedTournamentIds),
    cookies(),
  ]);
  const params = new URLSearchParams(search ?? '');
  return {
    rows,
    savedId: asKey(cookieStore.get(adminEventCookieName(orgSlug))?.value),
    urlId: asKey(params.get('tournamentId')),
    urlSlug: asKey(params.get('tournamentSlug')),
  };
}
