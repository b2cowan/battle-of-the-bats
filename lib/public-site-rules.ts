/**
 * lib/public-site-rules.ts — WHO MAY OPEN AND WRITE THE PUBLIC-SITE EDITOR, as pure predicates (Public site builder,
 * ruled 2026-10-21; Option A). No request, no session: the routes (lib/public-site-access.ts) and the editor's preview PAGE
 * both read them, and the page must not import the file that resolves auth (the billing rail throws there for a cancelled
 * club — tests/unit/org-billing-access-guard.test.ts).
 */
import { hasCapability } from './roles';
import { hasModuleEntitlement } from './module-entitlements';
import { CLUB_LOOK_ROLES } from './public-site-builder';
import type { Organization, OrgRole } from './types';

/** The editor's door: the public-site capability on a plan that carries the module. */
export const mayOpenSiteEditor = (ctx: { role: OrgRole; capabilities: Record<string, boolean> | null; org: Organization }) =>
  hasCapability(ctx.role, ctx.capabilities, 'module_public_site') && hasModuleEntitlement(ctx.org, 'module_public_site');

/** Who may WRITE what the editor holds: the owner or an admin (Option A, 2026-10-21). */
export const mayWriteSite = (role: string) => CLUB_LOOK_ROLES.includes(role);
