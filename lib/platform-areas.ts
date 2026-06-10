// Platform-admin area access model.
//
// PURE + client-safe: this module has no server-only runtime imports (the only
// import is a type, which is erased at build), so both the server pages/guards
// and the client navigation can share one source of truth.
//
// Three access levels per role:
//   - hidden : role is not in `viewRoles` -> nav item omitted AND page redirects
//   - read   : role is in `viewRoles` but not `writeRoles` -> can view, controls locked
//   - write  : role is in `writeRoles` -> full access (action enforcement still
//              happens at the API routes via requirePlatformPermission)
//
// super_admin always has full access to every area.
//
// Matrix adopted 2026-06-04 — see docs/projects/active/PLATFORM_ADMIN_UX_EVAL.md (H4).

import type { PlatformRole } from './platform-auth';

export type PlatformArea =
  | 'overview'
  | 'organizations'
  | 'customer_users'
  | 'retention'
  | 'early_access'
  | 'email'
  | 'change_requests'
  | 'plans_pricing'
  | 'bulk_operations'
  | 'platform_users'
  | 'audit'
  | 'observability'
  | 'email_templates'
  | 'help'
  | 'dev_tools';

type AreaAccess = { viewRoles: PlatformRole[]; writeRoles: PlatformRole[] };

const ALL_ROLES: PlatformRole[] = ['super_admin', 'billing', 'support', 'product', 'growth', 'read_only'];

export const PLATFORM_AREAS: Record<PlatformArea, AreaAccess> = {
  // General / customer surfaces — visible to everyone (writes are scoped elsewhere)
  overview:        { viewRoles: ALL_ROLES, writeRoles: [] },
  organizations:   { viewRoles: ALL_ROLES, writeRoles: [] },
  audit:           { viewRoles: ALL_ROLES, writeRoles: [] },
  help:            { viewRoles: ALL_ROLES, writeRoles: [] },
  customer_users:  { viewRoles: ALL_ROLES, writeRoles: ['super_admin', 'support', 'billing'] },

  // Billing domain
  retention:       { viewRoles: ['super_admin', 'billing', 'support'], writeRoles: ['super_admin', 'billing'] },
  bulk_operations: { viewRoles: ['super_admin', 'billing', 'product'], writeRoles: ['super_admin', 'billing', 'product'] },

  // Product domain
  plans_pricing:   { viewRoles: ['super_admin', 'product', 'billing'], writeRoles: ['super_admin', 'product'] },
  change_requests: { viewRoles: ['super_admin', 'product', 'billing'], writeRoles: ['super_admin', 'product'] },
  email_templates: { viewRoles: ['super_admin', 'product'], writeRoles: ['super_admin', 'product'] },

  // Growth domain
  early_access:    { viewRoles: ['super_admin', 'product', 'growth'], writeRoles: ['super_admin', 'product', 'growth'] },
  email:           { viewRoles: ['super_admin', 'product', 'growth'], writeRoles: ['super_admin', 'product', 'growth'] },

  // System
  platform_users:  { viewRoles: ['super_admin'], writeRoles: ['super_admin'] },
  observability:   { viewRoles: ['super_admin', 'product', 'support'], writeRoles: ['super_admin', 'product'] },
  dev_tools:       { viewRoles: ['super_admin'], writeRoles: ['super_admin'] },
};

export function canViewPlatformArea(role: PlatformRole, area: PlatformArea): boolean {
  if (role === 'super_admin') return true;
  return PLATFORM_AREAS[area].viewRoles.includes(role);
}

export function canWritePlatformArea(role: PlatformRole, area: PlatformArea): boolean {
  if (role === 'super_admin') return true;
  return PLATFORM_AREAS[area].writeRoles.includes(role);
}

/** True when the role can view the area but cannot act in it (and the area has any write capability). */
export function isPlatformAreaReadOnly(role: PlatformRole, area: PlatformArea): boolean {
  return (
    canViewPlatformArea(role, area) &&
    !canWritePlatformArea(role, area) &&
    PLATFORM_AREAS[area].writeRoles.length > 0
  );
}
