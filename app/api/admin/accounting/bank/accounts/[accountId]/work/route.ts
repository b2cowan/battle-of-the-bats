import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { badBankIds, bankBody, bankRefusedAs } from '@/lib/bank-club-steps';
import { readWorkBody } from '@/lib/bank-check-work';
import {
  clubCanSave, clubWorkAccount, discardWork, keepWork, readWork, workElsewhere, workRefused,
} from '@/lib/bank-check-work-server';

type Params = { params: Promise<{ accountId: string }> };

/**
 * A BANK CHECK IN PROGRESS on one of the club's accounts (S7, plan BANK_CHECK_NOVICE_UX_PLAN.md §0 A18; lib/bank-check-work).
 * Every handler asks the check route's own gate first (`resolveClubMoney` books + write: whoever can save a check, which on
 * the club's bank is whoever can open Accounting, B7), then that the account is one of this club's live club accounts.
 *
 * GET    — { mine, colleagues, elsewhere }: the caller's own work, colleagues' quiet lines (who, date, changed: nothing
 *          more), and the caller's work on the club's other accounts (the Account pill at 2+, drawing tab 4).
 * PUT    { work, revision } — keep it (kept as you go; Save for later): { saved } with `endsOn`, or `work_changed` (409)
 *          when another device kept newer work, or `bad_work` (400).
 * DELETE — Start over: the caller's work on this account goes.
 */
async function theAccount(orgId: string, accountId: string): Promise<Response | string> {
  const bad = badBankIds({ accountId });
  if (bad) return bad;
  return (await clubWorkAccount(orgId, accountId)) ?? moveRefused(bankRefusedAs('account_not_found'));
}

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const account = await theAccount(r.ctx.org.id, (await params).accountId);
  if (typeof account !== 'string') return account;
  const [read, elsewhere] = await Promise.all([
    readWork({ accountId: account, me: r.ctx.user.id, orgId: r.ctx.org.id, canSave: clubCanSave(r.ctx.org) }),
    workElsewhere(r.ctx.org.id, r.ctx.user.id, account),
  ]);
  return NextResponse.json({ ...read, elsewhere });
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/work' });

export const PUT = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const account = await theAccount(r.ctx.org.id, (await params).accountId);
  if (typeof account !== 'string') return account;
  const body = readWorkBody(await bankBody(req));
  // A club account has no cash field (the coach card's): a body carrying one is not this card's.
  if (!body || body.work.cash !== undefined) return workRefused('bad_work');
  const kept = await keepWork({ accountId: account, me: r.ctx.user.id, work: body.work, revision: body.revision });
  return kept.ok ? NextResponse.json({ saved: kept.saved }) : workRefused(kept.code);
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/work' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const account = await theAccount(r.ctx.org.id, (await params).accountId);
  if (typeof account !== 'string') return account;
  await discardWork(account, r.ctx.user.id);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/accounting/bank/accounts/[accountId]/work' });
