import type { OrgRole } from './types';

export type Capability =
  // --- existing action capabilities ---
  | 'create_tournaments'
  | 'manage_registrations'
  | 'manage_schedule_structure'
  | 'update_schedule'
  | 'submit_scores'
  | 'manage_contacts'
  | 'post_announcements'
  | 'post_rules'
  | 'send_communications'
  | 'seal_tournaments'
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
  | 'module_rep_teams';

export const ROLE_DEFAULTS: Record<OrgRole, Set<Capability>> = {
  owner: new Set<Capability>([
    'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
    'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
    'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
    'org_settings', 'billing',
    // default-on module caps
    'module_tournaments', 'module_communications', 'module_members',
  ]),
  admin: new Set<Capability>([
    'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
    'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
    'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
    // default-on module caps
    'module_tournaments', 'module_communications', 'module_members',
  ]),
  staff: new Set<Capability>([
    'update_schedule', 'submit_scores', 'post_announcements',
    // default-on module cap
    'module_tournaments',
  ]),
  official: new Set<Capability>(['submit_scores']),
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
};

export const ALL_CAPABILITY_KEYS: Capability[] = [
  'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
  'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
  'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
  'org_settings', 'billing',
  'module_tournaments', 'module_communications', 'module_members',
  'module_public_site', 'module_accounting', 'module_house_league', 'module_rep_teams',
];

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
