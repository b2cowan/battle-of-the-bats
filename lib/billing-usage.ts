import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getNonArchivedRepTeamCount } from './db';
import { PLAN_CONFIG } from './plan-config';
import { seatExemptRoles } from './roles';
import { SLOT_STATUSES } from './tournament-slot';
import type { Organization } from './types';
import type { BillingUsage } from './plan-billing-data';

/** The same active/non-archived team source used by creation enforcement and cancellation preflight. */
export const billingActiveTeamCount = getNonArchivedRepTeamCount;

/** Aggregates only; a failed read must never turn into an empty meter. */
export async function readBillingUsage(org: Organization): Promise<BillingUsage> {
  const plan = PLAN_CONFIG[org.planId];
  const [teams, tournaments, staff, officials] = await Promise.all([
    billingActiveTeamCount(org.id),
    supabaseAdmin.from('tournaments').select('id', { count: 'exact', head: true })
      .eq('org_id', org.id).in('status', [...SLOT_STATUSES]),
    supabaseAdmin.from('organization_members').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id).not('role', 'in', `(${seatExemptRoles(plan).join(',')})`),
    // Only plans with free scorekeeper seats show the figure; the rest skip the query.
    plan.officialsFreeSeats
      ? supabaseAdmin.from('organization_members').select('id', { count: 'exact', head: true })
        .eq('organization_id', org.id).eq('role', 'official')
      : Promise.resolve({ count: 0, error: null }),
  ]);
  for (const result of [tournaments, staff, officials]) {
    if (result.error || result.count === null) throw new Error('Billing usage could not be read.');
  }
  return {
    teams: { count: teams, limit: org.teamLimit },
    tournament_slots: { count: tournaments.count!, limit: org.tournamentLimit },
    staff_seats: { count: staff.count!, limit: plan.seatLimit },
    officials: plan.officialsFreeSeats ? officials.count! : 0,
  };
}
