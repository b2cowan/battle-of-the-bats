// The support console's ONE RULEBOOK (Support console Stage 2, owner rulings 2026-10-25; drawings Ub7fXLh29SC34Zp4oqKUx1,
// "One rulebook"). Who may do what, written once, BY POWER — and the menu, the pages and every console API read it.
//
// PURE + client-safe: this module has no server-only runtime imports (the only import is a type, which is erased at
// build), so the server guards, the pages and the client menu share one source of truth.
//
// ⚖ WHY BY POWER. Until Stage 2 two tables decided: this file worked by PAGE (view/write roles per area) and
// `lib/platform-auth.ts` worked by PERMISSION (`ROLE_PERMISSIONS`). They were written at different times and drifted —
// the page table said nobody edits a club while support, billing and product all did, so the read-only eye never
// showed on Organizations, not even for a read-only account. Now:
//   • POWERS say what a role may DO (`PLATFORM_POWERS`); every console API checks one as its first step
//     (`requirePlatformPower` / `requireAnyPlatformPower` / `requirePlatformAreaApi`);
//   • AREAS say who may OPEN a page (`viewRoles`) and which powers that page uses (`powers`). "Write" an area = hold any
//     power its page uses; the eye shows when a role can open a page but holds none of them.
// `tests/unit/support-console-stage2-guard.test.ts` fails the build if a console route reads a role any other way.
// ⚠ Do not add a third table. A new action is a new power (or an existing one) here, and a route that checks it.
//
// super_admin holds every power and opens every area.

import type { PlatformRole } from './platform-auth';

export type PlatformPower =
  /** Open Today, Clubs & portals, People and the Audit log; use Find. */
  | 'view_console'
  /** Email the owner from a record (opens your own mail). */
  | 'email_owner'
  /** A club's notes, name, web name, owner and own web address. */
  | 'club_support'
  /** Act on a person: reset link, confirm email, sign out everywhere, ban, change email or name, notes. */
  | 'person_support'
  /** A club's plan, limits and overrides; cancel its subscription. */
  | 'club_billing'
  /** A club's section access (the add-on modules). */
  | 'club_sections'
  /** Delete a club or a person. */
  | 'delete_records'
  /** Bulk changes: plan and status. */
  | 'bulk_plan_status'
  /** Bulk changes: sections. */
  | 'bulk_sections'
  /** Retention: extend and process. */
  | 'retention'
  /** Errors: triage. */
  | 'errors_triage'
  /** Feedback: triage and escalate. */
  | 'feedback_triage'
  /** Plans & pricing, the Approval queue, Email templates: every write. */
  | 'catalog'
  /** Leads, Campaigns, Pitch decks: every write. */
  | 'growth'
  /** A metric snapshot on Business numbers (a product decision log). */
  | 'metric_snapshot'
  /** Staff and roles. */
  | 'staff'
  /** Read the trail of records opened, in the Audit log (owner A3: Super admin only). */
  | 'records_opened'
  /** Find's Stripe group (owner A2): whole customer, subscription and family-payment numbers. */
  | 'find_stripe'
  /** Run a scheduled job by hand, and sweep the error store. */
  | 'run_jobs'
  /**
   * Refund a club's subscription charge from its Money tab (Support console Stage 3, owner Q1 2026-10-26): Super admin
   * and Billing. Support reads Stripe (`find_stripe`) and hands a refund on. Billing's older-than-6-months and
   * sixth-in-24-hours limits are the refund route's, not this list's.
   */
  | 'refund'
  /** The dev-only seed console (and only where NEXT_PUBLIC_ENABLE_DEV_TOOLS is on). */
  | 'dev_tools';

const ALL_ROLES: PlatformRole[] = ['super_admin', 'billing', 'support', 'product', 'growth', 'read_only'];

/**
 * THE POWERS — the drawings' rulebook table, owner A1 applied: Billing does NOT hold Support's club and person powers
 * (`club_support`, `person_support`), and keeps feedback triage (F3, 2026-06-14) and Email the owner. super_admin is
 * listed for readability; `hasPlatformPower` lets it through regardless.
 */
export const PLATFORM_POWERS: Record<PlatformPower, readonly PlatformRole[]> = {
  view_console:     ALL_ROLES,
  email_owner:      ['super_admin', 'support', 'billing'],
  club_support:     ['super_admin', 'support'],
  person_support:   ['super_admin', 'support'],
  club_billing:     ['super_admin', 'billing'],
  club_sections:    ['super_admin', 'product'],
  delete_records:   ['super_admin'],
  bulk_plan_status: ['super_admin', 'billing'],
  bulk_sections:    ['super_admin', 'product'],
  retention:        ['super_admin', 'billing'],
  errors_triage:    ['super_admin', 'product'],
  feedback_triage:  ['super_admin', 'support', 'billing', 'product'],
  catalog:          ['super_admin', 'product'],
  growth:           ['super_admin', 'product', 'growth'],
  metric_snapshot:  ['super_admin', 'product'],
  staff:            ['super_admin'],
  records_opened:   ['super_admin'],
  find_stripe:      ['super_admin', 'billing', 'support'],
  refund:           ['super_admin', 'billing'],
  run_jobs:         ['super_admin'],
  dev_tools:        ['super_admin'],
};

export function hasPlatformPower(role: PlatformRole, power: PlatformPower): boolean {
  if (role === 'super_admin') return true;
  return PLATFORM_POWERS[power].includes(role);
}

