import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { refused, type Refused } from './club-money-route';
import {
  closedThrough, fiscalYearOf, readFiscalYearParam,
  type FiscalSetting, type FiscalYear, type FiscalYearRead, type FiscalYearRow,
} from './club-fiscal-year';
import { planClosedWords, recordedInClosedYearWords, yearClosedWords } from './club-money-words';
import { addCalendarDays, isCalendarDate } from './timezone';
import { resolvePersonNamer } from './db';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S FISCAL YEAR, ON THE SERVER (Club Tier Stage 3c; mig 318). The definition is
 * lib/club-fiscal-year.ts (pure); this reads the rows it needs and turns THE LOCK into one refusal.
 *
 * ⚖ THE LOCK'S ONE REFUSAL (call 2): 409 `{ error, code: 'year_closed', year: { key, name, firstDay,
 * lastDay }, reopen: { key, name } | null, nextDay }`. `reopen` is the year Reopen would unlock — only the
 * LATEST closed year can be reopened (Ask 3), and only by someone who can move the club's money — so the
 * screen can say both ways out: date it `nextDay` or later, or reopen. Every route that writes a line on a
 * club-owned book checks FIRST (`refuseIfClosed`) and says it in words; the database's triggers are the
 * floor, and a write that reaches them anyway (a race) is answered the same way (`closedYearFromError`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The club's first month and its fiscal-year rows (oldest first). */
export async function loadFiscalSetting(orgId: string): Promise<FiscalSetting> {
  const [org, rows] = await Promise.all([
    supabaseAdmin.from('organizations').select('fiscal_first_month').eq('id', orgId).single(),
    supabaseAdmin.from('org_fiscal_years')
      .select('id, name, first_day, last_day, closed_at, closed_by, closing_balance')
      .eq('org_id', orgId).order('first_day'),
  ]);
  if (org.error) throw org.error;
  if (rows.error) throw rows.error;
  return {
    firstMonth: Number(org.data.fiscal_first_month ?? 1),
    rows: (rows.data ?? []).map((r): FiscalYearRow => ({
      id: r.id, name: r.name, firstDay: r.first_day, lastDay: r.last_day,
      closedAt: r.closed_at ?? null, closedBy: r.closed_by ?? null,
      closingBalance: r.closing_balance == null ? null : Number(r.closing_balance),
    })),
  };
}

/** The year a club money read is for: `?year=` (a year's first day, or an old bare number), else the year
 *  today falls in. */
export function fiscalYearForRequest(req: Request, setting: FiscalSetting, today: string): FiscalYear {
  const params = new URL(req.url).searchParams;
  // `?day=` — the fiscal year a DAY falls in (the Ledger's "Filed under" hint asks about an entry's date).
  const day = params.get('day');
  if (day && isCalendarDate(day)) return fiscalYearOf(day, setting);
  return readFiscalYearParam(params.get('year'), setting) ?? fiscalYearOf(today, setting);
}

export async function describeFiscalYear(
  orgId: string, year: FiscalYear, setting: FiscalSetting, today: string, canMove: boolean,
): Promise<FiscalYearRead> {
  const names = year.closed?.by ? await closerNames(orgId, setting) : {};
  return {
    ...year,
    closedByName: year.closed?.by ? names[year.closed.by] ?? null : null,
    current: fiscalYearOf(today, setting).key === year.key,
    canWrite: canMove && !year.locked,
  };
}

/** A read's year and the club's setting, together. */
export async function resolveFiscalYear(req: Request, orgId: string, today: string): Promise<{ setting: FiscalSetting; year: FiscalYear }> {
  const setting = await loadFiscalSetting(orgId);
  return { setting, year: fiscalYearForRequest(req, setting, today) };
}

/** Who closed each closed year, by name (the "closed by / on" line): user id → name. */
export async function closerNames(orgId: string, setting: FiscalSetting): Promise<Record<string, string>> {
  const ids = setting.rows.map(r => r.closedBy).filter((x): x is string => !!x);
  if (ids.length === 0) return {};
  const nameOf = await resolvePersonNamer(orgId, ids);
  return Object.fromEntries(ids.map(id => [id, nameOf(id) ?? 'Someone']));
}

/** The year Reopen would unlock: the latest closed year, when this person can move the club's money. */
function reopenable(setting: FiscalSetting, canMove: boolean): FiscalYear | null {
  const through = closedThrough(setting);
  if (!through || !canMove) return null;
  const latest = setting.rows.find(r => r.closedAt && r.lastDay === through);
  return latest ? fiscalYearOf(latest.firstDay, setting) : null;
}

/** What a closed-year refusal says, and the figures the screen reads beside it. */
function closedRefusal(
  setting: FiscalSetting, day: string, canMove: boolean, kind: 'date' | 'recorded' | 'plan',
): Refused {
  const year = fiscalYearOf(day, setting);
  const through = closedThrough(setting)!;
  const nextDay = addCalendarDays(through, 1);
  const open = reopenable(setting, canMove);
  // Reopen unlocks the date only when the date is IN the latest closed year.
  const reopen = open && day >= open.firstDay && day <= open.lastDay ? open : null;
  const error = kind === 'date'
    ? yearClosedWords({ day, year: year.name, nextDay, reopen: reopen?.name ?? null })
    : kind === 'plan' ? planClosedWords(year.name, reopen?.name ?? null)
    : recordedInClosedYearWords(year.name, reopen?.name ?? null);
  return refused(409, {
    error, code: 'year_closed',
    year: { key: year.key, name: year.name, firstDay: year.firstDay, lastDay: year.lastDay },
    reopen: reopen ? { key: reopen.key, name: reopen.name } : null,
    nextDay,
  });
}

/**
 * THE ROUTES' CHECK: is any of these days inside the club's closed stretch? Each day is a line's date, old or
 * new (an edit checks both; a move between two days checks both). `kind` picks the words: a NEW date
 * ('date' — "Date it Sep 1 or later"), an existing record ('recorded' — Undo, Reverse, Void, an edit), or a
 * plan line ('plan').
 */
export function refuseIfClosed(
  setting: FiscalSetting,
  days: readonly (string | null | undefined)[],
  opts: { canMove: boolean; kind?: 'date' | 'recorded' | 'plan' },
): Refused | null {
  const through = closedThrough(setting);
  if (!through) return null;
  const hit = days.find((d): d is string => !!d && d <= through);
  return hit ? closedRefusal(setting, hit, opts.canMove, opts.kind ?? 'date') : null;
}

/** `refuseIfClosed` for a route that has only the org: the setting read here. Every caller passed the write gate
 *  (`canMoveClubMoney`), so Reopen is theirs to offer. */
export async function refuseIfClosedFor(
  orgId: string, days: readonly (string | null | undefined)[], kind: 'date' | 'recorded' | 'plan' = 'date',
): Promise<Refused | null> {
  if (!days.some(Boolean)) return null;
  return refuseIfClosed(await loadFiscalSetting(orgId), days, { canMove: true, kind });
}

/** A plan line's (or an allocation's) fiscal year, locked? */
export function refuseIfYearLocked(setting: FiscalSetting, year: FiscalYear, canMove: boolean): Refused | null {
  return year.locked ? closedRefusal(setting, year.firstDay, canMove, 'plan') : null;
}

/** The database's floor answered `year_closed` (a write that raced a close): the same refusal, re-read. */
export function isClosedYearError(e: unknown): boolean {
  const msg = (e as { message?: string } | null)?.message ?? '';
  return /\byear_closed\b/.test(msg);
}

/** Every caller passed the write gate (`canMoveClubMoney`), so Reopen is theirs to offer. */
export async function closedYearFromError(
  orgId: string, days: readonly (string | null | undefined)[],
): Promise<Refused> {
  const setting = await loadFiscalSetting(orgId);
  return refuseIfClosed(setting, days, { canMove: true, kind: 'recorded' })
    ?? refused(409, { error: recordedInClosedYearWords('That fiscal year', null), code: 'year_closed', year: null, reopen: null, nextDay: null });
}
