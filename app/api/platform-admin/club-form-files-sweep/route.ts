import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { scheduledCall } from '@/lib/cron-auth';
import { sweepWaitingFiles } from '@/lib/club-form-family';

/**
 * FAMILY FILES THAT NEVER JOINED A SIGN-UP, DELETED (Board Ready Stage 4 Part 2; ruling 9: "a file never attached to a
 * sign-up is deleted within a day"). A family's file goes up the moment it is chosen and waits for its sign-up; one still
 * waiting after 12 hours is deleted, stored file first, then its row (`sweepWaitingFiles`). Run every 6 hours, so none
 * outlives 18. Each family upload also sweeps a few as a backstop. Idempotent.
 *
 * Callers: the pg_cron scheduler (via x-cron-secret; the schedule is its own migration, created only on the owner's yes)
 * or a person with `run_jobs`, by hand (the walk on dev, where no scheduler calls the local server).
 */
export const maxDuration = 60;

export const POST = withObservability(async (req: Request) => {
  const { machine, refused } = await scheduledCall(req);
  if (refused) return refused;
  let actor = 'cron-scheduler';
  if (!machine) {
    const auth = await requirePlatformPower('run_jobs');
    if (auth.response) return auth.response;
    actor = auth.user.email ?? 'platform-admin';
  }
  let removed = 0, failed = 0, error: string | null = null;
  try {
    // A backlog clears in bounded rounds within one call.
    for (let round = 0; round < 10; round++) {
      const r = await sweepWaitingFiles();
      removed += r.removed;
      failed += r.failed;
      if (r.removed + r.failed < 200 || r.failed) break;
    }
  } catch (e) {
    console.error('[club-form-files-sweep] failed:', (e as { code?: string })?.code ?? 'no code');
    error = e instanceof Error ? e.message : 'failed';
  }
  // Counts only: never a path, a name or a club.
  await writePlatformAuditLog(actor, null, 'club_form_files_sweep', 'result', null, { removed, failed, error });
  const ok = !error && failed === 0;
  return NextResponse.json({ ok, removed, failed, error }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/club-form-files-sweep' });
