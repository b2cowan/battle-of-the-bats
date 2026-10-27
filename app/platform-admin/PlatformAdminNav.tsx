'use client';
/**
 * The support console's menu — BY JOB (Support console Stage 2, owner rulings Q1 + A7 + A11, 2026-10-25; drawings
 * Ub7fXLh29SC34Zp4oqKUx1 "The menu by job"; `docs/agents/design/NAV_STANDARD.md`).
 *
 * The product's rail, worn by the console: the SAME skin as the club admin's (`AdminKitFrame.module.css` and the shared
 * sidebar-strip parts), so a fix to either lands in both. What is the console's own is the list:
 *   • Today alone at the top (a tray, not the house — the house is Home's in the icon dictionary);
 *   • five groups named for the work: Customers · Health · Growth · Product · Records; then System (dev only) and the
 *     owner's Private finance, last and unchanged;
 *   • nine entries renamed with their page titles (A7): Today, Clubs & portals, People, Errors, Leads, Campaigns,
 *     Pitch decks, Bulk changes, Staff. No page changed what it does by being renamed.
 * Behind the same rules as before, now read from the ONE rulebook (`lib/platform-areas.ts`):
 *   • a role sees only the pages it can open (`canViewPlatformArea`), and a group left empty is dropped;
 *   • the eye marks a page the role can open but holds none of the powers its controls use (`isPlatformAreaReadOnly`) —
 *     it now tells the truth: Growth and Read only see it on Clubs & portals and People;
 *   • the amber count sits beside the entry that clears it (Today's queues, `lib/platform-waiting.ts`), the eye then the
 *     count, in fixed places; a FOLDED group's heading carries one pill, the sum of its rows, and loses it when opened
 *     (A11);
 *   • Dev tools appears only where `NEXT_PUBLIC_ENABLE_DEV_TOOLS` is on; Bookkeeping follows `canBookkeep` (the owner's
 *     email allowlist), never a role.
 * Help and Collapse stay at the foot (N4). The same list draws the desktop rail and the narrow-width panel (`variant`).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Inbox, Building2, Users, Gift, ArchiveRestore, AlertTriangle, MessageSquare, Target, Send, Presentation, Tag, Activity, Mail,
  ClipboardCheck, Layers, FileText, Download, ShieldCheck, ScrollText, Terminal, HelpCircle, Wallet, Eye, ChevronRight, BarChart3, CreditCard,
} from 'lucide-react';
import { CollapseSidebarRow, SidebarStripTip } from '@/components/shared/SidebarStrip';
import strip from '@/components/shared/SidebarStrip.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import { isPlatformAreaReadOnly, type PlatformArea } from '@/lib/platform-areas';
import type { PlatformRole } from '@/lib/platform-auth';
import {
  TODAY_ITEM, BOOKKEEPING_ITEM, visibleMenuGroups, entryCount, foldedGroupCount, type MenuIcon, type MenuItem,
} from './console-menu';
import styles from './platform-admin.module.css';

const HELP_HREF = '/platform-admin/help';

/** The icon dictionary's glyph for each entry (NAV_STANDARD N5): the tray is Today's; the house stays Home's. */
const ICONS: Record<MenuIcon, typeof Inbox> = {
  today: Inbox, clubs: Building2, people: Users, free_time: Gift, retention: ArchiveRestore, status: Activity, errors: AlertTriangle, sent: Mail,
  feedback: MessageSquare, leads: Target, campaigns: Send, decks: Presentation, plans: Tag, approval: ClipboardCheck,
  bulk: Layers, templates: FileText, export: Download, staff: ShieldCheck, audit: ScrollText, terminal: Terminal, wallet: Wallet,
  numbers: BarChart3, payments: CreditCard,
};

const DEV_TOOLS_ON = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';

function isActive(pathname: string, href: string) {
  if (href === '/platform-admin') return pathname === '/platform-admin';
  // Match on a path boundary so a shorter route isn't also flagged active on a sibling
  // (e.g. `/platform-admin/email` must NOT light up on `/platform-admin/email-templates`).
  return pathname === href || pathname.startsWith(href + '/');
}

