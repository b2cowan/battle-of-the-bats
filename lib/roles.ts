import type { OrgRole } from './types';
import { invitationLapseCutoff } from './invitation-lapse';

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
  // The programs a paid plan adds. Off for staff/official by default; ON for admin (ruling D8,
  // 2026-09-25 — see ROLE_DEFAULTS.admin); each role that runs one program holds that one.
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
  | 'module_families'
  // ⚖ Board Ready Stage 6, ask 12 + its note (owner 2026-11-22; round 2 tab 3): the club's Sponsorships place. ON by default
  // for the owner, admins and the treasurer; off for every other role; a club may turn it on for anyone (e.g. a registrar).
  // Paired with the plan's entitlement (League Plus and both Club bands) like every area. Invoice details inside it are
  // changed by the owner, admins and the treasurer ONLY (lib/club-sponsorships-place.ts), whoever else holds this.
  | 'module_sponsorships';

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
    // ⚖ RULING D8 (owner, 2026-09-25): an admin opens EVERY program the plan carries. These four
    // are only ever half the answer — every gate pairs the role's capability with the org's
    // entitlement (`canOpenModule` in lib/member-access.ts), so on a plan without a program the
    // admin still cannot open it. Before D8 an admin held none of them, so the hub read a club's
    // vice-president as a tournament-only user and bounced them out (A01, J4-040, J10-027).
    // ⚠ NOT `module_families` (explicit grant only, CLUB_FAMILIES_BOOK_PLAN §1.2) and NEVER
    // `billing` / `org_settings` (owner-only powers, never a default). tests/unit/role-defaults-guard.test.ts pins all three.
    'module_rep_teams', 'module_accounting', 'module_public_site', 'module_house_league',
    'module_sponsorships',
  ]),
  staff: new Set<Capability>([
    'update_schedule', 'submit_scores', 'check_in_teams', 'post_announcements',
    // default-on module cap
    'module_tournaments',
  ]),
  official: new Set<Capability>(['submit_scores', 'check_in_teams']),
  // ⚖ module_communications (Club Communications Stage 1, asks 5 and 16, owner 2026-11-16): ON by default for every seat on
  // the club's board — the league admin and registrar (their season's families and house-league coaches) and the treasurer
  // (the board). Off = no group email from any screen; receiving board email never asks it. Pinned by role-defaults-guard.
  league_admin: new Set<Capability>([
    'module_house_league',
    'module_members',
    'module_communications',
  ]),
  league_registrar: new Set<Capability>([
    'module_house_league',
    'module_communications',
  ]),
  treasurer: new Set<Capability>([
    'module_accounting',
    'module_members',
    'module_communications',
    // Board Ready Stage 6, ask 12 (owner 2026-11-22): the treasurer opens Sponsorships by default.
    'module_sponsorships',
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
  'module_families', 'module_sponsorships',
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

/** The roles `countsAsSeat` excludes. A database count uses `seatRowsFilter`, never these alone. */
export function seatExemptRoles(plan: { officialsFreeSeats: boolean }): string[] {
  return plan.officialsFreeSeats ? ['coach', 'official'] : ['coach'];
}

/**
 * The seat count's filter for a database read, as `.or(seatRowsFilter(plan))`: a row is a seat when its role is one, OR
 * when the board role WAITING on it is one (a club's coach invited to the board, trust close-out 13 P2b, mig 503). A
 * pending invitation holds its seat, so a waiting board role does too. (`pending_role` is NULL on every other row, and
 * NULL `not.in` is never true, so those rows count by their role alone.)
 */
export function seatRowsFilter(plan: { officialsFreeSeats: boolean }): string {
  const exempt = `(${seatExemptRoles(plan).join(',')})`;
  // ⚖ A run-out invitation holds no seat (P2c, lib/invitation-lapse.ts): a pending row counts only inside its 30 days.
  const c = invitationLapseCutoff();
  // A waiting role counts only on an ACTIVE coach row, the rows `waitingBoardRole` offers (/review: one answer everywhere).
  return `and(role.not.in.${exempt},or(status.neq.invited,invited_at.gte.${c})),and(status.eq.active,pending_role.not.in.${exempt},pending_invited_at.gte.${c})`;
}

/** The volunteer figure's filter (plans where volunteers are free): a volunteer, or a coach's waiting volunteer role (live ones). */
export function volunteerRowsFilter(): string {
  const c = invitationLapseCutoff();
  return `and(role.eq.official,or(status.neq.invited,invited_at.gte.${c})),and(status.eq.active,pending_role.eq.official,pending_invited_at.gte.${c})`;
}

export function hasCapability(
  role: OrgRole,
  capabilities: Record<string, boolean> | null,
  cap: Capability,
): boolean {
  if (role === 'owner') return true;
  // Plan & billing and organization settings are the owner's alone (owner, 2026-10-29): no role default and
  // no stored override can give them, so a stray grant in a member's capabilities is inert.
  if (cap === 'billing' || cap === 'org_settings') return false;
  const override = capabilities?.[cap];
  if (override !== undefined) return override;
  return ROLE_DEFAULTS[role].has(cap);
}

/** Can this person open Plan & billing? The owner only (owner, 2026-10-29); no role at all is a no. */
export function hasBillingAccess(role: OrgRole | null | undefined, capabilities: Record<string, boolean> | null): boolean {
  return !!role && hasCapability(role, capabilities, 'billing');
}
