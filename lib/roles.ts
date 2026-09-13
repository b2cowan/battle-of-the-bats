import type { OrgRole } from './types';

export type Capability =
  // --- existing action capabilities ---
  | 'create_tournaments'
  | 'manage_registrations'
  | 'manage_schedule_structure'
  | 'update_schedule'
  | 'submit_scores'
  | 'check_in_teams'
  | 'manage_contacts'
  | 'post_announcements'
  | 'post_rules'
  | 'send_communications'
  | 'seal_tournaments'
  | 'manage_branding'
  | 'manage_members'
  | 'org_settings'
  | 'billing'
  // --- module-level gates (coarser, checked before action caps) ---
  // Default-on: cover existing functionality
  | 'module_tournaments'
  | 'module_communications'
  | 'module_members'
  // Default-off: reserved for future premium modules (no ROLE_DEFAULTS entry)
  | 'module_public_site'
  | 'module_accounting'
  | 'module_house_league'
  | 'module_rep_teams'
  // ⚠ OFF BY DEFAULT FOR EVERY ROLE, deliberately — no ROLE_DEFAULTS entry anywhere,
  // not even admin. The Families area concentrates every household's contact details,
  // consent and balances on one searchable screen; the only ways in are the owner
  // short-circuit and an explicit per-member Grant (owner decision 2026-08-17,
  // CLUB_FAMILIES_BOOK_PLAN.md §1.2). Adding this to any role's defaults is a
  // decision for the owner, not a cleanup.
  | 'module_families';

export const ROLE_DEFAULTS: Record<OrgRole, Set<Capability>> = {
  owner: new Set<Capability>([
    'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
    'update_schedule', 'submit_scores', 'check_in_teams', 'manage_contacts', 'post_announcements',
    'post_rules', 'send_communications', 'seal_tournaments', 'manage_branding', 'manage_members',
    'org_settings', 'billing',
    // default-on module caps
    'module_tournaments', 'module_communications', 'module_members',
  ]),
  admin: new Set<Capability>([
    'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
    'update_schedule', 'submit_scores', 'check_in_teams', 'manage_contacts', 'post_announcements',
    'post_rules', 'send_communications', 'seal_tournaments', 'manage_branding', 'manage_members',
    // default-on module caps
    'module_tournaments', 'module_communications', 'module_members',
  ]),
  staff: new Set<Capability>([
    'update_schedule', 'submit_scores', 'check_in_teams', 'post_announcements',
    // default-on module cap
    'module_tournaments',
  ]),
  official: new Set<Capability>(['submit_scores', 'check_in_teams']),
  league_admin: new Set<Capability>([
    'module_house_league',
    'module_members',
  ]),
  league_registrar: new Set<Capability>([
    'module_house_league',
  ]),
  treasurer: new Set<Capability>([
    'module_accounting',
    'module_members',
  ]),
  coach: new Set<Capability>([
    // Intentionally empty. A coach reaches the Coaches Portal via their
    // rep_team_coaches assignment (resolveCoachContext / /api/coaches/**), NOT via this
    // org-level capability. Granting module_rep_teams here let coach-role members read
    // org-wide rep finance and every coach's email through the ADMIN rep-teams routes
    // (audit J4-005). The admin namespace is owner/admin-only; the portal is separate.
  ]),
};

export const ALL_CAPABILITY_KEYS: Capability[] = [
  'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
  'update_schedule', 'submit_scores', 'check_in_teams', 'manage_contacts', 'post_announcements',
  'post_rules', 'send_communications', 'seal_tournaments', 'manage_branding', 'manage_members',
  'org_settings', 'billing',
  'module_tournaments', 'module_communications', 'module_members',
  'module_public_site', 'module_accounting', 'module_house_league', 'module_rep_teams',
  'module_families',
];

/**
 * WHICH MEMBERSHIPS ARE SEATS (owner ruling 2026-09-13: *"coaching staff don't count"*).
 *
 * A plan's `seatLimit` counts admin/staff — the people who run the org side. Two kinds of
 * membership are never a seat:
 *   · `coach` — coaching staff. Since the team-membership model (2026-08-16) every accepted staff
 *     invite writes a capability-less coach-role membership so the person can sign in; that row
 *     is plumbing, and "coaching staff is unlimited on every tier" (2026-08-10) means it must not
 *     fill the bundled tournament-admin side's 3-seat guard in a Premium workspace. It did, until
 *     this ruling — a workspace with three coaching staff read its guard as FULL before any org-side
 *     co-organizer was invited.
 *   · `official` — on plans where `officialsFreeSeats` is on.
 * Every seat count and every seat-limit check reads this, so the three of them cannot drift.
 */
export function countsAsSeat(role: OrgRole | string, plan: { officialsFreeSeats: boolean }): boolean {
  if (role === 'coach') return false;
  if (role === 'official' && plan.officialsFreeSeats) return false;
  return true;
}

/** The roles `countsAsSeat` excludes, for a database count (`.not('role', 'in', …)`). */
export function seatExemptRoles(plan: { officialsFreeSeats: boolean }): string[] {
  return plan.officialsFreeSeats ? ['coach', 'official'] : ['coach'];
}

export function hasCapability(
  role: OrgRole,
  capabilities: Record<string, boolean> | null,
  cap: Capability,
): boolean {
  if (role === 'owner') return true;
  const override = capabilities?.[cap];
  if (override !== undefined) return override;
  return ROLE_DEFAULTS[role].has(cap);
}
