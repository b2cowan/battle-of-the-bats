/**
 * THE COACH'S BANK VIEW — its reads and writes (Bank balance check BC7a; routes BC6b,
 * app/api/coaches/[orgSlug]/teams/[teamId]/bank/**). What the screen reads is the server's own answer (the route's return
 * type, never a restatement); a write answers with the bank read again, so the screen draws the server's numbers (rule 6).
 * ⚠ `teamBankView` is server-only: imported here as a TYPE only (erased at build).
 * ⚠ No live season: every verb answers 409 `season_not_live`. The portal's one watcher (lib/season-refusal-watch.ts) says
 *   it page-wide; this screen shows the server's sentence where the action was, like any refusal.
 * Client-safe.
 */
import type { teamBankView } from '@/lib/bank-coach-steps';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';

export type TeamBank = Awaited<ReturnType<typeof teamBankView>>;
export type TeamCheck = TeamBank['checks'][number];
export type TeamFigure = NonNullable<TeamBank['figure']>;

/** A coach bank route (`path` '' | '/checks' | '/checks/{id}'), optionally for a statement day. */
export function coachBankUrl(orgSlug: string, teamId: string, path = '', date?: string): string {
  const base = `/api/coaches/${encodeURIComponent(orgSlug)}/teams/${encodeURIComponent(teamId)}/bank${path}`;
  return date ? `${base}?date=${encodeURIComponent(date)}` : base;
}

/** A read or a write's answer: the bank read (the server's numbers), or its coded refusal in words. */
export type BankAnswer =
  | { ok: true; view: TeamBank }
  | { ok: false; code: string | null; error: string };

async function answer(url: string, init: RequestInit | undefined, fallback: string): Promise<BankAnswer> {
  try {
    const r = await moneyFetch<Record<string, unknown>>(url, init);
    // An unreadable body is a failure, never a bank read (/review: `moneyFetch` makes one `{}`).
    if (r.ok && Array.isArray(r.data.checks)) return { ok: true, view: r.data as unknown as TeamBank };
    if (r.ok) return { ok: false, code: null, error: `${fallback} Please try again.` };
    const code = typeof r.data.code === 'string' ? r.data.code : null;
    return { ok: false, code, error: refusalText(r.data, `${fallback} Please try again.`) };
  } catch {
    return { ok: false, code: null, error: `${fallback} ${W.connection}` };
  }
}

/** GET the team's bank (with `date`, the figure for that statement day). */
export const readTeamBank = (orgSlug: string, teamId: string, date?: string, fallback: string = W.coachLoadFailed): Promise<BankAnswer> =>
  answer(coachBankUrl(orgSlug, teamId, '', date), undefined, fallback);

/** POST a check: the screen sends INTENT (the date, the typed balance, the cash, the marked lines' KEYS); every figure is
 *  the server's read of the books. */
export const saveTeamCheck = (orgSlug: string, teamId: string,
  body: { date: string; bankCents: number; cashCents?: number; waiting: string[] }): Promise<BankAnswer> =>
  answer(coachBankUrl(orgSlug, teamId, '/checks'), jsonInit('POST', body), W.saveFailed);

/** DELETE a saved check (soft: who and when are kept, ask 5). */
export const deleteTeamCheck = (orgSlug: string, teamId: string, checkId: string): Promise<BankAnswer> =>
  answer(coachBankUrl(orgSlug, teamId, `/checks/${encodeURIComponent(checkId)}`), jsonInit('DELETE', {}), W.deleteFailed);
