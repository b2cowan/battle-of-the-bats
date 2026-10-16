'use client';
/**
 * THE ACCOUNTING FRAME (⚖ Club Tier Stage 3a, Ask 2 option B — hub v22 specimen 5, ruled 2026-09-30).
 *
 * Accounting is one page titled with the program, as the coach's Money is: the title, then the coach's
 * own tab row (`HubTabBar`, promoted for this — one component for both sides, never a copy), then the
 * tab's own content. No create sits in this header: a create belongs to the tab's own toolbar (the
 * table standard §3.9). The tab row is sentence weight, the lit tab olive with its underline, one
 * hairline under the row, never sticky; on a phone it scrolls, opens scrolled to the lit tab, and shows
 * an arrow only on a side that hides one — all of it the component's, none of it restated here.
 *
 * ⚖ A TEAM'S ACCOUNT IS A VIEW OF THE TEAMS TAB (Club Accounting · Teams, Ask 2, owner 2026-10-16), as a book is a
 * view of the Ledger: the tab row stays with Teams lit, and its Team pill moves between teams. It was the last "page
 * one level down" in Accounting (Stage 3d turned the allocation and Payees into windows), so that rule retired here.
 * An address that is no tab at all — a club with no rep teams reaching a team's old address (its read refuses it), or
 * an address with no page — still renders alone in the money frame's width, with no tab row lit to lie about it.
 */
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { accountingTabFor, accountingTabs } from '@/lib/admin-kit-nav';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HubTabBar from '@/components/shared/HubTabBar';
import { repKit } from '../RepKit';

export default function AccountingFrame({ orgSlug, runsRepTeams, children }: {
  orgSlug: string;
  /** Teams, Allocations and Payment requests are the club ↔ team loop: only for a club that runs rep teams. */
  runsRepTeams: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const base = `/${orgSlug}/admin`;
  const tab = accountingTabFor(pathname, base, { runsRepTeams });
  const tabs = accountingTabs(base, { runsRepTeams });
  const lit = tabs.find(t => t.id === tab);
  // The browser tab names the lit tab on the tab's OWN address. ⚠ Not on a view under it (a team's account): the page
  // names itself ("11U AA · Teams · Accounting", its own `usePageTitle`), and a parent's effect runs AFTER its child's, so
  // a title set here would overwrite it.
  const title = lit && pathname === lit.href ? `${lit.id === 'overview' ? '' : `${lit.label} · `}Accounting` : null;
  useEffect(() => {
    if (title) document.title = currentOrg?.name ? `${title} | ${currentOrg.name}` : title;
  }, [title, currentOrg?.name]);

  // Every Accounting route sits in the money frame's width (the coach's money pages' 1200px).
  if (!tab) return <div className={repKit.moneyFrame}>{children}</div>;
  return (
    <div className={`${repKit.page} ${repKit.moneyFrame}`}>
      {/* No eyebrow: the club's name is already in the bar above (owner, 2026-10-01). */}
      <AdminPageHeader title="Accounting" />
      <HubTabBar tabs={tabs} activeId={tab} ariaLabel="Accounting" />
      {children}
    </div>
  );
}
