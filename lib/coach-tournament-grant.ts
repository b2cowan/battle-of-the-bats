/**
 * THE TOURNAMENT BUNDLE — what the coach portal's "Run tournaments" switch means on the admin side.
 *
 * Tournaments are run on the admin side, and every admin tournament page and route decides on the
 * person's ORG membership: `organization_members.capabilities`, the per-member override map that
 * `hasCapability()` consults before role defaults. A coach-portal staff member holds org role
 * `coach`, which carries nothing (audit J4-005). So "run tournaments" = these keys, written onto
 * that map as overrides; "off" = exactly these keys removed, leaving anything else an admin set.
 *
 * ⚠ ONE switch, EVERYTHING on the tournament page (owner ruling 2026-09-13): *"for those that
 * have it can do everything in that tournament page, so we don't need further tournament staff
 * permissions in there like we have in the tournament standalone accounts."* The bundle is the
 * tournament module plus every tournament ACTION capability and the tournament's own look
 * (`manage_branding`, D4). Never `manage_members`, `org_settings`, `billing`, and no other module.
 *
 * Pure — no I/O — so the sheet, the projection and the tests share one definition.
 */
import type { Capability } from './roles';

export const TOURNAMENT_BUNDLE: ReadonlyArray<Capability> = [
  'module_tournaments',
  'create_tournaments',
  'manage_registrations',
  'manage_schedule_structure',
  'update_schedule',
  'submit_scores',
  'check_in_teams',
  'manage_contacts',
  'post_announcements',
  'post_rules',
  'send_communications',
  'seal_tournaments',
  'manage_branding',
];

/** The one key every tournament WRITE route checks — the bundle's presence is read from it. */
export const TOURNAMENT_GRANT_KEY: Capability = 'create_tournaments';

export type CapabilityOverrides = Record<string, boolean> | null | undefined;

/** Whether a member's override map holds the bundle. A partial hand-set map reads as OFF. */
export function readTournamentGrant(overrides: CapabilityOverrides): boolean {
  return overrides?.[TOURNAMENT_GRANT_KEY] === true;
}

/**
 * The map with the bundle applied (on) or removed (off). Returns the SAME object when nothing
 * would change, so a caller can skip the write. Never touches keys outside the bundle.
 */
export function applyTournamentGrant(overrides: CapabilityOverrides, on: boolean): Record<string, boolean> | null {
  const current: Record<string, boolean> = { ...(overrides ?? {}) };
  let changed = false;
  for (const key of TOURNAMENT_BUNDLE) {
    if (on) {
      if (current[key] !== true) { current[key] = true; changed = true; }
    } else if (key in current) {
      delete current[key];
      changed = true;
    }
  }
  if (!changed) return overrides ?? null;
  return Object.keys(current).length === 0 ? null : current;
}
