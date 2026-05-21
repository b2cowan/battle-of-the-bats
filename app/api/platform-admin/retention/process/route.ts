import { NextResponse } from 'next/server';
import { processBillingRetentionExpiry } from '@/lib/billing-retention';
import { requirePlatformPermission } from '@/lib/platform-auth';

export async function POST() {
  const auth = await requirePlatformPermission('manage_billing');
  if (auth.response) return auth.response;

  try {
    const result = await processBillingRetentionExpiry(auth.user.email ?? 'platform-admin');
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process retention expiry.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
