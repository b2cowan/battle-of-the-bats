import { NextResponse } from 'next/server';
import {
  getRepTeamHistory,
  getRepCurrentSeasonSummary,
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  getRepTeamExpenses,
} from '@/lib/db';
import { resolveCoachSeasonReadContext } from '@/lib/coach-season-read';
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
  // Season-READ resolver (not the standard active-only context): history is the one surface a
  // coach explicitly keeps after their season closes (Batch 3, P0 #1) — and this route is
  // GET-only, so admitting closed assignments opens no write path.
  const resolved = await resolveCoachSeasonReadContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;

  // Record / roster / tryout data is open to any assigned coach; the money rows (dues + expenses)
  // are layered on only when the caller can view finances (tri-state money capability).
  const canMoney = canViewMoney(resolved.capabilities);

  const [history, current] = await Promise.all([
    getRepTeamHistory(teamId),
    getRepCurrentSeasonSummary(teamId),
  ]);

  // Accounting per year, only when money-cleared. Fetch current + all past years in parallel.
  let accountingByYear = new Map<string, SeasonAccounting>();
  if (canMoney) {
    const yearIds = [...history.map(y => y.id), ...(current ? [current.id] : [])];
    const entries = await Promise.all(
      yearIds.map(async id => [id, await accountingForYear(id)] as const),
    );
    accountingByYear = new Map(entries);
  }

  return NextResponse.json({
    canViewMoney: canMoney,
    current: current
      ? { ...current, accounting: canMoney ? accountingByYear.get(current.id) ?? null : null }
      : null,
    history: history.map(y => ({
      ...y,
      accounting: canMoney ? accountingByYear.get(y.id) ?? null : null,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/history' });
