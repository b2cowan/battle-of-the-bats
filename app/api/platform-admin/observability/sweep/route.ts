import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * Manual observability sweep — the pg_cron fallback (Phase 4). Runs the exact same fold +
 * retention functions the scheduled jobs run; both are idempotent, so this is safe to fire any
 * time (e.g. when the dashboard freshness chip goes stale/amber). super_admin only — stricter
 * than the status route's manage_product because the sweep deletes data.
 *
 * The functions never raise: failures come back as { status: 'error', error } jsonb and are also
 * written to observability_cron_heartbeat, so rpc .error here means transport/permission only.
 */
export const POST = withObservability(async () => {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const fold = await supabaseAdmin.rpc('obs_fold_metrics');
  if (fold.error) {
    return NextResponse.json({ error: `Fold failed: ${fold.error.message}` }, { status: 500 });
  }
  const sweep = await supabaseAdmin.rpc('obs_retention_sweep');
  if (sweep.error) {
    return NextResponse.json({ error: `Sweep failed: ${sweep.error.message}` }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    null,
    'observability_sweep',
    'result',
    null,
    { fold: fold.data, sweep: sweep.data },
  );

  const failed =
    (fold.data as { status?: string } | null)?.status === 'error' ||
    (sweep.data as { status?: string } | null)?.status === 'error';
  return NextResponse.json(
    { ok: !failed, fold: fold.data, sweep: sweep.data },
    { status: failed ? 500 : 200 },
  );
}, { route: '/api/platform-admin/observability/sweep' });
