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
import { timingSafeEqual } from 'node:crypto';

export const CRON_SECRET_HEADER = 'x-cron-secret';

/** True when the request carries the correct scheduler secret. Constant-time compare.
 *
 * The `a.length !== b.length` guard is required — timingSafeEqual throws on unequal-length
 * buffers — and it makes an obviously-wrong-length guess return faster than a same-length one,
 * which in theory leaks the secret's byte length via response timing. Accepted: the secret is a
 * 64-char random hex string, its length is not sensitive, and the content compare below IS
 * constant-time; a length oracle over real network jitter buys an attacker nothing useful. */
export function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers.get(CRON_SECRET_HEADER);
  if (!provided) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
