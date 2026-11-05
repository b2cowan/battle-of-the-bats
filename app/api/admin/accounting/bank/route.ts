import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { addAccount, bankAnswer, bankOverview } from '@/lib/bank-club-steps';

/**
 * THE CLUB'S BANK (Bank reconciliation R2b; B1, B7, C1, C10).
 * GET  ?orgSlug=                     — the club's accounts ("never done this" when none), each one's "checked through",
 *                                      and every club book with the account holding it. Anyone who can open Accounting.
 * POST { name, ledgerIds? }          — name an account. The first holds every club book; a later one takes the books it
 *                                      names (their unticked lines move with them, Ask 13). Answers with its view (201).
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in r) return r.error;
  return NextResponse.json(await bankOverview(r.ctx));
}, { route: '/api/admin/accounting/bank' });

export const POST = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await addAccount(r.ctx, body);
  return bankAnswer(r.ctx, out.ok ? out.id : '', null, out, 201);
}, { route: '/api/admin/accounting/bank' });
