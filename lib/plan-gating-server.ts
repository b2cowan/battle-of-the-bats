import 'server-only';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG } from './plan-config';
import type { OrgPlan } from './types';

export type PlanGatingMap = Record<OrgPlan, boolean>; // true = gated (early_access)

const ALL_PLANS: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];

function fromPlanConfig(): PlanGatingMap {
  return Object.fromEntries(
    ALL_PLANS.map(k => [k, PLAN_CONFIG[k].gatingStatus === 'early_access'])
  ) as PlanGatingMap;
}

function allLive(): PlanGatingMap {
  return Object.fromEntries(ALL_PLANS.map(k => [k, false])) as PlanGatingMap;
}

/** The plans that are not on sale on production until the gate flip (CLUB_GATE_FLIP_RUNBOOK.md): "show as closed". */
const CLOSED_ON_PRODUCTION: OrgPlan[] = ['league', 'club', 'club_large'];

/**
 * Resolves which plans are gated (early_access) for the current request.
 * Priority:
 *   1. dev_plan_gates cookie (local only, behind NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE):
 *      'live' forces all-live; 'closed' shows production's closed state — League Plus, Club and Club · Association
 *      closed over whatever the rows say (dev's rows are all live by the owner's 2026-10-30 ruling, so without this
 *      dev cannot show a closed page; on-sale pages S1). Dev's rows are never touched.
 *   2. NEXT_PUBLIC_PLAN_GATES env var — forces all-live when set to 'live'
 *   3. plan_gating DB table — per-plan status managed by platform admin
 *   4. PLAN_CONFIG.gatingStatus — fallback if DB is unavailable
 *
 * ⚠ PER REQUEST, ALWAYS. `connection()` makes every route that reads the gate render on each visit. Without it a page
 * that used no other request-time API was prerendered at `next build` and served for a year: the five public plan pages
 * were (production headers and the build route table, 2026-11-18), so flipping a row in platform admin reached none of
 * them until the next deploy. The gate is request-time data; reading it is what makes a route dynamic.
 */
export async function getPlanGatingMap(): Promise<PlanGatingMap> {
  await connection();
  // Cookie-based override is only available when the local-only plan gates toggle is enabled
  let showAsClosed = false;
  if (process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE === 'true') {
    const mode = (await cookies()).get('dev_plan_gates')?.value;
    if (mode === 'live') return allLive();
    showAsClosed = mode === 'closed';
  }
  const map = await readGatingRows();
  if (showAsClosed) for (const plan of CLOSED_ON_PRODUCTION) map[plan] = true;
  return map;
}

async function readGatingRows(): Promise<PlanGatingMap> {
  if (process.env.NEXT_PUBLIC_PLAN_GATES === 'live') return allLive();

  const { data, error } = await supabaseAdmin
    .from('plan_gating')
    .select('plan_key, gating_status');

  if (error || !data?.length) return fromPlanConfig();

  const map = fromPlanConfig();
  for (const row of data) {
    if (row.plan_key in map) {
      map[row.plan_key as OrgPlan] = row.gating_status === 'early_access';
    }
  }
  return map;
}

/**
 * "Can a coach buy (or, during Founding Season, claim) a Premium Coaches Portal right now?"
 *
 * One named question with one answer, because three separate surfaces were each spelling out
 * `!(await getPlanGatingMap()).team` from scratch — the /start chooser, the persona menu config and
 * (as of 2026-08-07) the homepage. Writing the predicate out per call site is exactly how the
 * homepage came to disagree with the other two for a fortnight after the gate opened on production:
 * nothing connects the copies, so nothing notices when one is missed.
 *
 * ⚠ Note the inversion — `true` in the gating map means GATED. Getting that backwards silently
 * offers a door that does not open, which is the failure this helper exists to make unlikely.
 */
export async function isCoachesPortalPurchasable(): Promise<boolean> {
  return !(await getPlanGatingMap()).team;
}
