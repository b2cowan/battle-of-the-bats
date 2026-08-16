import { NextResponse } from 'next/server';
import {
  getRepTeamHistory,
  getRepCurrentSeasonSummary,
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  getRepTeamExpenses,
  getRepTeam,
} from '@/lib/db';
import { resolveCoachTeamCapabilities } from '@/lib/coach-team-read';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { canViewMoney } from '@/lib/coach-capabilities';

interface SeasonAccounting {
  duesCollected: number;
  duesOutstanding: number;
  totalExpenses: number;
}

/**
 * Dues collected/outstanding + total expenses for one program year.
 *
 * ⚠ The per-player installment reads run TOGETHER, and that matters more since P2 (2026-08-16).
 * They were a serial `for` loop — one round trip per player on the roster — and the loop was
 * cheap to ignore while the whole route short-circuited for anyone but the head coach. Reverting
 * that restriction (owner ruling: every current member sees the compare list) means this runs for
 * every assistant too, once per season with money access, so a serial loop over a 15-player roster
 * across four seasons was 60 sequential round trips on a page an ordinary coach now opens.
 * The reads are independent — nothing here decides which schedule to fetch next.
 */
async function accountingForYear(yearId: string): Promise<SeasonAccounting> {
  const schedules = await getRepPlayerDuesSchedules(yearId);
  const [installmentsPerSchedule, expenses] = await Promise.all([
    Promise.all(schedules.map(s => getRepPlayerDuesInstallments(s.id))),
    getRepTeamExpenses(yearId),
  ]);
  let duesCollected = 0;
  let duesOutstanding = 0;
  for (const installments of installmentsPerSchedule) {
    for (const i of installments) {
      if (i.paidAt) duesCollected += i.amount;
      else duesOutstanding += i.amount;
    }
  }
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

  /**
   * ⚠ **THE COMPARE LIST — the look-back layer's cross-season half** (P2, 2026-08-16).
   *
   * This route spans EVERY season at once, so it names no year and takes no year parameter: the
   * membership answer IS the access check, and null means no ACTIVE membership on this team.
   *
   * ⚠⚠ **THE HEAD-COACH RESTRICTION IS REVERTED HERE** (owner ruling, taken with Design A). It
   * shipped on 2026-08-16 as the floor while access itself was still per-season and an ex-coach
   * could still read everything. M1 removed that premise — only CURRENT staff hold a membership at
   * all — so narrowing the team's own scrapbook to the head coach was gating the wrong thing:
   * every assistant on the team today sees the seasons the team has played. Money figures stay
   * money-gated below, which is the grant that actually governs the sensitive half.
   */
  const capabilities = await resolveCoachTeamCapabilities(ctx.org, ctx.user.id, teamId);
  if (!capabilities) return forbidden();
  const mayViewMoney = canViewMoney(capabilities);

  const [history, current] = await Promise.all([
    getRepTeamHistory(teamId),
    getRepCurrentSeasonSummary(teamId),
  ]);

  // Accounting only when this coach may see money at all. Fetched in parallel.
  const moneyYearIds = mayViewMoney
    ? [...history.map(y => y.id), ...(current ? [current.id] : [])]
    : [];
  const accountingByYear = new Map<string, SeasonAccounting>(
    await Promise.all(moneyYearIds.map(async id => [id, await accountingForYear(id)] as const)),
  );

  return NextResponse.json({
    // The client's "money column exists at all" decision.
    canViewMoney: mayViewMoney,
    /**
     * ⚠ Stated, not inferred from an empty list. "None yet" and "not for you" are different
     * sentences, and the client must not print the first when it means the second. Since the
     * head-coach restriction was reverted (see above) this is true for every current member —
     * it stays on the payload so a future narrowing has a channel that already exists.
     */
    canViewSeasonHistory: true,
    current: current
      ? { ...current, accounting: accountingByYear.get(current.id) ?? null }
      : null,
    history: history.map(y => ({
      ...y,
      accounting: accountingByYear.get(y.id) ?? null,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/history' });
