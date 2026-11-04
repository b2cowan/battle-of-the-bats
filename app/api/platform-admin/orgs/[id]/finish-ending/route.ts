import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writeAuditBeforeChange } from '@/lib/platform-audit';
import { withObservability, captureAndJson } from '@/lib/observability';
import { finishOverdueEnding } from '@/lib/plan-ending';
import { endingDeps, readEndingAccount, readPendingEnding } from '@/lib/plan-ending-server';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { PLAN_CONFIG } from '@/lib/plan-config';

/**
 * POST /api/platform-admin/orgs/[id]/finish-ending — Finish this ending now (Plans end at the renewal date, Part C, G3;
 * drawn Stage 0 Tab 6). For a cancel still waiting more than three days past its date: Stripe's end-of-period message never
 * reached us. It reads the LIVE subscription first and does only what Stripe confirms — ended: the same ending the missed
 * message would have run, its data clock from the day it should have ended; still live: the account is untouched and our
 * record is made to agree with Stripe, as the missed message would have done (owner ruling 2026-11-02). Billing staff, like Cancel and End now; a typed Why; its audit row is written BEFORE the change.
 */
export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { reason?: unknown };
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
  if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });

  const [account, pending] = await Promise.all([readEndingAccount(id), readPendingEnding(id)]);
  if (!account) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const changeFailed = await writeAuditBeforeChange(
    auth.user.email!, id, 'finish_overdue_ending', 'subscription_status', 'ends_at_renewal',
    { shouldHaveEnded: pending?.effectiveAt ?? null, stripeSubscriptionId: pending?.stripeSubscriptionId ?? account.subscriptionId }, { reason },
  );
  try {
    const result = await finishOverdueEnding(account, { door: 'operator', userId: null, email: auth.user.email ?? null }, reason, endingDeps);
    if (result.outcome === 'refused') {
      await changeFailed(result.error);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    // Stripe says it is still live: the account is never ended. Our record agrees with Stripe now (or already did, and then
    // nothing changed — the row after the first says so).
    if (result.outcome === 'live') {
      const corrected = result.record !== 'unchanged';
      if (!corrected) await changeFailed(`Stripe says the subscription is still ${result.status}: nothing changed.`);
      return NextResponse.json({
        ok: true, ...result,
        notice: {
          tone: corrected ? 'good' : 'wait',
          lead: corrected ? W.cancel.finish.correctedLead : W.cancel.finish.liveLead,
          text: W.cancel.finish.live(result.nextDate, result.cancelScheduled, result.record),
        },
      });
    }
    return NextResponse.json({
      ok: true, ...result,
      notice: {
        tone: 'good', lead: W.cancel.finish.finishedLead,
        text: result.moved
          ? W.cancel.finish.moved(account.name, PLAN_CONFIG.tournament.label, result.endedAt, result.retainedTournaments, result.retentionUntil)
          : W.cancel.finish.finished(account.name, result.endedAt, result.retainedTournaments, result.retentionUntil, result.emailed),
      },
    });
  } catch (error) {
    await changeFailed(error);
    return captureAndJson(error, { error: error instanceof Error ? error.message : 'The ending did not finish.' }, 500);
  }
}, { route: '/api/platform-admin/orgs/[id]/finish-ending' });
