import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { canOpenModule, canOpenRepMoney } from './member-access';
import { canHouseLeague } from './house-league-access';
import { canOpenFamilies } from './families-access';
import { getBookTotals, getClubOwnedLedgers, getLeagueSeasons, getRegistrationsForSeason } from './db';
import { clubCashOnHand, owedByTheTeams } from './club-money-figures';
import { loadClubLoop } from './club-money-reads';
import { allocationsOf } from './club-budget-read';
import { loadFiscalSetting } from './club-fiscal-year-server';
import { teamIdsInScope } from './club-team-route';
import { seasonMoney } from './league-money';
import { loadSeasonMoneyLines } from './league-money-read';
import { loadRegistrationDebits } from './league-pay-facts';
import { liveLeagueSeasons } from './house-league-season';
import { calendarPrograms, readClubCalendar } from './club-calendar';
import { listTeamsWithActiveHeadCoach } from './coach-membership';
import { clubFormsMissing } from './families-read';
import { addCalendarDays, tournamentToday } from './timezone';
import { planCarriesModule } from './module-entitlements';
import type { ClubBand, ClubBandPart } from './club-band-view';

/**
 * THE CLUB BAND's read (Club Tier Stage 13b, A1). Every figure is an EXISTING definition called, never re-derived (the
 * one-definition guard, and F-T2-4 / F-O6-5: the product already has two "Outstanding" figures; this adds no third):
 *
 *   Cash on hand      `clubCashOnHand` over the club's own books (never a team's) — the Accounting summary's own call, minus
 *                     the per-team register walk (the band never reads a coach's books: D1, owner 2026-11-06).
 *   Owed · teams      `owedByTheTeams` over the same allocations the summary reads (`allocationsOf`), the reader's team groups only.
 *   Owed · league     `seasonMoney(...).owing` for each LIVE season, exactly as the season's Money page reads it (clearing included),
 *                     summed. There is no org-wide house-league total anywhere else; this is the sum of per-season figures.
 *   This week         `readClubCalendar` over the next six weeks; the earliest booking that is on (state null).
 *   Needs someone     teams with no active head coach (`listTeamsWithActiveHeadCoach`, the setup checklist's own rule), the
 *                     house-league owing PLAYERS, and the club's missing forms (the Families list's rule, once per roster row).
 *
 * ⚖ Each part is read only for a reader who holds the gate of the page it opens. A part that throws is named in `failed`.
 */

const settle = async <T>(part: ClubBandPart, failed: ClubBandPart[], read: () => Promise<T>): Promise<T | undefined> => {
  try { return await read(); } catch { if (!failed.includes(part)) failed.push(part); return undefined; }
};

/** House league's Still owing, summed over the live seasons — each season's own figure (the Money page's), never a new query. */
async function leagueOwing(ctx: AuthContextWithRole): Promise<{ amount: number; players: number; firstSeasonId: string | null }> {
  const seasons = liveLeagueSeasons(await getLeagueSeasons(ctx.org.id));
  const per = await Promise.all(seasons.map(async season => {
    // The ledger read and the registration → debits chain are independent: start both, join once.
    const linesP = loadSeasonMoneyLines(ctx.org.id, season.id);
    const regs = await getRegistrationsForSeason(season.id);
    const [lines, debits] = await Promise.all([
      linesP, loadRegistrationDebits(ctx.org.id, regs.filter(r => r.status === 'active').map(r => r.id)),
    ]);
    const clearing = new Map(Object.entries(debits).filter(([, d]) => d.state === 'clearing').map(([id, d]) => [id, d.shareCents]));
    const m = seasonMoney(regs, season, lines, clearing);
    return { id: season.id, owing: m.owing, players: m.owingPlayers };
  }));
  return {
    amount: per.reduce((sum, s) => sum + Math.round(s.owing * 100), 0) / 100,
    players: per.reduce((sum, s) => sum + s.players, 0),
    firstSeasonId: (per.find(s => s.players > 0 || s.owing > 0) ?? per[0])?.id ?? null,
  };
}

