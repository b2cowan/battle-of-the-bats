import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { addAccount, bankAnswer, bankBody, bankOverview } from '@/lib/bank-club-steps';

/**
 * THE CLUB'S BANK (Bank balance check BC1; B1, B7).
 * GET  ?orgSlug=                     — the club's accounts ("never done this" when none) and every club book with the
 *                                      account holding it. Each account's latest check is read by the account view (the
 *                                      Account pill) and by the Overview's summary (`bankMarks`, ask 4), not here.
 *                                      Whoever can open club Accounting (the read gate, B7).
 * POST { name, ledgerIds? }          — name an account. The first holds every club book; a later one takes the books it
 *                                      names (saved checks keep the books they counted, Q3). Answers with its view (201).
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in r) return r.error;
  return NextResponse.json(await bankOverview(r.ctx));
}, { route: '/api/admin/accounting/bank' });

export const POST = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const body = await bankBody(req);
  const out = await addAccount(r.ctx, body);
  return bankAnswer(r.ctx, out.ok ? out.id : '', out, 201);
}, { route: '/api/admin/accounting/bank' });