function pillText(count: number) {
  return count > 99 ? '99+' : String(count);
}

const COUNTS_FRESH_MS = 30_000;

/**
 * The waiting counts, read once by the frame (`PlatformShell`) and handed to the rail and the narrow-width panel, when the
 * console mounts and again on a move to another page (at most every 30 seconds).
 */
export function useWaitingCounts(): Partial<Record<PlatformArea, number>> {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Partial<Record<PlatformArea, number>>>({});
  const lastRead = useRef(0);
  useEffect(() => {
    if (Date.now() - lastRead.current < COUNTS_FRESH_MS) return;
    // The read time is kept only once an answer lands: an effect run twice (React's dev check) must not skip the read.
    let live = true;
    fetch('/api/platform-admin/waiting', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (!body?.counts) return;
        lastRead.current = Date.now();
        if (live) setCounts(body.counts);
      })
      .catch(() => { /* no counts beats a broken menu */ });
    return () => { live = false; };
  }, [pathname]);
  return counts;
}

/** The groups and the foot — what the rail and the narrow-width panel both draw. */
export function PlatformNavBody({ role, canBookkeep, counts, variant, onNavigate }: {
  role: PlatformRole;
  canBookkeep: boolean;
  counts: Partial<Record<PlatformArea, number>>;
  variant: 'rail' | 'drawer';
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = useMemo(() => visibleMenuGroups(role, canBookkeep, DEV_TOOLS_ON), [role, canBookkeep]);
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

  const row = (item: MenuItem) => {
    const { href, label, area } = item;
    const Icon = ICONS[item.icon];
    const active = isActive(pathname, href);
    // Bookkeeping has no role area, so it is never marked view-only and carries no count.
    const viewOnly = href !== BOOKKEEPING_ITEM.href && isPlatformAreaReadOnly(role, area);
    const count = entryCount(item, counts);
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
        {count > 0 && (
          <span className={`${frame.count} ${styles.navCount}`} aria-label={`${count} waiting`}>{pillText(count)}</span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Today sits alone at the top, under no heading. */}
      {row(TODAY_ITEM)}
      {groups.map(group => {
        const hasActive = group.items.some(item => isActive(pathname, item.href));
        const open = openGroups.has(group.label) || hasActive;
        const folded = open ? 0 : foldedGroupCount(group, counts);
        return (
          <div key={group.label}>
            <button
              type="button"
              className={`${frame.groupHeader}${hasActive ? ` ${frame.groupHeaderActive}` : ''}${rowCls}`}
              onClick={() => toggleGroup(group.label)}
              aria-expanded={open}
            >
              <span className={frame.groupHeaderText}>{group.label}</span>
              {folded > 0 && (
                <span className={`${frame.count} ${styles.navCount}`} aria-label={`${folded} waiting`}>{pillText(folded)}</span>
              )}
              <ChevronRight size={12} className={`${frame.chevron}${open ? ` ${frame.chevronOpen}` : ''}`} aria-hidden />
            </button>
            <div className={strip.stripRule} aria-hidden />
            {open ? group.items.map(row) : <div className={strip.foldedGroup}>{group.items.map(row)}</div>}
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
export default function PlatformAdminNav({ role, canBookkeep, counts }: {
  role: PlatformRole;
  canBookkeep: boolean;
  counts: Partial<Record<PlatformArea, number>>;
}) {
  const railRef = useRef<HTMLElement>(null);
  return (
    <aside className={`${frame.rail} ${strip.stripLayer}`} ref={railRef}>
      <nav className={frame.railScroll} aria-label="Support console navigation">
        <PlatformNavBody role={role} canBookkeep={canBookkeep} counts={counts} variant="rail" />
      </nav>
      <SidebarStripTip scopeRef={railRef} />
    </aside>
  );
}
