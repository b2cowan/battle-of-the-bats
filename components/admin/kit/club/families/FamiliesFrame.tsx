'use client';
/**
 * THE FAMILIES FRAME (⚖ Club Tier Stage 5b, Ask 14 — hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P1; the 2026-09-30 rule
 * that made Accounting one page: "a program whose pages are views of one body of records is one page with tabs").
 *
 * Families is one page: the title, then the shared tab row (`HubTabBar`, Accounting's and the coach's Money's) —
 * Families · Duplicates · Emails — then the tab's own content. Duplicates wears its waiting count as the rail's amber pill, the
 * same number the rail's Families row carries (the club brief's one count). A family opens as a record OVER the Families
 * tab, so the Families tab stays lit on a family's address.
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePageTitle } from '@/lib/usePageTitle';
import { familiesTabFor, familiesTabs } from '@/lib/admin-kit-nav';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HubTabBar from '@/components/shared/HubTabBar';
import { FAMILY_EMAILS_TAB_WORDS as EW, FAMILY_LIST_WORDS as W } from '@/lib/families-words';
import { repKit } from '../RepKit';
import { useClubBrief } from '../ClubBriefProvider';
import { WaitingCount } from '../money/MoneyKit';

export default function FamiliesFrame({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const pathname = usePathname();
  const { brief } = useClubBrief();
  const base = `/${orgSlug}/admin`;
  const tab = familiesTabFor(pathname, base) ?? 'families';
  const waiting = brief?.counts.familyDuplicates ?? 0;
  const tabs = familiesTabs(base).map(t => (t.id === 'duplicates' && waiting > 0 ? { ...t, mark: <WaitingCount n={waiting} /> } : t));

  // The browser tab names the tab on its own address.
  usePageTitle(tab === 'duplicates' ? `${W.tabDuplicates} · ${W.title}` : tab === 'emails' ? `${EW.tab} · ${W.title}` : W.title);

  return (
    <div className={`${repKit.page} ${repKit.moneyFrame}`}>
      {/* No eyebrow: the club's name is already in the bar above (owner, 2026-10-01). */}
      <AdminPageHeader title={W.title} />
      <HubTabBar tabs={tabs} activeId={tab} ariaLabel={W.title} />
      {children}
    </div>
  );
}
