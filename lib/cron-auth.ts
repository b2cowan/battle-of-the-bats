// ─────────────────────────────────────────────────────────────────────────────
// Machine (scheduler) authentication for trigger routes.
//
// The pg_cron→pg_net scheduler (migration 183) POSTs to platform-admin trigger
// routes with a shared secret in the `x-cron-secret` header. Routes accept EITHER
// a valid secret OR a super-admin session — one door for humans and machines, so
// there is one code path, one audit trail, one idempotency story.
//
// Fail-closed by design: if CRON_SECRET is unset in this environment, the machine
// path simply does not exist (no dev fallback — unlike the legacy UNSUBSCRIBE_SECRET
// helper, a guessable fallback here would grant customer-facing dispatch).
// The secret lives in the app env (Amplify console → amplify.yml echo) and, on the
// DB side, in Supabase Vault (`app_cron_secret`) read by the tick function.
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚖ A SCHEDULED CALL CARRIES A RECEIPT (Board Ready trust call 21; owner chose option B, 2026-11-18). The secret alone
// proved "someone has the key". A database restored to a new project keeps the jobs AND the Vault key and calls the live
// site at once (docs/agents/ops/BACKUPS_AND_RESTORE.md). Since mig 502 the tick writes a one-use receipt into its OWN
// database and sends its id in `x-cron-receipt`; a machine call runs only after `scheduledCall` consumes a receipt that
// THIS app's database holds, for this route's path, issued in the last 15 minutes, not used before. A restored copy's
// receipts live in the copy, so every call it makes is refused in any minute; a leaked secret alone runs nothing; no
// receipt runs twice. A refusal answers 200 `{ ok: true, ran: false }` (the scheduler never reads it, so it raises no alarm
// there) and records an ERROR in the platform error log, which emails once per issue (review 2026-11-18): a restore that
// skipped the jobs-off step, or code promoted ahead of mig 502 (every job would stop), is told, not just written down.
// The person path (a `run_jobs` session, "Run it now") is untouched: it never carries the secret, so it never needs one.
// ─────────────────────────────────────────────────────────────────────────────
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { captureError } from './observability/capture';
import { getRequestContext } from './observability/request-context';
import { isUuid } from './utils';

const CRON_SECRET_HEADER = 'x-cron-secret';
const CRON_RECEIPT_HEADER = 'x-cron-receipt';
/** How long a receipt stays good. The tick posts at once; pg_net's queue can lag a little, never minutes. */
const CRON_RECEIPT_WINDOW_MS = 15 * 60 * 1000;

/** True when the request carries the correct scheduler secret. Constant-time compare. Private: a route asks
 *  `scheduledCall`, never this alone (the secret without the receipt is what a restored copy also has).
 *
 * The `a.length !== b.length` guard is required — timingSafeEqual throws on unequal-length
 * buffers — and it makes an obviously-wrong-length guess return faster than a same-length one,
 * which in theory leaks the secret's byte length via response timing. Accepted: the secret is a
 * 64-char random hex string, its length is not sensitive, and the content compare below IS
 * constant-time; a length oracle over real network jitter buys an attacker nothing useful. */
function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers.get(CRON_SECRET_HEADER);
  if (!provided) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Who is calling a scheduled-job route. `machine`: the live scheduler, receipt consumed, run it. `machine: false` with no
 *  `refused`: not a machine call at all, the route's `run_jobs` gate decides. `refused`: the secret was right but no
 *  receipt of THIS database's backs it; return it as-is and run nothing.
 *
 *  The receipt must be for THIS route: its path is the `route` the route's withObservability wrapper declares (the same
 *  literal the tick was scheduled with; a guard test holds the two equal), so a receipt written for one job cannot run
 *  another. Fails closed: if the receipt cannot be checked, nothing runs (every job needs this same database to do its
 *  work, so refusing costs nothing that proceeding would have saved). */
export async function scheduledCall(req: Request): Promise<{ machine: boolean; refused: Response | null }> {
  if (!isCronRequest(req)) return { machine: false, refused: null };
  const receipt = req.headers.get(CRON_RECEIPT_HEADER);
  const path = getRequestContext()?.route;
  let why = 'no receipt';
  if (!path) {
    why = 'the route is not wrapped in withObservability, so its path is unknown';
  } else if (isUuid(receipt)) {
    const { data, error } = await supabaseAdmin
      .from('cron_call_receipts')
      .update({ used_at: new Date().toISOString() })
      .eq('id', receipt)
      .eq('path', path)
      .is('used_at', null)
      .gt('issued_at', new Date(Date.now() - CRON_RECEIPT_WINDOW_MS).toISOString())
      .select('id');
    if (!error && data && data.length === 1) return { machine: true, refused: null };
    why = error ? `the receipt could not be checked (${error.message})` : 'not a receipt this database issued for this job, or already used, or too old';
  } else if (receipt) {
    why = 'a malformed receipt';
  }
  await captureError(new Error(`A scheduled call with the right key was refused: ${why}`), {
    severity: 'error',
    title: 'A scheduled call was refused: was a restored copy of the database left running?',
  });
  return { machine: false, refused: NextResponse.json({ ok: true, ran: false }, { status: 200 }) };
}
