import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAccountView, bankAnswer, bankBody, bankRefusedAs, renameAccount } from '@/lib/bank-club-steps';
import { readDay } from '@/lib/bank-club-rules';

type Params = { params: Promise<{ accountId: string }> };

/**
 * GET ?orgSlug=&date=YYYY-MM-DD — one bank account: its books, the starting statement and the saved checks newest first
 * (each with its band, result and "Books now say $X", ask 6). With `date` (a statement DAY, never a year) it adds the
 * figure for that day: Your books on D, Stripe on its way (or *not counted*), the suspects since the last match (ask 3)
 * and the latest earlier check's Not in the bank yet items (ask 2). The screen figures the band as the balance is typed.
 * `asked=start|check` names the door the screen will save through (the check form asks for a check, so its own start date
 * reads `before_start`; the Start card asks for the start); left out, the day decides.
 * PATCH { name } — rename the account (a name, never a number, B12).
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const asked = new URL(req.url).searchParams.get('date');
  const date = asked ? readDay(asked) : null;
  if (asked && !date) return moveRefused(bankRefusedAs('bad_date'));
  const door = new URL(req.url).searchParams.get('asked');
  const view = await bankAccountView(r.ctx, accountId, date, door === 'start' || door === 'check' ? door : undefined);
  if (!view) return moveRefused(bankRefusedAs('account_not_found'));
  return NextResponse.json(view);
}, { route: '/api/admin/accounting/bank/accounts/[accountId]' });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await bankBody(req);
  return bankAnswer(r.ctx, accountId, await renameAccount(r.ctx, accountId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]' });
