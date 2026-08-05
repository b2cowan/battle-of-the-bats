import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { reconcileCoachSandbox as reconcileCore, type CoachReconcileResult } from './demo-coach-reconcile-core.ts';

/**
 * lib/demo-coach-reconcile.ts — the server binding for the coach sandbox's nightly re-anchor.
 * All logic lives in `lib/demo-coach-reconcile-core.ts` (pure, db-as-parameter) so a scheduled
 * route and a command-line run share one implementation — the same split as the tournament's
 * `lib/demo-reconcile.ts`.
 */
export async function reconcileCoachSandbox(now: Date = new Date()): Promise<CoachReconcileResult> {
  return reconcileCore(supabaseAdmin, now);
}

export type { CoachReconcileResult };
