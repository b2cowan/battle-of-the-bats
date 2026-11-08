'use client';
/**
 * THE ACCOUNTING FRAME (⚖ Club Tier Stage 3a, Ask 2 option B — hub v22 specimen 5, ruled 2026-09-30).
 *
 * Accounting is one place titled with the program, as the coach's Money is: its name and the coach's own tab row
 * (`HubTabBar`, promoted for this — one component for both sides, never a copy), now in the admin's pinned bar (Admin
 * header bar Phase 2: `PlaceFrame`), then the tab's own content. No create sits in the bar: a create belongs to the tab's
 * own toolbar (the table standard §3.9). On a phone the row scrolls sideways, pinned (A5), opens scrolled to the lit tab,
 * and shows an arrow only on a side that hides one — all of it the component's. ⚖ A6: no fiscal year in the bar; the
 * Year pill in each tab's toolbar keeps it.
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
import { useClubPlaceAt } from '@/components/admin/AdminBarPlace';
import { repKit } from '../RepKit';
import PlaceFrame from '../PlaceFrame';

export default function AccountingFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  // Which tabs (the loop's only where the club runs rep teams; Payouts only where it has connected payouts, a server fact
  // the admin layout reads once) and which one is lit: the bar's own answer, so the two never disagree.
  const place = useClubPlaceAt();
  const accounting = place?.key === 'accounting' ? place : null;
  const lit = accounting?.tabs.find(t => t.id === accounting.activeId);
  // The browser tab names the lit tab on the tab's OWN address. ⚠ Not on a view under it (a team's account): the page
  // names itself ("11U AA · Teams · Accounting", its own `usePageTitle`), and a parent's effect runs AFTER its child's, so
  // a title set here would overwrite it.
  const title = lit && pathname === lit.href ? `${lit.id === 'overview' ? '' : `${lit.label} · `}Accounting` : null;
  useEffect(() => {
    if (title) document.title = currentOrg?.name ? `${title} | ${currentOrg.name}` : title;
  }, [title, currentOrg?.name]);

  // Every Accounting route sits in the money frame's width (the coach's money pages' 1200px).
  if (!accounting) return <div className={repKit.moneyFrame}>{children}</div>;
  return <PlaceFrame place={accounting}>{children}</PlaceFrame>;
}
