'use client';
/**
 * The support console's menu (Support console Stage 1, owner 2026-10-24; `docs/agents/design/NAV_STANDARD.md`).
 *
 * The product's rail, worn by the console: the SAME skin as the club admin's (`AdminKitFrame.module.css` and the shared
 * sidebar-strip parts), so a fix to either lands in both. What is the console's own is the list. ⚠ **No screen moved:**
 * every entry keeps its place under today's group names (sentence case here, capitals by the kit's heading rule), in
 * today's order, behind today's rules —
 *   • a role sees only the areas it can view (`canViewPlatformArea`), and a group left empty is dropped;
 *   • an entry a role can read but not edit carries the small eye (`isPlatformAreaReadOnly`);
 *   • Dev tools appears only where `NEXT_PUBLIC_ENABLE_DEV_TOOLS` is on (and the role can view it);
 *   • Bookkeeping is its own last group behind `canBookkeep` (the owner's email allowlist), never a role.
 * What moved by ruling: Help left the System group for the foot (N4) and opens in place; Sign out left for the account
 * menu (N4); the "PLATFORM ADMIN" badge and the "ACTIVE SESSION" block are gone (the strip carries the name and the person).
 *
 * The same list draws the desktop rail and the narrow-width panel (`variant`): a panel has no Collapse row.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import {
  LayoutGrid, Building2, Search, ArchiveRestore, Mail, Send, Presentation, Sparkles, ClipboardCheck, SlidersHorizontal,
  ListChecks, FileText, Table2, AlertTriangle, MessageSquare, Users, ScrollText, Terminal, HelpCircle, Wallet, Eye,
  ChevronRight,
} from 'lucide-react';
import { CollapseSidebarRow, SidebarStripTip } from '@/components/shared/SidebarStrip';
import strip from '@/components/shared/SidebarStrip.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import { canViewPlatformArea, isPlatformAreaReadOnly, type PlatformArea } from '@/lib/platform-areas';
import type { PlatformRole } from '@/lib/platform-auth';
import styles from './platform-admin.module.css';

type NavItem = { href: string; label: string; Icon: typeof LayoutGrid; area: PlatformArea };
type NavGroup = { label: string; items: NavItem[] };

const HELP_HREF = '/platform-admin/help';

const DEV_TOOLS_ITEM: NavItem = { href: '/platform-admin/dev-tools', label: 'Dev tools', Icon: Terminal, area: 'dev_tools' };
const BOOKKEEPING_ITEM: NavItem = { href: '/platform-admin/bookkeeping', label: 'Bookkeeping', Icon: Wallet, area: 'overview' };

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Command center',
    items: [
      // The product's one Overview icon (nav standard N5, dictionary #1).
      { href: '/platform-admin', label: 'Overview', Icon: LayoutGrid, area: 'overview' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/platform-admin/orgs', label: 'Organizations', Icon: Building2, area: 'organizations' },
      { href: '/platform-admin/customer-users', label: 'Customer users', Icon: Search, area: 'customer_users' },
      { href: '/platform-admin/retention', label: 'Retention', Icon: ArchiveRestore, area: 'retention' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { href: '/platform-admin/early-access', label: 'Early access', Icon: Mail, area: 'early_access' },
      { href: '/platform-admin/email', label: 'Email campaigns', Icon: Send, area: 'email' },
      // Company-owned pitch material aimed at people who are not customers yet — the same
      // reasoning that puts Early access and Email campaigns in this group.
      { href: '/platform-admin/pitch-deck-studio', label: 'Pitch deck studio', Icon: Presentation, area: 'pitch_deck_studio' },
    ],
  },
  {
    label: 'Billing & product',
    items: [
      // The free cohort and what it has done about the season ending. Sits with Billing rather
      // than Growth: it is read on the day money is decided, not on the day someone is sold to.
      { href: '/platform-admin/founding-season', label: 'Founding season', Icon: Sparkles, area: 'founding_season' },
      { href: '/platform-admin/change-requests', label: 'Approval queue', Icon: ClipboardCheck, area: 'change_requests' },
      { href: '/platform-admin/plans-pricing', label: 'Plans & pricing', Icon: SlidersHorizontal, area: 'plans_pricing' },
      { href: '/platform-admin/bulk-operations', label: 'Bulk operations', Icon: ListChecks, area: 'bulk_operations' },
      { href: '/platform-admin/email-templates', label: 'Email templates', Icon: FileText, area: 'email_templates' },
      { href: '/platform-admin/exports', label: 'Export registry', Icon: Table2, area: 'export_registry' },
    ],
  },
  {
    label: 'Support & diagnostics',
    items: [
      { href: '/platform-admin/observability', label: 'Observability', Icon: AlertTriangle, area: 'observability' },
      { href: '/platform-admin/feedback', label: 'Feedback', Icon: MessageSquare, area: 'feedback' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { href: '/platform-admin/users', label: 'Platform users', Icon: Users, area: 'platform_users' },
      { href: '/platform-admin/audit', label: 'Audit log', Icon: ScrollText, area: 'audit' },
    ],
  },
  // Help left this group for the foot (N4); what remains is the seed console, which exists only where the flag is on.
  {
    label: 'System',
    items: process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true' ? [DEV_TOOLS_ITEM] : [],
  },
];

/** The groups a person sees: today's seven, the role's areas only, a group left empty dropped, Bookkeeping last. */
function visibleGroups(role: PlatformRole, canBookkeep: boolean): NavGroup[] {
  const groups = BASE_NAV_GROUPS
    // Drop areas this role cannot view, then drop any group left empty.
    .map(group => ({ ...group, items: group.items.filter(item => canViewPlatformArea(role, item.area)) }))
    .filter(group => group.items.length > 0);
  // Bookkeeping is the owner's, by email allowlist (`canAccessBookkeeping`), never by role: no area filter applies.
  return canBookkeep ? [...groups, { label: 'Private finance', items: [BOOKKEEPING_ITEM] }] : groups;
}

