import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { resolvePersonNamer } from './db';
import { loadSeasonRegisterRows } from './coach-register-book';
import { toCents } from './coach-register';
import { orgDayKey } from './timezone';
import { CHECK_SELECT, WAITING_SELECT, savedChecksOf, type CheckRow, type WaitingRow } from './bank-club-map';
import {
  checksBetween, checksInSeason, coachChecksNow, coachLinesOf, needsLastSeason, seasonStartOf, type LastSeason, type TeamSavedCheck,
} from './bank-coach-map';
import { coachCheckedThrough, coachFigureOn, coachSaveRefusal } from './bank-coach-rules';
import type { RepProgramYear } from './types';

/**
 * THE COACH'S BANK READER (Bank balance check BC6a; plan §4, §9 BC6). Server only; the client never supplies a line or a
 * figure (rule 6). A team's read is: its one bank account (none until the first save, BC6b), the working season's live
 * checks with "Books now say" re-figured over the working season's register, the checked-through mark, and — for a
 * statement date D — Your books on D, Find (ask 3, Q1), Still waiting? (ask 2) and the lines a save may mark.
 *
 * ⚖ D1 (owner 2026-11-06): the club never reads a coach's books. Nothing club-side imports this file (BC6b pins it); it is
 *   handed a team and its working season by a coach route that has already gated the coach.
 * ⚖ THE WORKING SEASON ONLY (CLAUDE.md's coaches-portal season rule): the caller passes the live season it resolved; this
 *   file never takes a year. Q1's look-back and the crossing Still waiting? read LAST season — the one the opening cash was
 *   carried from (`opening_balance_from_year_id`), found by this file from the working season's own row, never named by
 *   the page — and only its lines and its final check's open items, which reach the screen as lines under "From the
 *   {2025 Season}". BC6b records that read as the decision it is (`HISTORY_ENDPOINTS` unchanged).
 *
 * BOUNDED READS: the account and its live checks are ONE query each (a team account holds about a dozen checks a season,
 * read whole as `readClubChecks` reads a club's; the season filter is the pure `checksInSeason`); the working season's
 * register is read once (`loadSeasonRegisterRows`, the Ledger's own reader) and serves the books on every date, Books now
 * say and Find; last season's register is read only for a day `needsLastSeason` says needs it (no matched working check
 * before it, or Still waiting? asking about one of last season's lines), and never for a refused day.
 * ⚠ KNOWN EDGES OF O5 (BC6a /review, recorded in plan §9 BC6): the season's start is figured, not stored, so (1) a first
 *   season's start follows its earliest money line — deleting that line moves the start later and a check dated before
 *   the new start leaves the list (it stays in the table); (2) a check of the old season dated the rollover day itself
 *   reads as the new season's first check.
 * ⚖ A FAILED READ THROWS: on the Bank view the bank IS the page (any quiet mark elsewhere is BC8's).
 * ⚠ `loadSeasonRegisterRows` reads several of its sources without checking the error (a failed fundraiser, sponsor or club
 *   request read is no rows): the Ledger and Start next season's carry share that exposure; a check saved during such a
 *   failure keeps a wrong Your books (Books now say shows it on the next read). Flagged to the owner 2026-11-06, not changed
 *   here (a shared module's behaviour).
 */

/** The name a team's one account is created with at the first save (§9 BC6: no setup question). */
export const TEAM_BANK_ACCOUNT_NAME = 'Team bank account';

export interface TeamBankAccount { id: string; name: string }

/** The team's live bank account in its club, or null (none until the first save). */
async function teamAccountOf(orgId: string, teamId: string): Promise<TeamBankAccount | null> {
  const { data, error } = await supabaseAdmin.from('bank_accounts').select('id, name')
    .eq('org_id', orgId).eq('owner_kind', 'team').eq('team_id', teamId).is('archived_at', null).maybeSingle();
  if (error) throw error;
  return (data as TeamBankAccount | null) ?? null;
}

/** Every LIVE check of the team's account, every season, with its waiting items, oldest first — one query, by the
 *  account's own id (`teamAccountOf` scoped it; BC6a /review: never an embedded filter, which a mistyped embed drops). */
