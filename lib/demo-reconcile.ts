import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import {
  reconcileDemoTournament as reconcileWith,
  type DemoReconcileResult,
} from './demo-reconcile-core';

/**
 * lib/demo-reconcile.ts — the server-side binding of the demo reconcile job.
 *
 * All of the logic lives in `demo-reconcile-core.ts`, which takes its database client as a
 * parameter so the same implementation can be run from a plain Node script during development.
 * This module is the app's binding of it: service-role client, `server-only` so it can never be
 * pulled into a client bundle.
 */
export type { DemoReconcileResult } from './demo-reconcile-core';

export function reconcileDemoTournament(now?: Date): Promise<DemoReconcileResult> {
  return reconcileWith(supabaseAdmin, now);
}
