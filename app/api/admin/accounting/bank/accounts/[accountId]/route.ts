import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, bankAccountView, bankAnswer, renameAccount } from '@/lib/bank-club-steps';
import { BANK_REFUSAL } from '@/lib/bank-check-words';

type Params = { params: Promise<{ accountId: string }> };

/**
 * GET ?orgSlug=&check= — one bank account (C2–C5): its statements, the one shown (the one asked for, else the open one,
 * else the latest) with the engine's numbers — band, ticked, outstanding, kept out, left out automatically, waiting,
 * payout gaps named by reason, changed since — and what can happen next. Everyone who can open Accounting (B7).
 * PATCH { name } — rename the account (a name, never a number, B12).
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const check = new URL(req.url).searchParams.get('check');
  const view = await bankAccountView(r.ctx, accountId, check);
  if (!view) return NextResponse.json({ error: BANK_REFUSAL.account_not_found, code: 'account_not_found' }, { status: 404 });
  return NextResponse.json(view);
}, { route: '/api/admin/accounting/bank/accounts/[accountId]' });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { accountId } = await params;
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return bankAnswer(r.ctx, accountId, null, await renameAccount(r.ctx, accountId, body));
}, { route: '/api/admin/accounting/bank/accounts/[accountId]' });
