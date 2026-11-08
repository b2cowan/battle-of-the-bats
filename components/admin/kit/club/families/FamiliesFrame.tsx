'use client';
/**
 * THE FAMILIES FRAME (⚖ Club Tier Stage 5b, Ask 14 — hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P1; the 2026-09-30 rule
 * that made Accounting one page: "a program whose pages are views of one body of records is one page with tabs").
 *
 * Families is one place: its name and the shared tab row (`HubTabBar`, Accounting's and the coach's Money's) — Families ·
 * Duplicates · Emails — in the admin's pinned bar (Admin header bar Phase 2: `PlaceFrame`), then the tab's own content.
 * Duplicates wears its waiting count as the rail's amber pill, the same number the rail's Families row carries (the club
 * brief's one count). A family opens as a record OVER the Families tab, so the Families tab stays lit on a family's address.
 * A child's page is no place (its own header and title, no tab row over it).
 */
import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/usePageTitle';
import { markTabs, useClubPlaceAt } from '@/components/admin/AdminBarPlace';
import { FAMILY_EMAILS_TAB_WORDS as EW, FAMILY_LIST_WORDS as W } from '@/lib/families-words';
import { familyDuplicatesTotal, useClubBrief } from '../ClubBriefProvider';
import { WaitingCount } from '../money/MoneyKit';
import PlaceFrame from '../PlaceFrame';

export default function FamiliesFrame({ children }: { children: ReactNode }) {
  const { brief } = useClubBrief();
  const waiting = familyDuplicatesTotal(brief);
  // Which tab is lit, or no place at all (a child's page): the bar's own answer, from the address alone.
  const place = useClubPlaceAt();
  const tab = place?.key === 'families' ? place.activeId : null;

  // The browser tab names the tab on its own address (a child's page names the child itself).
  usePageTitle(!tab ? null : tab === 'duplicates' ? `${W.tabDuplicates} · ${W.title}` : tab === 'emails' ? `${EW.tab} · ${W.title}` : W.title);

  if (!place || !tab) return <>{children}</>;
  const tabs = markTabs(place.tabs, id => (id === 'duplicates' && waiting > 0 ? <WaitingCount n={waiting} /> : null));
  return <PlaceFrame place={{ ...place, tabs }}>{children}</PlaceFrame>;
}
