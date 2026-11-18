/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * FREE TIME ON AN ENDED CLUB: reopened when it is given, closed again when it ends (owner ruling 2026-11-18, the four
 * answers all as recommended; prompt docs/projects/active/FREE_TIME_ENDED_CLUB_BUILD_PROMPT.md).
 *
 * A club's plan ends (in-app cancel, End now, Stripe giving up on a card): the ending (lib/plan-ending.ts `applyEnding`)
 * suspends it, takes its public site off, archives its tournaments and starts the 90-day data clock (Privacy §9). Staff can
 * let it back in as a favour with BILLING-STATUS free time (the only kind the door lets past an ended plan).
 *
 *   · ON GIVE: the restore an operator's plan change runs (`restoreAfterReactivation`): site back on, tournaments back up
 *     to the plan's limit, the clock's records and the ending closed. A failure is a warning, never a failed give. The
 *     grant carries the mark `REOPENED_ENDED_CLUB` (decided in `decideGive`, lib/free-time.ts).
 *   · ON END (End it now, Put it back, or its last day passing): if the club still has not paid, THE SAME ENDING runs again,
 *     marked `freeTimeEnded`: suspended, site off, tournaments archived, a fresh 90-day window from that day, the owners'
 *     "has ended" email with the new date. Records the first ending kept (tournaments past the plan's limit) get the same
 *     new window, so nothing is deleted sooner than 90 days after the club was closed again.
 *   · A date end fires nothing, so the daily job (`closeAgainExpiredFreeTime`) finds marked grants that are over on a
 *     club still ended and not suspended. Only those: a club free time never reopened is never touched here.
 *
 * The rules are here and tested with an in-memory world (tests/unit/free-time-reclose.test.ts); the database half is
 * lib/free-time-reclose-server.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { isGrantRunning, isReopeningGrant } from './free-time';
import { BILLING_RETENTION_DAYS, CANCELLATION_REASONS } from './billing-cancellation-policy';
import { retentionUntilFrom, type EndingDoor } from './plan-ending';

export type ReopenActor = { door: Extract<EndingDoor, 'operator' | 'system'>; userId: string | null; email: string | null };

export const SYSTEM_ACTOR: ReopenActor = { door: 'system', userId: null, email: null };

/** The ending's reason when free time that reopened a club runs out. */
export const FREE_TIME_ENDED_REASON = 'Free time ended';

export const REOPEN_FAILED_WARNING =
  'Free time given, but restoring the public site and tournaments failed. The club can sign in; its site may still be off. Check it before telling the owner.';
// The daily job retries a club the failure left open; one left half-closed shows its unfinished ending on the record.
export const CLOSE_AGAIN_FAILED_WARNING =
  'Free time ended, but closing the club again did not finish. Check its record tomorrow: the daily job retries a club left open, and an unfinished ending shows there to finish.';

export type GrantFacts = { type: string; target: unknown; starts_at: string | null; expires_at: string | null; revoked_at: string | null };

export type CloseAgainFacts = {
  /** The stored status (the club's own, never free time's). */
  storedStatus: string | null;
  /** The ending's suspension stamp is set: still closed, or already closed again. */
  suspended: boolean;
  isCoachesPortal: boolean;
  /** The club's status through the door (free time included, the switch respected). */
  doorStatus: string | null;
  /** Its billing-status grants, running or not. */
  grants: GrantFacts[];
};

/**
 * Close it again: its plan ended, free time reopened it (a marked grant), no billing-status free time still runs, and the
 * door says ended. A club that paid meanwhile is not `canceled`; one already closed again is suspended.
 */
export function shouldCloseAgain(f: CloseAgainFacts, now: Date): boolean {
  if (f.storedStatus !== 'canceled' || f.suspended || f.isCoachesPortal) return false;
  if (!f.grants.some(isReopeningGrant)) return false;
  if (f.grants.some(g => g.type === 'subscription_status' && isGrantRunning(g, now))) return false;
  return f.doorStatus === 'canceled';
}

export interface ReopenDeps {
  now(): Date;
  readFacts(orgId: string): Promise<CloseAgainFacts | null>;
  /** The restore an operator's plan change runs (lib/billing-reactivation.ts), at the plan's tournament limit. */
  restore(orgId: string): Promise<void>;
  /** The one ending (`applyEnding`), marked `freeTimeEnded`, with the owners told. */
  endAgain(orgId: string, actor: ReopenActor): Promise<{ applied: boolean; retentionUntil: string | null }>;
  /** Records still kept from the first ending get the new window (and leave pending purge). Resolves how many moved. */
  extendKept(orgId: string, retentionUntil: string): Promise<number>;
  /** Clubs with a marked billing-status grant that is over, still ended and not suspended. */
  candidates(now: Date): Promise<string[]>;
}

/**
 * The retention sweep's pause: a record an organization's ending kept is not warned about or moved to pending purge while
 * FREE TIME lets the ended club in (its own status still `canceled`, the door's answer not). A club that paid again is not
 * paused (/review 2026-11-18): the tournaments past its plan's limit that a reactivation leaves kept count down as a move
 * to a lower plan's remainder does. Any other record (a move to a lower plan's, a Coaches Portal's) and a club the door
 * cannot read keep their countdown.
 */
export function countdownPaused(
  retentionReason: string | null | undefined,
  storedStatus: string | null | undefined,
  doorStatus: string | null | undefined,
): boolean {
  return CANCELLATION_REASONS.includes(retentionReason ?? '') && storedStatus === 'canceled' && !!doorStatus && doorStatus !== 'canceled';
}

/** On give, for a grant that reopened an ended club. Null, or the warning to show staff. */
export async function reopenOnGive(orgId: string, deps: Pick<ReopenDeps, 'restore'>): Promise<string | null> {
  try {
    await deps.restore(orgId);
    return null;
  } catch (error) {
    console.error('[free-time] reopening an ended club failed:', error);
    return REOPEN_FAILED_WARNING;
  }
}

export type CloseAgainResult = { closed: boolean; retentionUntil: string | null; keptExtended: number };

/**
 * After free time stopped (any way): close the club again if `shouldCloseAgain`. Throws when the ending fails.
 *
 * ⚠ The first ending's kept records move to the fresh window BEFORE the ending runs (/review 2026-11-18): the ending
 * suspends the club part-way, and a suspended club is never a candidate again, so a move left for afterwards would never be
 * retried if anything after the suspension failed. Moved first, a failure anywhere is retried whole by the daily job (the
 * club is not yet suspended), and a move made for an ending that then failed only ever made a date later.
 */
export async function closeAgainIfFreeTimeOver(orgId: string, actor: ReopenActor, deps: ReopenDeps): Promise<CloseAgainResult> {
  const facts = await deps.readFacts(orgId);
  const now = deps.now();
  if (!facts || !shouldCloseAgain(facts, now)) return { closed: false, retentionUntil: null, keptExtended: 0 };
  const keptExtended = await deps.extendKept(orgId, retentionUntilFrom(now.toISOString(), BILLING_RETENTION_DAYS));
  const ended = await deps.endAgain(orgId, actor);
  return { closed: ended.applied, retentionUntil: ended.retentionUntil, keptExtended };
}

/**
 * The daily job's step: every club whose reopening free time ran out by date (or was ended and the close-again failed).
 * One club's failure never stops the next; any failure throws at the end, so the job's record says so.
 */
export async function closeAgainExpiredFreeTime(deps: ReopenDeps): Promise<{ checked: number; closed: number }> {
  const ids = await deps.candidates(deps.now());
  let closed = 0;
  const failed: string[] = [];
  for (const orgId of ids) {
    try {
      if ((await closeAgainIfFreeTimeOver(orgId, SYSTEM_ACTOR, deps)).closed) closed++;
    } catch (error) {
      console.error(`[free-time] closing ${orgId} again failed:`, error);
      failed.push(orgId);
    }
  }
  if (failed.length > 0) throw new Error(`Closed ${closed} of ${ids.length}; ${failed.length} failed: ${failed.join(', ')}`);
  return { checked: ids.length, closed };
}
