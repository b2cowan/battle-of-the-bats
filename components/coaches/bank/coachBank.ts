/**
 * THE COACH'S BANK VIEW — its reads and writes (Bank balance check BC7a; routes BC6b,
 * app/api/coaches/[orgSlug]/teams/[teamId]/bank/**). What the screen reads is the server's own answer (the route's return
 * type, never a restatement); a write answers with the bank read again, so the screen draws the server's numbers (rule 6).
 * ⚠ `teamBankView` is server-only: imported here as a TYPE only (erased at build).
 * ⚠ No live season: every verb answers 409 `season_not_live`. The portal's one watcher (lib/season-refusal-watch.ts) says
 *   it page-wide; this screen shows the server's sentence where the action was, like any refusal.
 * Client-safe.
 */
import { useEffect, useState } from 'react';
import type { teamBankView } from '@/lib/bank-coach-steps';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear } from '@/lib/bank-screen';

export type TeamBank = Awaited<ReturnType<typeof teamBankView>>;
export type TeamCheck = TeamBank['checks'][number];
export type TeamFigure = NonNullable<TeamBank['figure']>;

/** A coach bank route (`path` '' | '/checks' | '/checks/{id}'), optionally for a statement day. */
export function coachBankUrl(orgSlug: string, teamId: string, path = '', date?: string): string {
  const base = `/api/coaches/${encodeURIComponent(orgSlug)}/teams/${encodeURIComponent(teamId)}/bank${path}`;
  return date ? `${base}?date=${encodeURIComponent(date)}` : base;
}

/** The Bank view's address (`Money → Ledger → View: Bank`) opened on one saved check: `?bankCheck={id}` (the Overview's
 *  amber chip, BC8a). The key is CoachBankView's room address — a literal there, so the hub's
 *  ONE_SHOT_KEYS guard sees it (tests/unit/room-address-keys-guard.test.ts); the view consumes it once it has opened it. */
export function bankCheckHref(bankViewHref: string, checkId: string): string {
  return `${bankViewHref}${bankViewHref.includes('?') ? '&' : '?'}bankCheck=${encodeURIComponent(checkId)}`;
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

/** The season windows' bank sentence: `off` is a warning (amber, in the windows' warnings); a match is a plain line. */
export interface SeasonBankNote { text: string; off: boolean }

/**
 * Start next season / Close the season's bank sentence (BC8a; K6, R0 tab 7), from the season's latest check, or null.
 * ⚖ Only when the season has a check (owner BC8a: a team that never used the bank check is not nagged about it), whatever
 *   its date. ⚖ Off or matching (owner BC8b 2026-11-07): an off check says so, a warning; a matching one is a plain line.
 * Warn, never block: nothing here touches the roll or the close.
 * ⚠ QUIET, read when the window OPENS (the windows' own preflight rule): a read that fails says nothing.
 */
export function useSeasonBankWarning(orgSlug: string, teamId: string, verb: 'start' | 'close'): SeasonBankNote | null {
  const [through, setThrough] = useState<TeamBank['checkedThrough']>(null);
  useEffect(() => {
    let current = true;
    void readTeamBank(orgSlug, teamId).then(r => {
      if (current && r.ok && r.view.checkedThrough) setThrough(r.view.checkedThrough);
    });
    return () => { current = false; };
  }, [orgSlug, teamId]);
  if (!through) return null;
  return through.result === 'off'
    ? { off: true, text: W.coachSeasonOff(cents(through.offByCents), dayYear(through.date), verb) }
    : { off: false, text: W.coachSeasonMatches(dayYear(through.date), verb) };
}

/** POST a check: the screen sends INTENT (the date, the typed balance, the cash, the marked lines' KEYS); every figure is
 *  the server's read of the books. */
export const saveTeamCheck = (orgSlug: string, teamId: string,
  body: { date: string; bankCents: number; cashCents?: number; waiting: string[] }): Promise<BankAnswer> =>
  answer(coachBankUrl(orgSlug, teamId, '/checks'), jsonInit('POST', body), W.saveFailed);

/** DELETE a saved check (soft: who and when are kept, ask 5). */
export const deleteTeamCheck = (orgSlug: string, teamId: string, checkId: string): Promise<BankAnswer> =>
  answer(coachBankUrl(orgSlug, teamId, `/checks/${encodeURIComponent(checkId)}`), jsonInit('DELETE', {}), W.deleteFailed);
