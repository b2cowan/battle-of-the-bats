import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { planCarriesModule, type EntitlementOrg } from './module-entitlements';
import { ROLE_LABEL } from './member-access';
import type { OrgRole } from './types';

/**
 * WHICH ROLES THIS ORGANIZATION CAN HAND OUT — the one list behind the invite and Manage role
 * dropdowns (Stage 1 specimen 5) and behind the invite and role-change routes, so the screen can
 * never offer a role the server would refuse.
 *
 * A role is offered when the program it runs exists here:
 *   · Admin, Staff and Volunteer — always.
 *   · Treasurer — when the plan carries Accounting (a treasurer on a plan with no books would be
 *     given a role that opens nothing).
 *   · League admin / League registrar — ⚖ Ask 2 (2026-09-25): only when the club RUNS a house
 *     league. League Plus and the League Starter floor are house leagues by definition; a Club runs
 *     one once it has created a season. A rep club's registrar is a Stage 2 question (S1-01).
 *   · Never Owner (not assignable), never Coach (coaching staff are added on a team's staff page —
 *     the Coach row joins with Stage 2's "Invite a coach" door, ruling D10).
 *
 * The order and the three group headings are specimen 5's.
 */

export type AssignableRoleGroup = 'runs_the_club' | 'house_league' | 'volunteers';

export type AssignableRole = {
  role: OrgRole;
  label: string;
  /** The two-word hint the dropdown shows beside the name. Placement words for /marketing. */
  hint: string;
  group: AssignableRoleGroup;
};

export type AssignableRolesOrg = EntitlementOrg & { id: string };

const HINT: Partial<Record<OrgRole, string>> = {
  admin: 'every program',
  treasurer: 'the money',
  staff: 'game-day help',
  league_admin: 'runs the house league',
  league_registrar: 'league sign-ups',
  official: 'scores or the gate',
};

/**
 * Does this organization run a house league? (Ask 2.) One read, only for a Club. The hub's
 * plan-aware order asks the same question (`/api/admin/club-brief`'s `shape`), so the dropdown and the
 * nav can never disagree about whether a club runs one.
 */
export async function orgRunsHouseLeague(org: AssignableRolesOrg): Promise<boolean> {
  if (!planCarriesModule(org, 'module_house_league')) return false;
  if (org.planId === 'league' || org.freeFloor === 'league_starter') return true;
  const { count, error } = await supabaseAdmin
    .from('league_seasons')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id);
  if (error) {
    // The dropdown then offers fewer roles, never more — a refusal the owner can retry is better
    // than handing out a role for a program that may not exist.
    console.error('[board-roles] league season count failed:', error);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function assignableRolesForOrg(org: AssignableRolesOrg): Promise<AssignableRole[]> {
  const runsHouseLeague = await orgRunsHouseLeague(org);
  const make = (role: OrgRole, group: AssignableRoleGroup): AssignableRole =>
    ({ role, label: ROLE_LABEL[role], hint: HINT[role] ?? '', group });

  const roles: AssignableRole[] = [make('admin', 'runs_the_club')];
  if (planCarriesModule(org, 'module_accounting')) roles.push(make('treasurer', 'runs_the_club'));
  roles.push(make('staff', 'runs_the_club'));
  if (runsHouseLeague) {
    roles.push(make('league_admin', 'house_league'), make('league_registrar', 'house_league'));
  }
  roles.push(make('official', 'volunteers'));
  return roles;
}

/** Is `role` one this organization may hand out right now? */
export async function isAssignableRole(org: AssignableRolesOrg, role: unknown): Promise<boolean> {
  if (typeof role !== 'string') return false;
  return (await assignableRolesForOrg(org)).some(r => r.role === role);
}

/**
 * S1-03 — the board endpoints refuse coaching-staff rows. Since 2026-08-16 every accepted staff
 * invite writes a capability-less `coach` membership so the person can sign in; that row is
 * plumbing for a TEAM's staff list (its invite is the staff invite, not an organization invitation).
 * Managing it in Members could hand a coach board powers, and removing it there also stripped their
 * coaching assignments. Their home is the team's staff page. One refusal for Manage role, Remove
 * and Resend invite, so the screen sees one code.
 */
export function coachingStaffRowRefusal() {
  return NextResponse.json(
    {
      error: 'Coaching staff are managed on their team’s staff page, not in Members.',
      code: 'coaching_staff_row',
    },
    { status: 409 },
  );
}
