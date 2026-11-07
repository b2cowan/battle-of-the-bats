import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { canWriteMoney } from './coach-capabilities';
import type { CoachTeamContext } from './coach-route-context';
import { moveRefused, type Moved } from './club-money-route';
import { tournamentToday } from './timezone';
import { bankRefusedAs, step } from './bank-club-steps';
import { checkView, readDay } from './bank-club-rules';
import { readTeamBank, teamAccountOf, teamCheckerRoles, TEAM_BANK_ACCOUNT_NAME, type TeamBankAccount } from './bank-coach-read';
import { coachSavePlan } from './bank-coach-rules';
import type { RepProgramYear } from './types';

/**
 * THE TEAM'S BANK STEPS (Bank balance check BC6b; plan §4, §9 BC6): what each route under
 * app/api/coaches/[orgSlug]/teams/[teamId]/bank/** does once its gate has passed — the live-season coach context
 * (`resolveLiveCoachTeamContext`: no live season, no answer) and money read or money write (B7). Every step reads the
 * team's working season fresh (lib/bank-coach-read.ts), decides with the pure rules (lib/bank-coach-rules.ts) and writes
 * through mig 447/450's functions, or, for the account itself, one plain row. A write answers with the bank read again,
 * so the screen shows the server's numbers (rule 6).
 * ⚖ Nothing here writes money (ask 1): no step touches the register, `accounting_entries` or a rep money table.
 * ⚖ D1 (owner 2026-11-06): the club never reads a coach's books. Nothing club-side imports this file
 *   (tests/unit/bank-coach-routes-guard.test.ts).
 * ⚖ The working season only: the season is the gate's, never the request's. A statement date is a DAY.
 * ⚖ WHAT THE DATABASE DOESN'T RE-CHECK FOR A TEAM (BC6a, plan §9 BC6 "For BC6b"): `bank_check_save`'s team branch knows no
 *   season and takes the books figure and the items as given, and keys the account on the org alone. So the account id is
 *   always the one `readTeamBank` found for this team (never the request's), and `coachSavePlan` runs on that fresh read on
 *   every save. ⚠ Not compare-and-swapped (a team has no start to hold): a register row added between the read and the
 *   step's lock saves the books as read; "Books now say" shows the difference on the next read.
 */

/** Who is asking, from the live-season gate. */
export interface TeamBankCaller { orgId: string; season: RepProgramYear; actorId: string; canWrite: boolean }

export const teamBankCaller = (r: CoachTeamContext & { programYear: RepProgramYear }): TeamBankCaller => ({
  orgId: r.ctx.org.id, season: r.programYear, actorId: r.ctx.user.id, canWrite: canWriteMoney(r.assignment.capabilities),
});

/** A `?date=` as a statement day: null when absent, `false` when given but not a day (the route answers `bad_date`). */
export function askedDay(req: Request): string | null | false {
  const asked = new URL(req.url).searchParams.get('date');
  return asked ? readDay(asked) ?? false : null;
}

/**
 * GET /bank[?date=] — the team's bank on its working season: the account (null before the first save), the season's name
 * and start (O5: "Statements from this season only, since {date}."), the saved checks of this season newest first (each
 * with its band, result, "Books now say" and who checked), the checked-through mark (ask 4), and with `date` the figure for
 * that day (Your books on D, Find, Q1's "From the {2025 Season}", Still waiting?, or the day's refusal). `canWrite`:
 * money write sees the form; money read sees the same figures and no save (K7).
 */
export async function teamBankView(c: TeamBankCaller, date: string | null) {
  const [read, roleOf] = await Promise.all([
    readTeamBank({ orgId: c.orgId, season: c.season, today: tournamentToday(), date }),
    // The printed check (BC8b): the plain read only — a statement day's figure read (as the coach types) draws no check.
    date === null ? teamCheckerRoles(c.orgId, c.season.teamId) : Promise.resolve(() => null),
  ]);
  return {
    account: read.account,
    canWrite: c.canWrite,
    season: { name: c.season.name, start: read.seasonStart },
    // Who checked, with their word on the team's staff list as it reads today (null on a day's figure read).
    checks: read.checks.map(ch => ({ ...checkView(ch, read.nameOf), checkedByRole: roleOf(ch.createdBy) })).reverse(),
    checkedThrough: read.latest,
    figure: read.figure,
  };
}

