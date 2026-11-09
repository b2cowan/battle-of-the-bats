'use client';
/**
 * PERMITS IS A PLACE (⚖ Club Tier Stage 13c — Ask 1 A, C1 = A, owner 2026-11-08): the pinned bar names it "Permits" and,
 * a one-page place, draws no tab row (`HubTabBar`'s rule: a row of one tab is no row). The page drops its paper title
 * (`TabPageHeader`) and keeps its actions. Known from the address first (`useClubPlaceAt`), so the bar's first paint is
 * this frame's; someone the place is not for (`kitPermitsLink`'s gate) gets the page alone, under the club's name.
 */
import type { ReactNode } from 'react';
import { useClubPlaceAt } from '@/components/admin/AdminBarPlace';
import PlaceFrame from './PlaceFrame';

export default function PermitsFrame({ children }: { children: ReactNode }) {
  const place = useClubPlaceAt();
  if (place?.key !== 'permits') return <>{children}</>;
  return <PlaceFrame place={place}>{children}</PlaceFrame>;
}
