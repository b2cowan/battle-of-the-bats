import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { buildCancellationPreflight, getSlotHoldingTournaments } from '@/lib/billing-retention';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { endingSection } from '@/lib/online-payment-endings';
import { waitingDate, waitingMoveView } from '@/lib/plan-ending';
import { readEndingAccount, readPendingEnding } from '@/lib/plan-ending-server';
import type { BillingEnding } from '@/lib/plan-billing-data';

/**
 * GET /api/billing/cancel/preflight — what cancelling would do. Owner-only.
 *
 * ── Added by Club Tier Stage 1's screens session (2026-09-26), additively ──
 *   cancelled — { at, keptUntil } for an org that IS cancelled: the day it was suspended and the
 *               earliest retention deadline still running. The reactivate card says both ("Cancelled
 *               Sep 5 · Kept until December 4, 2026", specimen 7); null while the org is live, and
 *               a field is null when its read has nothing to say (the card then omits that half).
 */
export const GET = withObservability(async (req: Request) => {
  // Scope to the org the caller is viewing (multi-org owners), NOT their home org — fail closed
  // if no orgSlug is supplied. The client passes it as a query param.
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  // These reads do not depend on one another, so they run together.
  const [preflight, endingRead, onlinePayments] = await Promise.all([
    buildCancellationPreflight(ctx.org),
    ctx.org.subscriptionStatus !== 'canceled' ? Promise.all([readEndingAccount(ctx.org.id), readPendingEnding(ctx.org.id)]) : null,
    endingSection(ctx.org.id),
  ]);

  let cancelled: { at: string | null; keptUntil: string | null } | null = null;
  if (ctx.org.subscriptionStatus === 'canceled') {
    const [{ data: orgRow }, { data: held }] = await Promise.all([
      supabaseAdmin.from('organizations').select('billing_suspended_at').eq('id', ctx.org.id).maybeSingle(),
      // The records still waiting to come back — restored or superseded ones are not "kept".
      supabaseAdmin.from('billing_retained_records').select('retention_until')
        .eq('org_id', ctx.org.id)
        .in('retained_state', ['retained_inactive', 'pending_purge'])
        .order('retention_until', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    cancelled = {
      at: (orgRow?.billing_suspended_at as string | null | undefined) ?? null,
      keptUntil: (held?.retention_until as string | null | undefined) ?? null,
    };
  }

  // Plans end at the renewal date (Stage 1): whether a cancel waits for a date, and the one already waiting. Never keyed off
  // the stored renewal date alone — an operator trial or comp carries one with no subscription (lead 8).
  let ending: BillingEnding | null = null;
  if (endingRead) {
    const [account, pending] = endingRead;
    // A stored date already past (a missed invoice webhook) is no end date to promise: it reads as missing (Part C, a).
    const { waits, on } = waitingDate(account, ctx.org.currentPeriodEnd, new Date());
    const waiting = pending && { endsAt: pending.effectiveAt, heldMovePlan: pending.heldMovePlan };
    ending = {
      waits, endsOn: on,
      // Stage 2 Part B: a waiting MOVE to the free plan carries its band, read from what holds a slot now (G2) through the
      // date's own rule; a waiting cancel carries none.
      pending: !pending || !waiting ? null : pending.intentType === 'downgrade'
        ? { ...waiting, kind: 'downgrade', move: waitingMoveView(pending, await getSlotHoldingTournaments(ctx.org.id)) }
        : { ...waiting, kind: 'cancellation', move: null },
    };
  }

  // 12d-2 (words §4.3): what stops now, what is still owed and clearing, and that the Stripe account stays the club's.
  return Response.json({ ...preflight, cancelled, ending, onlinePayments });
}, { route: '/api/billing/cancel/preflight' });
