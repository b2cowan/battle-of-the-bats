import { NextResponse } from 'next/server';
import { getAuthContextWithRole, getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability, captureAndJson } from '@/lib/observability';
import { isClubPlan } from '@/lib/module-entitlements';
import { readClubBand } from '@/lib/club-band-read';

/**
 * GET /api/admin/club-band?orgSlug= — "The club today": the Overview's band above "This morning" (Club Tier Stage 13b, A1;
 * owner Asks 2 and 4, decisions 2026-11-07). Cash on hand · Owed to the club · This week · Needs someone.
 *
 * ⚖ OWN ROUTE, never inside the brief: the brief loads on every club screen for the nav, and this reads money, the calendar and
 * Families. The Overview asks for it only after "This morning" has rendered. Owner and club admin only (decision 1); every
 * part is then read only for a reader who holds the gate of the page it opens (`lib/club-band-read.ts`), and a part the reader
 * cannot open is ABSENT from the answer, not zero.
 *
 * The brief's old "no money" rule (C04) was Stage 1's: the club's figures were known-wrong until Stage 3, and Stage 3 shipped.
 * That reason expired; the figures here are Accounting's own definitions, called, never re-derived.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const [ctx, scoped] = await Promise.all([
    getAuthContextWithRole({ orgSlug, requireOrgSlug: true }),
    getAuthContextWithScope({ orgSlug, requireOrgSlug: true }),
  ]);
  if (!ctx || !scoped) return unauthorized();
  if (!isClubPlan(ctx.org.planId)) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();

  try {
    return NextResponse.json(await readClubBand(ctx, scoped.assignedTournamentIds), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return captureAndJson(err, { error: 'Could not read the club band.' }, 500);
  }
}, { route: '/api/admin/club-band' });
