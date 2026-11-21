import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { scheduledCall } from '@/lib/cron-auth';
import { sweepWaitingFiles } from '@/lib/club-form-family';
import { clearStorageRemovals, runRetentionSweep, REMOVALS_PER_ROUND } from '@/lib/club-form-staff';

/**
 * FAMILY FILES THAT NEVER JOINED A SIGN-UP, DELETED (Board Ready Stage 4 Part 2; ruling 9: "a file never attached to a
 * sign-up is deleted within a day"). A family's file goes up the moment it is chosen and waits for its sign-up; one still
 * waiting after 12 hours is deleted, stored file first, then its row (`sweepWaitingFiles`). Run every 6 hours, so none
 * outlives 18. Each family upload also sweeps a few as a backstop. Idempotent.
 *
 * Board Ready Stage 4 Part 3 widened the same run (owner call 1, "as recommended" 2026-11-20; one schedule, not two):
 *   - ruling 10: family files and health answers are removed 90 days after the season is marked finished, or 120 days
 *     after its last day when it never is (mig 518 `club_form_retention_sweep`; the record then reads "Removed {date}");
 *   - every stored file whose row went — a deleted registration, a season-delete cascade, a question delete, a replaced
 *     file whose delete failed, the files the clock just removed — is deleted from storage (mig 518's removal list; F7).
 * Until the schedule runs, nothing is removed by the clock: the Privacy Policy carries no retention sentence until then.
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
  // Each part runs even when an earlier one failed: a stuck upload must not keep a health answer past its day.
  let retained = 0, cleared = 0;
  try {
    retained = await runRetentionSweep();
  } catch (e) {
    console.error('[club-form-files-sweep] the retention clock failed:', (e as { code?: string })?.code ?? 'no code');
    error = error ?? (e instanceof Error ? e.message : 'retention failed');
  }
  try {
    for (let round = 0; round < 10; round++) {
      const n = await clearStorageRemovals();
      cleared += n;
      if (n < REMOVALS_PER_ROUND) break;
    }
  } catch (e) {
    console.error('[club-form-files-sweep] stored files were not deleted:', (e as { code?: string })?.code ?? 'no code');
    error = error ?? (e instanceof Error ? e.message : 'storage removal failed');
  }
  // Counts only: never a path, a name or a club.
  await writePlatformAuditLog(actor, null, 'club_form_files_sweep', 'result', null, { removed, failed, retained, cleared, error });
  const ok = !error && failed === 0;
  return NextResponse.json({ ok, removed, failed, retained, cleared, error }, { status: ok ? 200 : 207 });
}, { route: '/api/platform-admin/club-form-files-sweep' });
