import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { closeQuestion } from '@/lib/club-fiscal-reads';
import { closeFiscalYear, readYearKey } from '@/lib/club-fiscal-year-moves';

type Params = { params: Promise<{ key: string }> };

/**
 * GET — THE CLOSE QUESTION for a fiscal year (Club Tier Stage 3c, Ask 2; specimen 3). Warns, never blocks:
 * → 200 `{ question }` (lib/club-fiscal-reads.ts `CloseQuestion`): `canClose` and `refusal` (`not_ended` + `lastDay` ·
 * `already_closed` · `close_order` + the year to close first); `open` — the four kinds of open money, each a count, a
 * total and the rows its door opens: `installments` (still owed on the year's bills: overdue · sent, waiting for you
 * · upcoming), `requests` (waiting on the club, filed in the year; `holdingPayout`), `unfiled` (lines filed under no
 * word — `ledger` narrows the Ledger to them), `pending` (cheques not cleared — `ledger` narrows to them); `locks`
 * (books · lines · plan lines); `carries` (`closingBalance`, `nextYear`, `nextPlanLines`); `sinceLastClose` (a
 * re-close after a Reopen: when, who, why, the closing it had, the change since). A team outside the reader's
 * groups is counted, never named (B11). WHO: whoever can move the club's money (it asks to close).
 *
 * POST — CLOSE it, in ONE step (`club_fiscal_year_close`): refused unless it has ended, if already closed, and oldest
 * first. Records who, when, the closing balance (every book the club owns, posted through its last day) and what was
 * still open (read now — the close question's figures, the club's whole record). Locks every line dated in it on
 * every club-owned book, and its plan. → 200 `{ year: { key, name, closingBalance, closedAt } }`; 409 `not_ended` ·
 * `already_closed` · `close_order` (+ `year`); 404 `not_found`. No notification: closing is the club's own act.
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;
  const { key } = await params;
  const setting = await loadFiscalSetting(ctx.org.id);
  const found = readYearKey(key, setting);
  if (!found.ok) return moveRefused(found);
  const { question } = await closeQuestion(ctx.org.id, { year: found.year, setting, today: tournamentToday(), scope: await teamIdsInScope(ctx) });
  return NextResponse.json({ question });
}, { route: '/api/admin/accounting/fiscal-years/[key]/close' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;
  const { key } = await params;
  const done = await closeFiscalYear(ctx.org.id, ctx.user.id, key, tournamentToday(), await teamIdsInScope(ctx));
  if (!done.ok) return moveRefused(done);
  return NextResponse.json({ year: done.year });
}, { route: '/api/admin/accounting/fiscal-years/[key]/close' });
