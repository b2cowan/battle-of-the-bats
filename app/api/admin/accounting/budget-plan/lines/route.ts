import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { addClubLine } from '@/lib/club-budget-writes';

/**
 * POST /api/admin/accounting/budget-plan/lines — plan a word on a year (Club Tier Stage 3b; Asks 4a,
 * 4b, 4d). Body: `{ seasonYear, itemId, totalAmount, description?, notes?, periods?: [{ label, date,
 * amount }], sortOrder? }`.
 *
 *   · WHO: 3a's one money rule (`canMoveClubMoney` — owner, treasurer, an admin with Accounting). It was
 *     owner/treasurer BY NAME until 3b (S3B-03).
 *   · THE WORD is required and authorised (`resolveOrgBudgetItem`: standard words and the club's own,
 *     never a team's); its category is derived from it. Money-in words plan revenue (Ask 4b).
 *   · ONE WORD, ONE LINE: a word already on the year ADDS to its line → 200 `{ line, joined: true }`;
 *     a new line → 201 `{ line, joined: false }`.
 *   · Refusals (`{ error, code }`): 400 `bad_year` · `bad_total` · `word_required` · `bad_word` ·
 *     `bad_description` · `bad_periods` · `bad_period_label` · `bad_period_date` · `bad_period_amount` ·
 *     `periods_dont_add_up` (+ `periodsTotal`, `lineTotal`); 409 `line_changed` (a join raced twice).
 */
export const POST = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));
  const done = await addClubLine(gate.ctx.org.id, body);
  if (!done.ok) return moveRefused(done);
  return NextResponse.json({ line: done.line, joined: done.joined }, { status: done.joined ? 200 : 201 });
}, { route: '/api/admin/accounting/budget-plan/lines' });
