import { NextResponse } from 'next/server';
import {
  getRepTeamHistory,
  getRepCurrentSeasonSummary,
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  getRepTeamExpenses,
  getRepTeam,
} from '@/lib/db';
import { resolveCoachSeasonCapabilityMap } from '@/lib/coach-season-read';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { canViewMoney } from '@/lib/coach-capabilities';

interface SeasonAccounting {
  duesCollected: number;
  duesOutstanding: number;
  totalExpenses: number;
}

/** Dues collected/outstanding + total expenses for one program year. */
async function accountingForYear(yearId: string): Promise<SeasonAccounting> {
  const schedules = await getRepPlayerDuesSchedules(yearId);
  let duesCollected = 0;
  let duesOutstanding = 0;
  for (const s of schedules) {
    const installments = await getRepPlayerDuesInstallments(s.id);
    for (const i of installments) {
      if (i.paidAt) duesCollected += i.amount;
      else duesOutstanding += i.amount;
    }
  }
  const expenses = await getRepTeamExpenses(yearId);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { duesCollected, duesOutstanding, totalExpenses };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // This route spans EVERY season, so it deliberately does NOT use the single-season read rail —
  // the capability map IS the access check: an empty map means no ACTIVE team membership.
  //
  // ⚠ M1 (2026-08-16) changed what the map holds: it is the member's CURRENT capabilities for
  // every year (governing rule 1 — "that season's own assignment row" — is retired; the widening
  // is recorded in COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md §1). `moneyForYear` below therefore
  // answers the same for every season; the per-year SHAPE stays because the map's absent-year
  // contract still carries "no access at all".
  const capsByYear = await resolveCoachSeasonCapabilityMap(ctx.org, ctx.user.id, teamId);
  if (capsByYear.size === 0) return forbidden();

  const moneyForYear = (yearId: string) => {
    const caps = capsByYear.get(yearId);
    return !!caps && canViewMoney(caps);
  };

  /**
   * ⚠⚠ THE SEASON-BY-SEASON HISTORY IS HEAD-COACH ONLY (owner ruling, 2026-08-16).
   *
   * This route served the team's whole scrapbook — per-season record, roster size, tryout
   * acceptance and money summaries — to ANY coach who had ever staffed the team, for EVERY season,
   * **including years before they arrived and after they left**. Money figures were correctly
   * scoped per year; nothing else was. Surfaced by the archive rail's review as pre-existing.
   *
   * The ruling is deliberately the simple one — head coach, no tenure windows ("we can figure out
   * how to expand later").
   *
   * ⚠ M1 note: with the map now uniform-current, this predicate means "head coach NOW" — the
   * client's door derivation was aligned to the same answer (lib/coach-season-view.ts), so the
   * two can no longer disagree and serve the "None yet" lie. The restriction itself is slated
   * for REVERT in P2 of COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md (owner ruling: all current
   * staff see the whole history), at which point this gate goes entirely.
   *
   * ⚠ This NARROWS access — it opens no archive door and needs no allow-list entry. And it is
   * enforced HERE, not just hidden on the page: the rows must not reach a browser that shouldn't
   * have them.
   */
  const everHeadCoach = [...capsByYear.values()].some(c => c.isHeadCoach);

  const [history, current] = everHeadCoach
    ? await Promise.all([getRepTeamHistory(teamId), getRepCurrentSeasonSummary(teamId)])
    : [[], null];

  // Accounting only for the years this coach may see money on. Fetched in parallel.
  const moneyYearIds = [...history.map(y => y.id), ...(current ? [current.id] : [])]
    .filter(moneyForYear);
  const accountingByYear = new Map<string, SeasonAccounting>(
    await Promise.all(moneyYearIds.map(async id => [id, await accountingForYear(id)] as const)),
  );

  return NextResponse.json({
    // Retained for the client's "money column exists at all" decision — true when the coach can
    // see money on ANY season in the archive, not a claim about every row.
    canViewMoney: [...capsByYear.values()].some(canViewMoney),
    /**
     * ⚠ Stated, not inferred from an empty list. A coach who MAY see the history of a team that
     * simply has no past seasons yet is a different thing from a coach who may not see it, and the
     * two need different words on screen — "None yet" teaches, while showing that to an assistant
     * would be a lie about a team with three archived years.
     */
    canViewSeasonHistory: everHeadCoach,
    current: current
      ? { ...current, accounting: accountingByYear.get(current.id) ?? null }
      : null,
    history: history.map(y => ({
      ...y,
      accounting: accountingByYear.get(y.id) ?? null,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/history' });
