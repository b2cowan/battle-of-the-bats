/**
 * A BANK CHECK IN PROGRESS, KEPT FOR ITS PERSON (Bank check through a volunteer's eyes S7, plan
 * docs/projects/active/BANK_CHECK_NOVICE_UX_PLAN.md §0 A18, nine rulings 2026-11-22; table `bank_check_drafts`, mig 522,
 * /dba Finding #54). Client-safe: the shape both portals' cards and routes share, and the one reading of a request's body.
 * The server half is lib/bank-check-work-server.ts.
 *
 * ⚖ MINE ONLY (ruling 1): one person's work on one account. A colleague on the same account reads `ColleagueWork` only:
 *   who, which date, when it last changed. Never a balance, cash or a mark.
 * ⚖ 30 DAYS FROM THE LAST CHANGE (ruling 2): every keep restarts them; `BANK_CHECK_DRAFT_DAYS` is the rule's one home (the
 *   server stamps `expires_at` from it). In the last `BANK_CHECK_DRAFT_WARN_DAYS` the card names the end date in warn ink.
 * ⚖ KEYS, NEVER FIGURES: the date, the balance and cash as typed, the marked lines' KEYS and the "Started off by" anchor.
 *   A mark comes back only as a line the books offer now (`keepOffered` in lib/bank-check-draft.ts).
 */
import type { StartedAnchor } from './bank-check-draft';

export const BANK_CHECK_DRAFT_DAYS = 30;
export const BANK_CHECK_DRAFT_WARN_DAYS = 7;
export const BANK_CHECK_DRAFT_MAX_MARKS = 500;
const TEXT_MAX = 32;
const KEY_MIN = 3;
const KEY_MAX = 200;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** What the card keeps: the statement's date, the balance (and the coach's cash) as typed, the marks, the anchor. */
export interface CheckWork {
  date: string;
  balance: string;
  /** The coach card's cash not deposited yet, as typed; absent when not typed (always absent on a club account). */
  cash?: string;
  /** The marked lines' keys, in the order marked. */
  marked: string[];
  started: StartedAnchor | null;
}

/** The person's own work as the server holds it. */
export interface SavedWork extends CheckWork {
  /** The compare-and-swap token: a keep names the revision it read, and another device's newer keep refuses it. */
  revision: number;
  /** The day it last changed (YYYY-MM-DD, the club's day): "Picked up where you left off · last worked on {date}". */
  changedOn: string;
  /** The last day it is kept (YYYY-MM-DD, the club's day): the Save for later notice and the last-7-days line. */
  endsOn: string;
}

/** A colleague's work on the same account: the quiet line's three facts, and nothing else (ruling 1). */
export interface ColleagueWork { name: string | null; date: string; changedOn: string }

/** The club's Account pill (ruling 3, 2+ accounts): which other account holds the person's saved work, for which date. */
export interface WorkElsewhere { accountId: string; date: string }

/** GET …/work: the person's own work on this account, the colleagues' quiet lines, and (club) their work elsewhere. */
export interface WorkRead { mine: SavedWork | null; colleagues: ColleagueWork[]; elsewhere?: WorkElsewhere[] }

/** The refusals a work route answers (the card says each on itself: a failed keep never reads as kept, ruling 4). */
export type WorkRefusal = 'bad_work' | 'work_changed';

/** Something worth keeping: a balance or cash typed, or a line marked (lib/bank-check-draft's rule, the same one). */
export const isWorkWorthKeeping = (w: Pick<CheckWork, 'balance' | 'cash' | 'marked'>): boolean =>
  w.balance.trim() !== '' || (w.cash ?? '').trim() !== '' || w.marked.length > 0;

function isCalendarDay(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const isShortText = (v: unknown): v is string => typeof v === 'string' && v.length <= TEXT_MAX;

function readAnchor(v: unknown): StartedAnchor | null | undefined {
  if (v === null || v === undefined) return null;
  const a = v as Partial<StartedAnchor>;
  if (typeof a !== 'object' || !isCalendarDay(a.date) || !isShortText(a.balance)
    || !Number.isSafeInteger(a.differenceCents)) return undefined;
  return { date: a.date, balance: a.balance, differenceCents: a.differenceCents as number };
}

/**
 * A keep request's body: `{ work: CheckWork, revision: number | null }`. `revision` is null for the first keep (Start)
 * and the revision last read otherwise. Anything malformed is `null` (the route answers `bad_work`): a date that is not a
 * calendar day, text past 32 characters, a key outside 3–200 characters, a repeated key, more than 500 marks.
 */
export function readWorkBody(body: Record<string, unknown>): { work: CheckWork; revision: number | null } | null {
  const w = body.work as Partial<CheckWork> | undefined;
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
  const revision = body.revision === null || body.revision === undefined ? null : body.revision;
  if (revision !== null && !(Number.isSafeInteger(revision) && (revision as number) >= 1)) return null;
  if (!isCalendarDay(w.date) || !isShortText(w.balance)) return null;
  if (w.cash !== undefined && w.cash !== null && !isShortText(w.cash)) return null;
  if (!Array.isArray(w.marked) || w.marked.length > BANK_CHECK_DRAFT_MAX_MARKS) return null;
  if (!w.marked.every(k => typeof k === 'string' && k.length >= KEY_MIN && k.length <= KEY_MAX)) return null;
  if (new Set(w.marked).size !== w.marked.length) return null;
  const started = readAnchor(w.started);
  if (started === undefined) return null;
  const cash = typeof w.cash === 'string' && w.cash.trim() !== '' ? w.cash : undefined;
  return {
    work: { date: w.date, balance: w.balance, ...(cash ? { cash } : {}), marked: [...w.marked], started },
    revision: revision as number | null,
  };
}

/** Days left until `endsOn`, counting today as one of them (the last day reads 1). Null when either day is malformed. */
export function daysLeft(endsOn: string, today: string): number | null {
  if (!isCalendarDay(endsOn) || !isCalendarDay(today)) return null;
  const ms = Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** In the last 7 days (ruling 2): the card's line under the heading names the end date again, in warn ink. */
export const inLastWeek = (endsOn: string, today: string): boolean => {
  const n = daysLeft(endsOn, today);
  return n !== null && n >= 1 && n <= BANK_CHECK_DRAFT_WARN_DAYS;
};
