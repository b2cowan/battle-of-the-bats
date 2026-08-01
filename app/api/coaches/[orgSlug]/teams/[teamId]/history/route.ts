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

  // ⚠ Chunk F, governing rule 1: this route spans EVERY season, so it deliberately does NOT use
  // the single-season read rail — that would resolve one season's context (and its team +
  // program-year lookups) only to throw the result away, then re-fetch the same assignment lists
  // here. The per-season capability map IS the access check: an empty map means this coach was
  // never on this team's staff, in any year.
  //
  // One boolean can't be right across an archive — an assistant granted money in 2024 and not in
  // 2025 must see 2024's totals and not 2025's — so the gate is resolved PER SEASON from that
  // season's own assignment row.
  const capsByYear = await resolveCoachSeasonCapabilityMap(ctx.org, ctx.user.id, teamId);
  if (capsByYear.size === 0) return forbidden();

  const moneyForYear = (yearId: string) => {
    const caps = capsByYear.get(yearId);
    return !!caps && canViewMoney(caps);
  };

  const [history, current] = await Promise.all([
    getRepTeamHistory(teamId),
    getRepCurrentSeasonSummary(teamId),
  ]);

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
    current: current
      ? { ...current, accounting: accountingByYear.get(current.id) ?? null }
      : null,
    history: history.map(y => ({
      ...y,
      accounting: accountingByYear.get(y.id) ?? null,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/history' });
