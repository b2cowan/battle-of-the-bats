import { NextResponse } from 'next/server';
import { processBillingRetentionExpiry } from '@/lib/billing-retention';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async () => {
  const auth = await requirePlatformPower('retention');
  if (auth.response) return auth.response;

  try {
    const result = await processBillingRetentionExpiry(auth.user.email ?? 'platform-admin');
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process retention expiry.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { route: '/api/platform-admin/retention/process' });