export type PlatformArea =
  | 'overview'
  | 'organizations'
  | 'customer_users'
  | 'retention'
  | 'early_access'
  | 'email'
  | 'pitch_deck_studio'
  | 'change_requests'
  | 'plans_pricing'
  | 'bulk_operations'
  | 'free_time'
  | 'platform_users'
  | 'audit'
  | 'observability'
  | 'feedback'
  | 'email_templates'
  | 'help'
  | 'export_registry'
  | 'dev_tools';

/** Who may open the page, and the powers its page uses (none = a page with nothing to change: never the eye). */
type AreaAccess = { viewRoles: readonly PlatformRole[]; powers: readonly PlatformPower[] };

/**
 * THE PAGES. Who opens each one is unchanged by Stage 2 (owner: "every role keeps the same pages it has now"); what
 * changed is that each page's write side is now the powers its own controls use, so the eye tells the truth — Growth
 * and Read only see it on Clubs & portals and People, Support on Retention and Errors, Billing on Plans & pricing, the
 * Approval queue and (after A1) People.
 */
export const PLATFORM_AREAS: Record<PlatformArea, AreaAccess> = {
  // Today, and the two customer lists — every role opens them (the Find row of the rulebook)
  overview:        { viewRoles: ALL_ROLES, powers: [] },
  organizations:   { viewRoles: ALL_ROLES, powers: ['club_support', 'club_billing', 'club_sections', 'delete_records'] },
  customer_users:  { viewRoles: ALL_ROLES, powers: ['person_support', 'delete_records'] },
  audit:           { viewRoles: ALL_ROLES, powers: [] },
  help:            { viewRoles: ALL_ROLES, powers: [] },

  retention:       { viewRoles: ['super_admin', 'billing', 'support'], powers: ['retention'] },
  bulk_operations: { viewRoles: ['super_admin', 'billing', 'product'], powers: ['bulk_plan_status', 'bulk_sections'] },
  /* Free time (Support console Stage 4): everyone with free time running, in three views — Everyone, Founding Season
     (the Founding desk, whole) and Given by staff. It replaced the Founding season desk's menu entry.
     ⚠ NO WRITES, DELIBERATELY: nothing on the list acts (no bulk end, no bulk extend). The Founding desk was read-only on
     purpose (owner-approved 2026-09-07) and a group-wide change to Founding Season is its turn-off decision, not a support
     action. Free time is given, changed and ended on a club's record, by the plan-and-billing power (owner ruling Q2), so
     that is the write side the eye reads. SUPPORT sees it because "when does my free time end" is a support question;
     PRODUCT because "did they choose a plan?" is a roadmap question before it is a billing one. */
  free_time: { viewRoles: ['super_admin', 'billing', 'support', 'product'], powers: ['club_billing'] },

  plans_pricing:   { viewRoles: ['super_admin', 'product', 'billing'], powers: ['catalog'] },
  change_requests: { viewRoles: ['super_admin', 'product', 'billing'], powers: ['catalog'] },
  email_templates: { viewRoles: ['super_admin', 'product'], powers: ['catalog'] },
  /* Every way data leaves the product — read-only, and no writes exist: the list is generated
     from the code and proven against it on every build, so there is nothing here to edit.
     SUPPORT can see it because "can this customer export X?" is a support question before it
     is a product one. */
  export_registry: { viewRoles: ['super_admin', 'product', 'billing', 'support'], powers: [] },

  early_access:    { viewRoles: ['super_admin', 'product', 'growth'], powers: ['growth'] },
  email:           { viewRoles: ['super_admin', 'product', 'growth'], powers: ['growth'] },
  // The pitch slide library + deck composition. Company-owned material aimed at people who are
  // not customers yet, so it sits with the other Growth rooms. ⚠ Writes are COMPOSITION ONLY —
  // which slides each public page pulls (pitch_page_pulls, stage B) and each deck's running
  // order/name/purpose incl. prospect decks with unlisted links (pitch_decks, stages C+D). A
  // slide's words and picture stay code and are never editable from here (owner ruling 1,
  // 2026-08-21).
  pitch_deck_studio: { viewRoles: ['super_admin', 'product', 'growth'], powers: ['growth'] },

  platform_users:  { viewRoles: ['super_admin'], powers: ['staff'] },
  // Errors — triage stays product's (engineering signal); support reads them.
  observability:   { viewRoles: ['super_admin', 'product', 'support'], powers: ['errors_triage'] },
  // Customer-feedback triage — distinct from error triage. Support, billing and product triage it (F3, 2026-06-14);
  // ⚠ it is its own power, so Billing keeps it although A1 took Support's account powers away.
  feedback:        { viewRoles: ['super_admin', 'product', 'support', 'billing'], powers: ['feedback_triage'] },
  dev_tools:       { viewRoles: ['super_admin'], powers: ['dev_tools'] },
};

export function canViewPlatformArea(role: PlatformRole, area: PlatformArea): boolean {
  if (role === 'super_admin') return true;
  return PLATFORM_AREAS[area].viewRoles.includes(role);
}

/** The role holds at least one power the area's page uses. */
export function canWritePlatformArea(role: PlatformRole, area: PlatformArea): boolean {
  return PLATFORM_AREAS[area].powers.some(power => hasPlatformPower(role, power));
}

/** The eye: the role can open the page, the page has controls, and the role holds none of their powers. */
export function isPlatformAreaReadOnly(role: PlatformRole, area: PlatformArea): boolean {
  return (
    canViewPlatformArea(role, area) &&
    PLATFORM_AREAS[area].powers.length > 0 &&
    !canWritePlatformArea(role, area)
  );
}
