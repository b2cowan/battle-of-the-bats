import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { billFee } from '@/lib/platform-stripe-fees';

/**
 * Retry billing one Stripe fee whose billing failed (Club Tier Stage 12d-1 Part 4: "a fee whose billing failed is shown and
 * can be retried"). The billing power (Super admin, Billing): it adds a line to the club's invoice. The fee must be this
 * club's (the address's `[id]`, never the body) and still unbilled with an error; billing is idempotent on the fee, so a
 * double press never bills twice. The answer is what happened: billed, left for the club's own monthly invoice, or the
 * new error.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = withObservability(async (_req: Request, { params }: { params: Promise<{ id: string; feeId: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;
  const { id, feeId } = await params;
  const { data: fee } = await supabaseAdmin.from('platform_stripe_fees').select('id, org_id, bill_error, billed_at, exempt_reason')
    .eq('id', feeId).maybeSingle();
  if (!fee || fee.org_id !== id) return NextResponse.json({ error: 'That fee isn’t this club’s.' }, { status: 404 });
  if (fee.billed_at || fee.exempt_reason || !fee.bill_error) return NextResponse.json({ outcome: 'done' });
  const outcome = await billFee(feeId);
  await writePlatformAuditLog(auth.user.email ?? '', id, 'retry_stripe_fee', 'outcome', fee.bill_error, outcome);
  const { data: after } = await supabaseAdmin.from('platform_stripe_fees').select('bill_error').eq('id', feeId).maybeSingle();
  return NextResponse.json({ outcome, error: outcome === 'error' ? (after?.bill_error as string | null) ?? null : null });
}, { route: '/api/platform-admin/orgs/[id]/money/stripe-fees/[feeId]/retry' });
