import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { writeOrgBillingAudit } from '@/lib/billing-retention';
import { captureAndJson, withObservability } from '@/lib/observability';
import { changeKeptTournaments } from '@/lib/plan-ending';
import { endingDeps } from '@/lib/plan-ending-server';

/**
 * POST /api/billing/downgrade/pick — Change which tournament you keep. Owner-only.
 *
 * Plans end at the renewal date, Stage 2 Part B (gap review G2): while a move to the free plan waits, the owner may change
 * which tournament stays active on the date. The choice is re-run against what holds a slot NOW — a tournament made during
 * the wait is choosable — and only the waiting row's pick changes (`changeKeptTournaments`). Nothing moves, archives or
 * reaches Stripe until the date; the date re-reads the tournaments and keeps this pick as far as it still holds a slot.
 */
export const POST = withObservability(async (req: Request) => {
  // Scope to the org the caller is viewing (multi-org owners), NOT their home org — fail closed. A move waits only on a
  // live account, so a suspended one is refused here (not on the suspended-billing allowlist).
  const body = await req.json().catch(() => ({})) as { orgSlug?: unknown; keepTournamentIds?: unknown };
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  try {
    const result = await changeKeptTournaments({ orgId: ctx.org.id }, { door: 'owner', userId: ctx.user.id, email: ctx.user.email ?? null }, body.keepTournamentIds, endingDeps);
    if (result.outcome === 'refused') return Response.json({ error: result.error }, { status: result.status });
    await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_downgrade_pick_changed', { keepTournamentIds: result.keepIds });
    return Response.json({ ok: true, keepTournamentIds: result.keepIds });
  } catch (error) {
    return captureAndJson(error, { error: 'Your choice wasn’t saved. Try again.' }, 500);
  }
}, { route: '/api/billing/downgrade/pick' });
