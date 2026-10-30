import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { sendPortalFreeTimeReminders } from '@/lib/portal-free-time-reminders';

/**
 * THE COACHES PORTAL FREE-TIME DAILY JOB (Support console Stage 4b; owner 2026-10-28). One step: the reminder emails to
 * the owner of a portal staff gave free time, 14 days and 3 days before it runs out (`lib/portal-free-time-reminders.ts`).
 * Decided from the rows and a once-only stamp (mig 407), so it is safe to run any time and a double-fire sends nothing twice.
 *
 * Callers: the pg_cron scheduler (daily, via x-cron-secret; mig 408) or a person with `run_jobs`, by hand.
 */
export const maxDuration = 300;

type Step = { step: string; ok: boolean; result?: unknown; error?: string };

export const POST = withObservability(async (req: Request) => {
  let actor = 'cron-scheduler';
  if (!isCronRequest(req)) {
    const auth = await requirePlatformPower('run_jobs');
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }
  const now = new Date();
  const steps: Step[] = [];
  const run = async (step: string, fn: () => Promise<unknown>) => {
    try { steps.push({ step, ok: true, result: await fn() }); }
    catch (e) {
      console.error(`[portal-free-time-daily] ${step} failed:`, e);
      steps.push({ step, ok: false, error: e instanceof Error ? e.message : 'failed' });
    }
  };
  await run('free_time_reminders', async () => {
    const result = await sendPortalFreeTimeReminders(now);
    // A portal that could not be processed is a failed step, not a green 200: the job's health reading must see it.
    if (result.failed > 0) throw new Error(`${result.failed} portal(s) could not be processed (${result.sent} sent, ${result.skipped} held); see the log`);
    return result;
  });

  await writePlatformAuditLog(actor, null, 'portal_free_time_sweep', 'result', null, steps);
  const ok = steps.every(s => s.ok);
  return NextResponse.json({ ok, steps }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/portal-free-time-daily' });
