import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * THE FEEDBACK FORM'S DAILY CAP, kept in the database (Board Ready sweep 3, small). The per-minute and per-5-minutes
 * throttles in `app/api/feedback/route.ts` live in one server instance's memory, so a caller who reaches many warm
 * instances (or just waits for a new one) sees none of them, and every accepted submission emails the admin inbox. This
 * counts what was actually SAVED in the last 24 hours, which every instance sees alike.
 *
 * Coarse on purpose: count-then-insert is not atomic, so a burst can overshoot by the number of requests already in
 * flight. The point is that a day's flood is bounded by a small number, not that the number is exact.
 *
 *   anonymous: at most ANON_PER_IP_PER_DAY from one address, and ANON_ALL_PER_DAY from everyone;
 *   signed in: at most USER_PER_DAY from one account.
 *
 * A read that fails lets the submission through: the insert that follows would fail too if the database were down, and a
 * feedback form must never lose a real bug report to its own guard.
 */
export const ANON_PER_IP_PER_DAY = 5;
export const ANON_ALL_PER_DAY = 40;
export const USER_PER_DAY = 10;

const DAY_MS = 24 * 3_600_000;

export async function feedbackOverDailyCap(who: { userId: string | null; ip: string }): Promise<boolean> {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  try {
    if (who.userId) {
      const { count, error } = await supabaseAdmin.from('feedback_submissions')
        .select('id', { count: 'exact', head: true }).eq('user_id', who.userId).gte('created_at', since);
      if (error) throw error;
      return (count ?? 0) >= USER_PER_DAY;
    }
    const [{ count: all, error: allError }, { count: mine, error: mineError }] = await Promise.all([
      supabaseAdmin.from('feedback_submissions').select('id', { count: 'exact', head: true }).is('user_id', null).gte('created_at', since),
      supabaseAdmin.from('feedback_submissions').select('id', { count: 'exact', head: true }).is('user_id', null).eq('context->>ip', who.ip).gte('created_at', since),
    ]);
    if (allError) throw allError;
    if (mineError) throw mineError;
    return (all ?? 0) >= ANON_ALL_PER_DAY || (mine ?? 0) >= ANON_PER_IP_PER_DAY;
  } catch (e) {
    console.error('[feedback] the daily cap could not be read:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
