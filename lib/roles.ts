import type { OrgRole } from './types';

export type Capability =
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
  | 'billing';

export const ROLE_DEFAULTS: Record<OrgRole, Set<Capability>> = {
  owner: new Set<Capability>([
    'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
    'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
    'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
    'org_settings', 'billing',
  ]),
  admin: new Set<Capability>([
    'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
    'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
    'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
  ]),
  staff: new Set<Capability>([
    'update_schedule', 'submit_scores', 'post_announcements',
  ]),
  official: new Set<Capability>(['submit_scores']),
};

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
