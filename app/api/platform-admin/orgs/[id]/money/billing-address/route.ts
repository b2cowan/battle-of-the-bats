import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { readBillingLocationForConsole } from '@/lib/billing-location-server';
import { BILLING_LOCATION_CONSOLE_WORDS } from '@/lib/billing-location';

/**
 * The Money tab's billing-address block (GST/HST Stage 1 Part 3): where this organization's buyer is billed, the US
 * declaration and any "Needs review" flag. Ours, read from our own row; read only (Stage 1 has no edit in platform admin, by
 * ruling); the Stripe-reading power, like the tab's other panels.
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('find_stripe');
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const answer = await readBillingLocationForConsole(id);
    if (!answer) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
    return NextResponse.json(answer, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: BILLING_LOCATION_CONSOLE_WORDS.readFailed }, { status: 503 });
  }
}, { route: '/api/platform-admin/orgs/[id]/money/billing-address' });
