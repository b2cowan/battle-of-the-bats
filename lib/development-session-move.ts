import 'server-only';
import { restampRepSessionMeasurables, restampRepSessionObservations, updateRepTeamEvaluationSession } from './db';
import type { RepTeamEvaluationSession } from './types';

/**
 * Move an evaluation session to another day — THE RE-STAMP (plan §10.1), in one place.
 *
 * A result is stamped with the session's date at the moment it is typed, so moving the session's
 * date MUST move the results collected in it — otherwise the session silently disagrees with its
 * own contents and every trend line plots on the wrong day. An observation recorded on the skill
 * chip is dated by the session the same way (the sheet says so: "dated by the session"), so it
 * moves too. Three writes, no transaction, so the order and the failure direction are handled by hand:
 *   1. re-stamp the results FIRST, so a failure here leaves both sides on the old date (consistent)
 *      rather than a moved header over stale results;
 *   2. then move the session row — and if THAT fails (a concurrent delete, a transient error), put
 *      the results back where they were, and say plainly if even that fails.
 *
 * Two doors call it (re-evaluation stage 2, C10, 2026-09-15): the session's own date change (the
 * sheet's "On a date", or "At a practice" taking the practice's day), and the PRACTICE's date change
 * on the Schedule — a session is created at the practice, so a practice whose day changes after
 * results were taken is a date correction and the results follow. The other fields ride the same
 * update so the move and, say, the link land in one write.
 */
export async function moveRepSessionDate(args: {
  session: RepTeamEvaluationSession;
  teamId: string;
  programYearId: string;
  sessionDate: string;
  /** Anything else the same update should carry (the link, the note, the plan). */
  fields?: Omit<Parameters<typeof updateRepTeamEvaluationSession>[3], 'sessionDate'>;
}): Promise<{ session: RepTeamEvaluationSession; restampedCount: number } | { error: string; status: 404 | 500 }> {
  const { session, teamId, programYearId, sessionDate } = args;
  const previousDate = session.sessionDate;
  const moving = sessionDate !== previousDate;
  let restampedCount = 0;
  let restampedObservations = 0;
  if (moving) restampedCount = await restampRepSessionMeasurables(session.id, teamId, sessionDate);
  if (moving) restampedObservations = await restampRepSessionObservations(session.id, teamId, sessionDate);

  const updated = await updateRepTeamEvaluationSession(session.id, teamId, programYearId, { ...(args.fields ?? {}), sessionDate });
  if (updated) return { session: updated, restampedCount };

  if (moving && (restampedCount > 0 || restampedObservations > 0)) {
    try {
      await restampRepSessionMeasurables(session.id, teamId, previousDate);
      await restampRepSessionObservations(session.id, teamId, previousDate);
    } catch {
      return {
        error: `The session could not be moved, and ${describeRestamped(restampedCount, restampedObservations)} may now carry the wrong date. Reload and check the date on this session before entering anything else.`,
        status: 500,
      };
    }
  }
  return { error: 'Session not found', status: 404 };
}

/** "3 results and 1 observation" — what the failed move may have left on the wrong date. */
function describeRestamped(results: number, observations: number): string {
  const parts: string[] = [];
  if (results > 0) parts.push(`${results} result${results === 1 ? '' : 's'}`);
  if (observations > 0) parts.push(`${observations} observation${observations === 1 ? '' : 's'}`);
  return parts.join(' and ');
}
