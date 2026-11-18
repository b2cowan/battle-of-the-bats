import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { scheduledCall } from '@/lib/cron-auth';
import { sweepRunOutInvitations, type InvitationSweepReport } from '@/lib/invitation-sweep';

/**
 * THE RUN-OUT INVITATION SWEEP, NIGHTLY (Board Ready trust close-out 13, open call (b), owner ruling 2026-11-18, queue P2c).
 * Removes every club invitation that ran out more than 30 days ago (60 days after it was last sent), as lib/invitation-sweep.ts
 * says: a waiting board role is cleared, a pending row is deleted, and the account a new person's invitation made is
 * deleted only when it was never used and has no other use. Idempotent.
 *
 * Callers: the pg_cron scheduler (nightly, via x-cron-secret and its one-use receipt; mig 504) or a person with `run_jobs`,
 * by hand (the walk on dev, where no scheduler calls the local server).
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
  let report: InvitationSweepReport | null = null;
  let error: string | null = null;
  try {
    report = await sweepRunOutInvitations();
  } catch (e) {
    console.error('[invitation-sweep-nightly] failed:', e);
    error = e instanceof Error ? e.message : 'failed';
  }
  await writePlatformAuditLog(actor, null, 'invitation_sweep_tick', 'result', null, report ?? { error });
  const ok = !error && (report?.failed ?? 0) === 0;
  return NextResponse.json({ ok, report, error }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/invitation-sweep-nightly' });
