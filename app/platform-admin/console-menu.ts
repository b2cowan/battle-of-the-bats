/**
 * The support console's menu — BY JOB, as data (Support console Stage 2, owner rulings Q1 + A7 + A11, 2026-10-25; drawings
 * Ub7fXLh29SC34Zp4oqKUx1, "The menu by job"). Pure, no JSX and no stylesheet, so the rail (`PlatformAdminNav.tsx`) draws
 * it and `tests/unit/support-console-stage2-guard.test.ts` reads the same list.
 *
 *   • Today alone at the top (a tray, not the house — the house is Home's in the icon dictionary);
 *   • five groups named for the work: Customers · Health · Growth · Product · Records; then System (dev only) and the
 *     owner's Private finance, last and unchanged;
 *   • nine entries renamed with their page titles (A7): Today, Clubs & portals, People, Errors, Leads, Campaigns,
 *     Pitch decks, Bulk changes, Staff. No page changed what it does by being renamed.
 * Who sees an entry, and the eye, come from the one rulebook (`lib/platform-areas.ts`).
 */
import { canViewPlatformArea, type PlatformArea } from '../../lib/platform-areas';
import type { PlatformRole } from '../../lib/platform-auth';

/** A lucide icon, by name — the rail maps each to its component. */
export type MenuIcon =
  | 'today' | 'clubs' | 'people' | 'founding' | 'retention' | 'errors' | 'feedback' | 'leads' | 'campaigns' | 'decks'
  | 'plans' | 'approval' | 'bulk' | 'templates' | 'export' | 'staff' | 'audit' | 'terminal' | 'wallet';

export type MenuItem = { href: string; label: string; icon: MenuIcon; area: PlatformArea };
export type MenuGroup = { label: string; items: MenuItem[] };

export const TODAY_ITEM: MenuItem = { href: '/platform-admin', label: 'Today', icon: 'today', area: 'overview' };
const DEV_TOOLS_ITEM: MenuItem = { href: '/platform-admin/dev-tools', label: 'Dev tools', icon: 'terminal', area: 'dev_tools' };
// Bookkeeping is the owner's, by email allowlist (`canAccessBookkeeping`), never a role: its area is a placeholder.
export const BOOKKEEPING_ITEM: MenuItem = { href: '/platform-admin/bookkeeping', label: 'Bookkeeping', icon: 'wallet', area: 'overview' };

export function baseMenuGroups(devTools: boolean): MenuGroup[] {
  return [
    {
      label: 'Customers',
      items: [
        { href: '/platform-admin/orgs', label: 'Clubs & portals', icon: 'clubs', area: 'organizations' },
        { href: '/platform-admin/customer-users', label: 'People', icon: 'people', area: 'customer_users' },
        // A list of customers on a free season, so it sits with Customers; Stage 4 turns it into Free time.
        { href: '/platform-admin/founding-season', label: 'Founding season', icon: 'founding', area: 'founding_season' },
        { href: '/platform-admin/retention', label: 'Retention', icon: 'retention', area: 'retention' },
      ],
    },
    {
      label: 'Health',
      items: [
        { href: '/platform-admin/observability', label: 'Errors', icon: 'errors', area: 'observability' },
        { href: '/platform-admin/feedback', label: 'Feedback', icon: 'feedback', area: 'feedback' },
      ],
    },
    {
      label: 'Growth',
      items: [
        { href: '/platform-admin/early-access', label: 'Leads', icon: 'leads', area: 'early_access' },
        { href: '/platform-admin/email', label: 'Campaigns', icon: 'campaigns', area: 'email' },
        // Company-owned pitch material aimed at people who are not customers yet.
        { href: '/platform-admin/pitch-deck-studio', label: 'Pitch decks', icon: 'decks', area: 'pitch_deck_studio' },
      ],
    },
    {
      label: 'Product',
      items: [
        { href: '/platform-admin/plans-pricing', label: 'Plans & pricing', icon: 'plans', area: 'plans_pricing' },
        { href: '/platform-admin/change-requests', label: 'Approval queue', icon: 'approval', area: 'change_requests' },
        // A billing and product tool; both roles keep it.
        { href: '/platform-admin/bulk-operations', label: 'Bulk changes', icon: 'bulk', area: 'bulk_operations' },
        { href: '/platform-admin/email-templates', label: 'Email templates', icon: 'templates', area: 'email_templates' },
        { href: '/platform-admin/exports', label: 'Export registry', icon: 'export', area: 'export_registry' },
      ],
    },
    {
      label: 'Records',
      items: [
        { href: '/platform-admin/users', label: 'Staff', icon: 'staff', area: 'platform_users' },
        { href: '/platform-admin/audit', label: 'Audit log', icon: 'audit', area: 'audit' },
      ],
    },
    // The seed console, which exists only where the dev-tools flag is on.
    { label: 'System', items: devTools ? [DEV_TOOLS_ITEM] : [] },
  ];
}

/** The groups a person sees: the role's pages only, a group left empty dropped, Bookkeeping last. */
export function visibleMenuGroups(role: PlatformRole, canBookkeep: boolean, devTools: boolean): MenuGroup[] {
  const groups = baseMenuGroups(devTools)
    .map(group => ({ ...group, items: group.items.filter(item => canViewPlatformArea(role, item.area)) }))
    .filter(group => group.items.length > 0);
  return canBookkeep ? [...groups, { label: 'Private finance', items: [BOOKKEEPING_ITEM] }] : groups;
}

/** An entry's waiting count (Bookkeeping never carries one). */
export function entryCount(item: MenuItem, counts: Partial<Record<PlatformArea, number>>): number {
  return item.href === BOOKKEEPING_ITEM.href ? 0 : counts[item.area] ?? 0;
}

/** A folded group's one pill: the sum of its rows' counts (A11). */
export function foldedGroupCount(group: MenuGroup, counts: Partial<Record<PlatformArea, number>>): number {
  return group.items.reduce((sum, item) => sum + entryCount(item, counts), 0);
}
