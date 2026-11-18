import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { scheduledCall } from '@/lib/cron-auth';
import { runDueResets } from '@/lib/two-step-support-reset';
import { GRACE_EMAIL_BUDGET_MS, sendDueGraceEmails } from '@/lib/two-step-grace-emails';

/**
 * SUPPORT'S WAITING TWO-STEP RESETS, RUN ON THE HOUR (Board Ready · two-step sign-in, Part 3; owner's go 2026-11-11). Every
 * reset whose person confirmed it and whose 24 hours have passed, and that is neither held, cancelled nor done, is run:
 * its platform audit line first, then the reset, then the person's email (lib/two-step-support-reset.ts). Idempotent.
 *
 * ⚖ SECOND DUTY (Part 4, owner ruling 2026-11-12: the grace emails ride this hourly job, no new schedule): then the two
 * grace emails, "your club now requires it" and "3 days left" (lib/two-step-grace-emails.ts), each once per person per
 * deadline, paced inside a time budget; anyone left over goes on the next hour. The resets always run first, and a failure
 * in one duty never stops the other. The tick's audit line carries both reports.
 *
 * Callers: the pg_cron scheduler (hourly, via x-cron-secret; mig 470) or a person with `run_jobs`, by hand (the person
 * record's "Run it now" once a reset is due, and the walk on dev, where no scheduler calls the local server).
 */
export const maxDuration = 120;

export const POST = withObservability(async (req: Request) => {
  const { machine, refused } = await scheduledCall(req);
  if (refused) return refused;
  const startedAt = Date.now();
  let actor = 'cron-scheduler';
  if (!machine) {
    const auth = await requirePlatformPower('run_jobs');
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }
  let report: Awaited<ReturnType<typeof runDueResets>> | null = null;
  let error: string | null = null;
  try {
    report = await runDueResets(actor);
  } catch (e) {
    console.error('[two-step-resets-hourly] failed:', e);
    error = e instanceof Error ? e.message : 'failed';
  }
  let graceEmails: Awaited<ReturnType<typeof sendDueGraceEmails>> | null = null;
  let graceError: string | null = null;
  try {
    // The budget counts from this request's start (the resets above already used some of the ~30-second limit).
    graceEmails = await sendDueGraceEmails({ stopAt: startedAt + GRACE_EMAIL_BUDGET_MS });
  } catch (e) {
    console.error('[two-step-resets-hourly] grace emails failed:', e);
    graceError = e instanceof Error ? e.message : 'failed';
  }
  await writePlatformAuditLog(actor, null, 'two_step_resets_tick', 'result', null, {
    ...(report ?? { error }),
    graceEmails: graceEmails ?? { error: graceError },
  });
  const ok = !error && !graceError && (report?.failed ?? 0) === 0 && (graceEmails?.failed ?? 0) === 0;
  return NextResponse.json({ ok, report, error, graceEmails, graceError }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/two-step-resets-hourly' });
