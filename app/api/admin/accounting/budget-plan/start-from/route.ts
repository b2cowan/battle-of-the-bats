import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { rollClubYear } from '@/lib/club-budget-writes';

/**
 * POST /api/admin/accounting/budget-plan/start-from — start a year from another year's plan (Club Tier
 * Stage 3b, C10's planning half; specimen 1's "Start from 2026's plan"). Body: `{ fromYear, toYear }`.
 *
 * ONE step (`club_budget_roll_year`, mig 317): every line and its dates, moved on by the years between;
 * nothing billed or collected comes with it. Refused when the target year already has a line → 409
 * `year_has_lines`; nothing to copy → 400 `nothing_to_copy`; a target that doesn't follow → 400
 * `bad_year`. WHO: 3a's one money rule (`canMoveClubMoney`). → 201 `{ year, lines }`.
 */
export const POST = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));
  const done = await rollClubYear(gate.ctx.org.id, body.fromYear, body.toYear);
  if (!done.ok) return moveRefused(done);
  return NextResponse.json({ year: done.year, lines: done.lines }, { status: 201 });
}, { route: '/api/admin/accounting/budget-plan/start-from' });
