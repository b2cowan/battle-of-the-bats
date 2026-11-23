import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, type AuthContextWithRole } from './api-auth';
import { changesInvoiceDetails, opensSponsorships } from './club-sponsorships-place';
import { SPONSORSHIPS_WORDS as W } from './club-sponsorships-words';

/**
 * SPONSORSHIPS — THE GATE EVERY ROUTE ASKS (Board Ready Stage 6, Part 1). The place's layout asks the same pure answer
 * (`opensSponsorships`), so a hidden row never decides anything a route would not. `invoice: true` is round 2 ask 4: the
 * club's invoice details are changed by the owner, admins and the treasurer only, whoever else holds Sponsorships.
 * Every route sets `requireOrgSlug` (the J3-012 fail-closed rule for every admin route).
 */
export interface SponsorshipsGate { ctx: AuthContextWithRole; changesInvoice: boolean }

export async function requireSponsorships(req: Request, opts: { invoice?: boolean } = {}): Promise<SponsorshipsGate | { failure: Response }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { failure: unauthorized() };
  const member = { role: ctx.role, capabilities: ctx.capabilities, limited: !!ctx.repGroupIds };
  if (!opensSponsorships(member, ctx.org)) {
    return { failure: NextResponse.json({ error: W.say.noPlace, code: 'no_place' }, { status: 403 }) };
  }
  const changesInvoice = changesInvoiceDetails(member, ctx.org);
  if (opts.invoice && !changesInvoice) {
    return { failure: NextResponse.json({ error: W.say.invoiceLocked, code: 'invoice_locked' }, { status: 403 }) };
  }
  return { ctx, changesInvoice };
}

export const refused = (error: string, status = 400, code: string | null = null) => NextResponse.json({ error, ...(code ? { code } : {}) }, { status });