export async function readClubBand(ctx: AuthContextWithRole, assignedTournamentIds: string[] | null): Promise<ClubBand> {
  const org = ctx.org;
  const today = tournamentToday();
  const failed: ClubBandPart[] = [];
  const band: ClubBand = { today, failed };

  // ── Gates: the gate of the page each part opens ──────────────────────────────────────────────────────────────────
  const seesBooks = canOpenModule(ctx, org, 'module_accounting');                  // Accounting (summary, Teams tab)
  const seesTeamsOwed = seesBooks && canOpenRepMoney(ctx, org);                    // Accounting › Teams
  const seesLeagueMoney = canHouseLeague(ctx, org, 'read');                        // the season's Money (house league)
  const seesCalendar = calendarPrograms(ctx, org).length > 0;
  const seesCoachGaps = canOpenModule(ctx, org, 'module_rep_teams') && planCarriesModule(org, 'module_rep_teams');
  const seesForms = canOpenFamilies(ctx, org) && planCarriesModule(org, 'module_rep_teams');
  // House league's money is read once, for whichever of its two lines the reader can open.
  const wantsLeagueMoney = (seesBooks || seesLeagueMoney) && planCarriesModule(org, 'module_house_league');

  const [cash, teamsOwed, league, week, coachGaps, forms] = await Promise.all([
    seesBooks ? settle('cash', failed, async () => {
      const ledgers = await getClubOwnedLedgers(org.id);
      const totals = await getBookTotals(ledgers.map(l => l.id));
      return { amount: clubCashOnHand(ledgers.map(l => ({ kind: l.entityType, balance: totals.get(l.id)?.balance ?? 0 }))), books: ledgers.length };
    }) : undefined,
    seesTeamsOwed ? settle('owed', failed, async () => {
      const [loop, setting, scope] = await Promise.all([loadClubLoop(org.id, null), loadFiscalSetting(org.id), teamIdsInScope(ctx)]);
      const allocations = await allocationsOf(org.id, loop, setting);
      const installments = allocations.flatMap(a => a.splits).filter(s => !scope || scope.has(s.teamId)).flatMap(s => s.installments);
      const owed = owedByTheTeams(installments, today);
      return { amount: owed.amount, overdue: owed.overdue.amount };
    }) : undefined,
    wantsLeagueMoney ? settle('owed', failed, () => leagueOwing(ctx)) : undefined,
    seesCalendar ? settle('week', failed, async () => {
      const read = await readClubCalendar(
        { org, member: { role: ctx.role, capabilities: ctx.capabilities }, userId: ctx.user.id, assignedTournamentIds },
        today, addCalendarDays(today, 41), // six weeks, the calendar's own cap
      );
      // Still to come or under way: a practice that ended this morning is not "Next" (and not "on") for an evening reader.
      const now = Date.now();
      const on = read.bookings.filter(b => b.state === null && b.day >= today && b.endMs > now).sort((a, b) => a.startMs - b.startMs);
      const weekEnd = addCalendarDays(today, 6);
      const next = on[0];
      return {
        count: on.filter(b => b.day <= weekEnd).length,
        next: next ? { day: next.day, who: next.who } : null,
      };
    }) : undefined,
    seesCoachGaps ? settle('needs', failed, async () => {
      let q = supabaseAdmin.from('rep_teams').select('id, name').eq('org_id', org.id).eq('is_archived', false).order('name');
      if (ctx.repGroupIds) q = q.in('group_id', ctx.repGroupIds);
      const [{ data, error }, covered] = await Promise.all([q, listTeamsWithActiveHeadCoach(org.id)]);
      if (error) throw error;
      const without = (data ?? []).filter(t => !covered.has(t.id as string));
      return { count: without.length, firstTeamId: (without[0]?.id as string) ?? null, firstTeamName: (without[0]?.name as string) ?? null };
    }) : undefined,
    seesForms ? settle('needs', failed, () => clubFormsMissing(org.id)) : undefined,
  ]);

  if (cash) band.cash = cash;
  // House league's half of Owed is Accounting's to show; its Needs line is House league's — one read, two gates.
  const leagueOwed = seesBooks ? league : undefined;
  if (teamsOwed || leagueOwed) {
    band.owed = {
      ...(teamsOwed ? { teams: teamsOwed } : {}),
      ...(leagueOwed ? { league: { amount: leagueOwed.amount, players: leagueOwed.players } } : {}),
    };
  }
  if (week) band.week = week;
  const needs: NonNullable<ClubBand['needs']> = {};
  if (coachGaps) needs.noHeadCoach = coachGaps;
  if (league && seesLeagueMoney) needs.leagueOwing = { players: league.players, seasonId: league.firstSeasonId };
  if (forms) needs.formsMissing = forms;
  // A needs tile exists for a reader who can open any of its lines (each key is set only where its own gate passed).
  if (Object.keys(needs).length > 0) band.needs = needs;
  return band;
}
