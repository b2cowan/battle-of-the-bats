'use client';
/**
 * SPONSORSHIPS IS A PLACE (Board Ready Stage 6, Part 1; ask 12): the pinned bar names it and draws its four tabs, Deals ·
 * Packages · Sponsors · Setup (`sponsorshipsTabs`), from the address first (`useClubPlaceAt`), so the bar's first paint is
 * this frame's. The sponsorship form is a page one level under Setup: Setup stays lit there. One deal is a RECORD page (A8):
 * the bar names it ("← Deals │ business", no tab row), so this frame draws nothing over it and the deal titles the tab.
 */
import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/usePageTitle';
import { useClubPlaceAt } from '@/components/admin/AdminBarPlace';
import { SPONSORSHIPS_SEGMENT, type SponsorshipsTabId } from '@/lib/admin-kit-nav';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import PlaceFrame from '../PlaceFrame';

export default function SponsorshipsFrame({ children }: { children: ReactNode }) {
  const place = useClubPlaceAt();
  const tab = place?.key === SPONSORSHIPS_SEGMENT ? (place.activeId as SponsorshipsTabId) : null;
  usePageTitle(!tab ? null : tab === 'deals' ? W.place : `${W.tabs[tab]} · ${W.place}`);
  if (!place || !tab) return <>{children}</>;
  return <PlaceFrame place={place}>{children}</PlaceFrame>;
}
