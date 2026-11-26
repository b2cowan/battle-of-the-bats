import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability, captureError } from '@/lib/observability';
import { scheduledCall } from '@/lib/cron-auth';
import { removeDuePreviews, type PreviewRemovalReport } from '@/lib/preview-removal-server';

/**
 * THE PREVIEW REMOVAL, NIGHTLY (Club Website Track P, Session P4; owner ruling T11, 2026-11-25; the job itself ruled by
 * the owner in conversation 2026-11-26, AGENCY_RULES 2026-09-26). Removes every preview 30 days past its meeting that is
 * still unclaimed, as lib/preview-removal-server.ts says, and deletes the one email's consent records three years after
 * their send. Idempotent: a preview already removed or claimed is refused by the database's own re-check.
 *
 * Callers: the pg_cron scheduler (nightly, via x-cron-secret and its one-use receipt; mig 548) or a person with `run_jobs`,
 * by hand (the walk on dev, where no scheduler calls the local server).
 * How a failure reaches the owner: captureError (the alert email) per club, this run's `preview_removal_tick` audit row,
 * a 207, the job's heartbeat on the health dashboard, and Today's "Removal overdue (N)" while a due preview is still up.
 */
export const maxDuration = 120;

export const POST = withObservability(async (req: Request) => {
  const { machine, refused } = await scheduledCall(req);
  if (refused) return refused;
  let actor = 'cron-scheduler';
  if (!machine) {
    const auth = await requirePlatformPower('run_jobs');
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }
  let report: PreviewRemovalReport | null = null;
  let error: string | null = null;
  try {
    report = await removeDuePreviews(actor);
  } catch (e) {
    console.error('[preview-removal-nightly] failed:', e);
    error = e instanceof Error ? e.message : 'failed';
    await captureError(e);
  }
  await writePlatformAuditLog(actor, null, 'preview_removal_tick', 'result', null, report ?? { error },
    { reason: 'Previews removed 30 days after their meeting (T11)' });
  const ok = !error && (report?.failed.length ?? 0) === 0 && (report?.filesFailed ?? 0) === 0;
  return NextResponse.json({ ok, report, error }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/preview-removal-nightly' });
