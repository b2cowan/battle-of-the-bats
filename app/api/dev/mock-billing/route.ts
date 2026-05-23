import { NextResponse } from 'next/server';
import type { BillingMockConfig } from '@/lib/billing-mock';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';

type MockBillingPayload = {
  enabled?: unknown;
};

async function authorizeDevTool() {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  return null;
}

export async function GET() {
  const response = await authorizeDevTool();
  if (response) return response;

  const { getBillingMockConfig } = await import('@/lib/billing-mock');
  const config: BillingMockConfig = getBillingMockConfig();
  return NextResponse.json({ ok: true, ...config });
}

export async function POST(req: Request) {
  const response = await authorizeDevTool();
  if (response) return response;

  const body = await req.json().catch(() => null) as MockBillingPayload | null;
  const value = body?.enabled;

  if (value !== true && value !== false && value !== null) {
    return NextResponse.json({ error: 'enabled must be true, false, or null' }, { status: 400 });
  }

  const { setBillingMockRuntimeOverride, getBillingMockConfig } = await import('@/lib/billing-mock');
  setBillingMockRuntimeOverride(value);
  const config: BillingMockConfig = getBillingMockConfig();
  return NextResponse.json({ ok: true, ...config });
}
