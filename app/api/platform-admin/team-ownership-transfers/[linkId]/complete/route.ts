import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPlatformPermission } from '@/lib/platform-auth';
import { completeTeamOwnershipTransfer } from '@/lib/team-ownership-transfer';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },) => {
  const auth = await requireAnyPlatformPermission(['manage_support', 'manage_billing']);
  if (auth.response) return auth.response;

  const { linkId } = await params;
  let body: { reason?: unknown; confirmWorkspaceOrgId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  // The operator must echo back the counterpart (coach's Team workspace) org id they confirmed,
  // so a stray click can't cancel the wrong org's subscription. Verified server-side in the helper.
  const confirmWorkspaceOrgId = typeof body.confirmWorkspaceOrgId === 'string' ? body.confirmWorkspaceOrgId : '';
  const result = await completeTeamOwnershipTransfer({
    linkId,
    actorUserId: auth.user.id,
    actorEmail: auth.user.email ?? 'platform-admin',
    reason,
    confirmWorkspaceOrgId,
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
}, { route: '/api/platform-admin/team-ownership-transfers/[linkId]/complete' });
