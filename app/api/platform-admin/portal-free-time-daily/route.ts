import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { scheduledCall } from '@/lib/cron-auth';
import { sendPortalFreeTimeReminders } from '@/lib/portal-free-time-reminders';
import { sendClubFreeTimeReminders } from '@/lib/club-free-time-reminders';

/**
 * THE FREE-TIME DAILY JOB (Support console Stage 4b, owner 2026-10-28; the club step from Free time same rules, owner
 * 2026-11-19). Two steps, the same reminder for both kinds of customer, 14 days and 3 days before free time runs out:
 *   free_time_reminders       the owner of a Coaches Portal staff gave free time (`lib/portal-free-time-reminders.ts`, mig 407)
 *   club_free_time_reminders  every active owner of a club whose free time has an end date (`lib/club-free-time-reminders.ts`, mig 512)
 * Each is decided from the rows and a once-only stamp, so it is safe to run any time and a double-fire sends nothing twice.
 * The route keeps its portal name: the schedule (mig 408) calls it by that address.
 *
 * Callers: the pg_cron scheduler (daily, via x-cron-secret; mig 408) or a person with `run_jobs`, by hand.
 */
export const maxDuration = 300;

type Step = { step: string; ok: boolean; result?: unknown; error?: string };

export const POST = withObservability(async (req: Request) => {
  const { machine, refused } = await scheduledCall(req);
  if (refused) return refused;
  let actor = 'cron-scheduler';
  if (!machine) {
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

  await run('club_free_time_reminders', async () => {
    const result = await sendClubFreeTimeReminders(now);
    if (result.failed > 0) throw new Error(`${result.failed} club free time(s) could not be processed (${result.sent} sent, ${result.skipped} held); see the log`);
    return result;
  });

  await writePlatformAuditLog(actor, null, 'portal_free_time_sweep', 'result', null, steps);
  const ok = steps.every(s => s.ok);
  return NextResponse.json({ ok, steps }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/portal-free-time-daily' });