async function teamChecksOf(accountId: string): Promise<TeamSavedCheck[]> {
  const rows = await fetchAll<CheckRow & { bank_check_waiting: Omit<WaitingRow, 'check_id'>[] }>((a, b) => supabaseAdmin.from('bank_checks')
    .select(`${CHECK_SELECT}, bank_check_waiting(${WAITING_SELECT})`)
    .eq('bank_account_id', accountId).is('deleted_at', null)
    .order('statement_end_date').order('id').range(a, b));
  const waiting: WaitingRow[] = rows.flatMap(r => (r.bank_check_waiting ?? []).map(w => ({ ...w, check_id: r.id })));
  return savedChecksOf(rows, waiting);
}

interface SeasonRow { id: string; name: string; created_at: string; opening_balance_from_year_id: string | null; credit_application: RepProgramYear['creditApplication'] }

/** The season the working season's cash was carried from — this team's own, or null (no carry). */
async function carriedFromOf(season: RepProgramYear): Promise<SeasonRow | null> {
  if (!season.openingBalanceFromYearId) return null;
  const { data, error } = await supabaseAdmin.from('rep_program_years')
    .select('id, name, created_at, opening_balance_from_year_id, credit_application')
    .eq('id', season.openingBalanceFromYearId).eq('team_id', season.teamId).maybeSingle();
  if (error) throw error;
  return (data as SeasonRow | null) ?? null;
}

/** Last season as Find reads it (Q1): its lines, its start (O5, the same rule), its checks before the working start. */
async function lastSeasonOf(row: SeasonRow, teamId: string, checks: readonly TeamSavedCheck[], workingStart: string): Promise<LastSeason> {
  const rows = await loadSeasonRegisterRows({ id: row.id, creditApplication: row.credit_application }, teamId);
  const lines = coachLinesOf(rows);
  const start = seasonStartOf({ createdDay: orgDayKey(row.created_at), carried: !!row.opening_balance_from_year_id }, lines);
  return { name: row.name, start, lines, checks: checksBetween(checks, start, workingStart) };
}

/**
 * A team's bank on its working season: the account (null before the first save), the season's start (O5), its live
 * checks with Books now say, the checked-through mark, who checked, and (with `date`) the figure for that day and the
 * facts a save on it stands on (null when the day is refused). `today` is the club's day, the server's (rule 6).
 */
export async function readTeamBank(i: { orgId: string; season: RepProgramYear; today: string; date?: string | null }) {
  // The team is the season's (BC6a /review: one source, so the account and the register can't be two teams').
  const teamId = i.season.teamId;
  const [account, rows, carriedFrom] = await Promise.all([
    teamAccountOf(i.orgId, teamId),
    loadSeasonRegisterRows(i.season, teamId),
    i.date ? carriedFromOf(i.season) : Promise.resolve(null),
  ]);
  const all = account ? await teamChecksOf(account.id) : [];
  const lines = coachLinesOf(rows);
  const seasonStart = seasonStartOf({ createdDay: orgDayKey(i.season.createdAt), carried: !!i.season.openingBalanceFromYearId }, lines);
  const openingCents = toCents(i.season.openingBalance ?? 0);
  const working = checksInSeason(all, seasonStart);
  // A refused day shows no Find and no Still waiting?, so it reads nothing of last season.
  const wantsLast = !!i.date && !!carriedFrom && coachSaveRefusal({ date: i.date, today: i.today, seasonStart }) === null
    && needsLastSeason(working, i.date, lines);

  const [last, nameOf] = await Promise.all([
    wantsLast ? lastSeasonOf(carriedFrom!, teamId, all, seasonStart) : Promise.resolve(null),
    resolvePersonNamer(i.orgId, working.map(c => c.createdBy)),
  ]);
  const day = i.date
    ? coachFigureOn({ date: i.date, today: i.today, seasonStart, openingCents, rows, lines, checks: working, last })
    : null;
  return {
    account,
    seasonStart,
    checks: coachChecksNow(working, rows, openingCents),
    latest: coachCheckedThrough(working, seasonStart),
    figure: day?.figure ?? null,
    facts: day?.facts ?? null,
    nameOf,
  };
}