function isActive(pathname: string, href: string) {
  if (href === '/platform-admin') return pathname === '/platform-admin';
  // Match on a path boundary so a shorter route isn't also flagged active on a sibling
  // (e.g. `/platform-admin/email` must NOT light up on `/platform-admin/email-templates`).
  return pathname === href || pathname.startsWith(href + '/');
}

/** The groups and the foot — what the rail and the narrow-width panel both draw. */
export function PlatformNavBody({ role, canBookkeep, variant, onNavigate }: {
  role: PlatformRole;
  canBookkeep: boolean;
  variant: 'rail' | 'drawer';
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = useMemo(() => visibleGroups(role, canBookkeep), [role, canBookkeep]);
  // A phone's rows are for thumbs (nav standard N1): 44px tall, 16px type, 17px icons.
  const drawer = variant === 'drawer';
  const rowCls = drawer ? ` ${styles.drawerRow}` : '';
  const iconSize = drawer ? 17 : 14;
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const toggleGroup = (label: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
  const helpActive = isActive(pathname, HELP_HREF);

  const rows = (items: NavItem[]) => items.map(({ href, label, Icon, area }) => {
    const active = isActive(pathname, href);
    // Bookkeeping has no role area, so it is never marked view-only.
    const viewOnly = href !== BOOKKEEPING_ITEM.href && isPlatformAreaReadOnly(role, area);
    return (
      <Link
        key={href}
        href={href}
        className={`${frame.item}${active ? ` ${frame.itemActive}` : ''}${rowCls}`}
        aria-current={active ? 'page' : undefined}
        title={viewOnly ? 'View-only for your role' : undefined}
        onClick={onNavigate}
      >
        <Icon size={iconSize} aria-hidden />
        <span className={strip.rowLabel}>{label}</span>
        {viewOnly && (
          <span className={styles.navViewOnly} aria-label="View-only for your role">
            <Eye size={11} aria-hidden />
          </span>
        )}
      </Link>
    );
  });

  return (
    <>
      {groups.map(group => {
        const hasActive = group.items.some(item => isActive(pathname, item.href));
        const open = openGroups.has(group.label) || hasActive;
        return (
          <div key={group.label}>
            <button
              type="button"
              className={`${frame.groupHeader}${hasActive ? ` ${frame.groupHeaderActive}` : ''}${rowCls}`}
              onClick={() => toggleGroup(group.label)}
              aria-expanded={open}
            >
              <span className={frame.groupHeaderText}>{group.label}</span>
              <ChevronRight size={12} className={`${frame.chevron}${open ? ` ${frame.chevronOpen}` : ''}`} aria-hidden />
            </button>
            <div className={strip.stripRule} aria-hidden />
            {open ? rows(group.items) : <div className={strip.foldedGroup}>{rows(group.items)}</div>}
          </div>
        );
      })}
      <div className={frame.spacer} />
      {/* ⚖ ONE SIDEBAR FOOT (N4): Help, then Collapse sidebar last. Sign out lives in the account menu only. */}
      <div className={frame.foot}>
        <Link
          href={HELP_HREF}
          className={`${frame.item} ${frame.footItem}${helpActive ? ` ${frame.itemActive}` : ''}${rowCls}`}
          aria-current={helpActive ? 'page' : undefined}
          onClick={onNavigate}
        >
          <HelpCircle size={iconSize} aria-hidden /> <span className={strip.rowLabel}>Help</span>
        </Link>
      </div>
      {/* A panel closes instead of collapsing, so only the rail carries the last row. */}
      {variant === 'rail' && <CollapseSidebarRow className={`${frame.item} ${frame.footItem}`} />}
    </>
  );
}

/** The desktop rail: the product's own, 240 wide or the strip's 64. Hidden below 900 (the panel takes over). */
export default function PlatformAdminNav({ role, canBookkeep }: { role: PlatformRole; canBookkeep: boolean }) {
  const railRef = useRef<HTMLElement>(null);
  return (
    <aside className={`${frame.rail} ${strip.stripLayer}`} ref={railRef}>
      <nav className={frame.railScroll} aria-label="Support console navigation">
        <PlatformNavBody role={role} canBookkeep={canBookkeep} variant="rail" />
      </nav>
      <SidebarStripTip scopeRef={railRef} />
    </aside>
  );
}
