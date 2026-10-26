/**
 * TEAMS & DRAFT'S READ AND WRITES (Club Tier Stage 9c, Part 3). One board read; every press goes through `send`, so a
 * refusal is always the server's sentence and its code (`published`: ask first; `confirm`: the held window; `changed`:
 * the window is stale), and a failure to reach the server is the one "That didn't go through" line.
 */
import { moneyFetch, refusalText } from '@/components/admin/kit/club/money/MoneyKit';
import { MONEY_REFUSAL } from '@/lib/house-league-money-words';
import { clubDay } from '@/lib/league-registration-state';
import { orgDayKey } from '@/lib/timezone';
import type { DivisionBoard, DivisionTab } from '@/lib/house-league-teams';

export type { BoardCoach, BoardLeft, BoardPlayer, BoardTeam, DivisionBoard, DivisionTab } from '@/lib/house-league-teams';

export interface BoardRead {
  tabs: DivisionTab[];
  board: DivisionBoard | null;
  /** Present only for a reader the gate lets see ratings (9c·2a). */
  ratings?: Record<string, number>;
  /** The families' sign-up notes: present only for a reader who can open registrations (A8). */
  notes?: Record<string, string>;
}

export type Sent<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string | null; error: string };

export async function send<T = Record<string, unknown>>(
  url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown,
): Promise<Sent<T>> {
  try {
    const init: RequestInit = body === undefined
      ? { method }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await moneyFetch<T & { code?: string }>(url, init);
    if (r.ok) return { ok: true, data: r.data };
    return { ok: false, status: r.status, code: r.data.code ?? null, error: refusalText(r.data, MONEY_REFUSAL.failed) };
  } catch {
    return { ok: false, status: 0, code: null, error: MONEY_REFUSAL.failed };
  }
}

/** The routes, under one season, each carrying the page's `?orgSlug=` (the org-slug caller check reads that name). */
export function teamsRoutes(seasonId: string, orgQuery: string) {
  const base = `/api/admin/house-league/seasons/${seasonId}`;
  const q = orgQuery;
  const join = (path: string, extra = '') => `${base}${path}${q}${extra ? `${q ? '&' : '?'}${extra}` : ''}`;
  return {
    board: (divisionId: string | null) => join('/teams-board', divisionId ? `divisionId=${encodeURIComponent(divisionId)}` : ''),
    season: join(''),
    draft: join('/draft'),
    placement: join('/placement'),
    ratings: join('/ratings'),
    publish: join('/publish'),
    teams: join('/teams'),
    team: (teamId: string) => join(`/teams/${teamId}`),
    coaches: (teamId: string, coachId?: string) => join(`/teams/${teamId}/coaches`, coachId ? `coachId=${encodeURIComponent(coachId)}` : ''),
  };
}
export type TeamsRoutes = ReturnType<typeof teamsRoutes>;

/** "Oct 25" for an instant, read in the CLUB's day (a publish at 9 p.m. is that day, not tomorrow's UTC date). */
export const dayOf = (iso: string) => clubDay(orgDayKey(iso));
