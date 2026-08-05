/**
 * lib/demo-sandbox-heartbeat.ts — the sandbox reconcilers' ARRIVAL heartbeat, defined once.
 *
 * Migration 183's scheduler wrapper heartbeats a job when it *dispatches* the HTTP request.
 * `pg_net` is fire-and-forget, so that row proves the database asked — never that the app
 * answered. The gap is not theoretical: on 2026-08-03 the tournament demo sat a full two-hour
 * cycle behind the clock while its dispatch heartbeat reported a run one minute earlier, because
 * the scheduler was posting to a base URL that does not reach that environment. The freshness
 * panel read green on a demo that was, to any visitor, a screenshot.
 *
 * So every sandbox reconcile writes its OWN second row once it has actually run: dispatch row =
 * asked; arrival row = arrived and did the work. A widening gap between them names the failure
 * precisely. This lesson is incident-derived, which is exactly why it lives in one place — both
 * reconcilers (`lib/demo-reconcile-core.ts`, `lib/demo-coach-reconcile-core.ts`) call this with
 * their own job name, and a change to the discipline lands everywhere at once.
 *
 * Written from the core (db-as-parameter) so a command-line run counts as an arrival too: what
 * matters is that the demo's clock moved, not who moved it.
 */

/** The slice of a supabase client this needs — matches both reconcilers' own db typing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HeartbeatDb = { from: (table: string) => any };

export async function recordSandboxArrival(
  db: HeartbeatDb,
  jobName: string,
  now: Date,
  status: 'ok' | 'error',
  errorDetail: string | null,
): Promise<void> {
  try {
    await db.from('observability_cron_heartbeat').upsert(
      {
        job_name: jobName,
        // Only a run that actually reconciled moves the clock forward — migration 183's
        // discipline. A failure records the reason and leaves `last_run_at` alone, so the chip
        // goes stale rather than reporting a healthy failure.
        ...(status === 'ok' ? { last_run_at: now.toISOString() } : {}),
        status,
        error_detail: errorDetail,
      },
      { onConflict: 'job_name' },
    );
  } catch {
    // Never let bookkeeping fail the tick. A missed heartbeat costs visibility for one cycle; a
    // thrown one would cost the demo its clock, which is the thing being protected.
  }
}