/** A write step's answer: its refusal, or the bank read again. */
export async function teamBankAnswer(c: TeamBankCaller, r: Moved<object>, status = 200): Promise<Response> {
  if (!r.ok) return moveRefused(r);
  return NextResponse.json(await teamBankView(c, null), { status });
}

/**
 * The team's account, made at its first save (§9 BC6: no setup question, named "Team bank account"). A first save racing
 * another (`bank_accounts_one_per_team`) uses the account the other made, never a 500 (BC6a "For BC6b").
 */
async function openTeamAccount(c: TeamBankCaller): Promise<TeamBankAccount> {
  const { data, error } = await supabaseAdmin.from('bank_accounts')
    .insert({ org_id: c.orgId, owner_kind: 'team', team_id: c.season.teamId, name: TEAM_BANK_ACCOUNT_NAME, created_by: c.actorId })
    .select('id, name').single();
  if (!error) return data as TeamBankAccount;
  if (error.code === '23505' && /bank_accounts_one_per_team/.test(`${error.message ?? ''} ${error.details ?? ''}`)) {
    const made = await teamAccountOf(c.orgId, c.season.teamId);
    if (made) return made;
  }
  throw error;
}

/**
 * POST /bank/checks { date, bankCents, cashCents?, waiting?: [lineKey…] } — save a check (ruling 3: matching or not). The
 * server figures Your books on D and reads each Not in the bank yet line from this team's own register (rule 6). A live
 * check of the same date is replaced ("Check this statement again"; the old one's who and when are kept). Refused after
 * the club's today (`ends_in_future`), before the season's start (`before_season`), with a line that isn't one of this
 * team's (`bad_team_item`). The account is made only once the plan passes, so a first save the plan refuses makes
 * nothing. (/review BC6b: a save the STEP still refuses after the insert — a race, an outage — leaves the account with no
 * check; the next save uses it, and the view reads it as no check yet. A season closed between the gate and the step
 * still saves: the step knows no season. Both accepted, plan §9 BC6.)
 */
export async function saveTeamCheck(c: TeamBankCaller, body: Record<string, unknown>): Promise<Moved<{ id: string }>> {
  const date = readDay(body.date);
  if (!date) return bankRefusedAs('bad_figures');
  const read = await readTeamBank({ orgId: c.orgId, season: c.season, today: tournamentToday(), date });
  // A refused day reads no facts (`coachFigureOn`): its refusal is the figure's.
  if (!read.facts) return bankRefusedAs(read.figure?.refused ?? 'bad_date');
  const plan = coachSavePlan({ date, body, facts: read.facts });
  if (!plan.ok) return bankRefusedAs(plan.code);
  const account = read.account ?? await openTeamAccount(c);
  const a = plan.args;
  // A team: no book ids, no on its way, no start (the step refuses any of them for a team account).
  const r = await step('bank_check_save', {
    p_org: c.orgId, p_account: account.id, p_kind: a.kind, p_date: a.date, p_bank_cents: a.bankCents,
    p_books_cents: a.booksCents, p_on_its_way_cents: a.onItsWayCents, p_cash_cents: a.cashCents, p_book_ids: a.bookIds,
    p_waiting: a.waiting, p_start: null, p_start_books: null, p_actor: c.actorId,
  }, { bad_item: 'bad_team_item' });
  return r.ok ? { ok: true, id: r.data.id as string } : r;
}

/**
 * DELETE /bank/checks/{checkId} — ask 5: a check of the WORKING season, after one question on the screen (BC7). Its
 * figures go from the list; who deleted it and when are kept (a soft delete). A closed season's check is not on the
 * working view (B10), so it is "not found" here too.
 */
export async function deleteTeamCheck(c: TeamBankCaller, checkId: string): Promise<Moved<object>> {
  const read = await readTeamBank({ orgId: c.orgId, season: c.season, today: tournamentToday() });
  if (!read.account || !read.checks.some(ch => ch.id === checkId)) return bankRefusedAs('check_not_found');
  const r = await step('bank_check_delete', { p_org: c.orgId, p_account: read.account.id, p_check: checkId, p_actor: c.actorId });
  return r.ok ? { ok: true } : r;
}
