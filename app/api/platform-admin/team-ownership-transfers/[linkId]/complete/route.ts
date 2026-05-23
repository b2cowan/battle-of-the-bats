import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPlatformPermission } from '@/lib/platform-auth';
import { completeTeamOwnershipTransfer } from '@/lib/team-ownership-transfer';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const auth = await requireAnyPlatformPermission(['manage_support', 'manage_billing']);
  if (auth.response) return auth.response;

  const { linkId } = await params;
  let body: { reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const result = await completeTeamOwnershipTransfer({
    linkId,
    actorUserId: auth.user.id,
    actorEmail: auth.user.email ?? 'platform-admin',
    reason,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    result: result.result,
    stripeCancellation: result.stripeCancellation,
    stripeCancellationError: result.stripeCancellationError ?? null,
  });
}
