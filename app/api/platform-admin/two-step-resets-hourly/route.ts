import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { isCronRequest } from '@/lib/cron-auth';
import { runDueResets } from '@/lib/two-step-support-reset';

/**
 * SUPPORT'S WAITING TWO-STEP RESETS, RUN ON THE HOUR (Board Ready · two-step sign-in, Part 3; owner's go 2026-11-11). Every
 * reset whose person confirmed it and whose 24 hours have passed, and that is neither held, cancelled nor done, is run:
 * its platform audit line first, then the reset, then the person's email (lib/two-step-support-reset.ts). Idempotent.
 *
 * Callers: the pg_cron scheduler (hourly, via x-cron-secret; mig 470) or a person with `run_jobs`, by hand (the person
 * record's "Run it now" once a reset is due, and the walk on dev, where no scheduler calls the local server).
 */
export const maxDuration = 120;

export const POST = withObservability(async (req: Request) => {
  let actor = 'cron-scheduler';
  if (!isCronRequest(req)) {
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
  await writePlatformAuditLog(actor, null, 'two_step_resets_tick', 'result', null, report ?? { error });
  const ok = !error && (report?.failed ?? 0) === 0;
  return NextResponse.json({ ok, report, error }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/two-step-resets-hourly' });
