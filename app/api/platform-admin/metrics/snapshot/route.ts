import { NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { writeTodayPlatformMetricSnapshot } from '@/lib/platform-metrics';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async () => {
  // Writing a metric snapshot is a product action — gate it so view-only roles
  // (read_only, support, billing, growth) can't trigger the write.
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  try {
    const snapshot = await writeTodayPlatformMetricSnapshot(auth.user.email ?? 'platform-admin', 'manual');
    await writePlatformAuditLog(
      auth.user.email ?? 'platform-admin',
      null,
      'create_platform_metric_snapshot',
      'platform_metric_snapshots',
      null,
      snapshot,
    );
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    console.error('[platform-admin] metric snapshot failed', error);
    return NextResponse.json({ error: 'Snapshot failed' }, { status: 500 });
  }
}, { route: '/api/platform-admin/metrics/snapshot' });
