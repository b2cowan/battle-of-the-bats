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
 * A page ONE LEVEL DOWN (an allocation, a team's account, Payees, a budget line's allocation) is not a
 * tab: it renders alone, with its own back arrow and no tab row (`accountingTabFor` returns null).
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
  /** Allocations and Payment requests are the club ↔ team loop: only for a club that runs rep teams. */
  runsRepTeams: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const base = `/${orgSlug}/admin`;
  const tab = accountingTabFor(pathname, base, { runsRepTeams });
  const tabs = accountingTabs(base, { runsRepTeams });
  const lit = tabs.find(t => t.id === tab);
  // The browser tab names the lit tab; a page one level down names itself (its own `usePageTitle`),
  // so the frame says nothing there — a parent's effect runs after its child's and would overwrite it.
  const title = lit ? `${lit.id === 'overview' ? '' : `${lit.label} · `}Accounting` : null;
  useEffect(() => {
    if (title) document.title = currentOrg?.name ? `${title} | ${currentOrg.name}` : title;
  }, [title, currentOrg?.name]);

  if (!tab) return <>{children}</>;
  return (
    <div className={repKit.page}>
      {/* No eyebrow: the club's name is already in the bar above (owner, 2026-10-01). */}
      <AdminPageHeader title="Accounting" />
      <HubTabBar tabs={tabs} activeId={tab} ariaLabel="Accounting" />
      {children}
    </div>
  );
}
