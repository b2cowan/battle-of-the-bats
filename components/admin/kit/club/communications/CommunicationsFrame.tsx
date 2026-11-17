'use client';
/**
 * COMMUNICATIONS IS A PLACE (Club Communications Stage 1): the pinned bar names it and, a one-page place, draws no tab row
 * (N11), as Permits. Known from the address first (`useClubPlaceAt`), so the bar's first paint is this frame's.
 */
import type { ReactNode } from 'react';
import { useClubPlaceAt } from '@/components/admin/AdminBarPlace';
import { COMMUNICATIONS_SEGMENT } from '@/lib/admin-kit-nav';
import PlaceFrame from '../PlaceFrame';

export default function CommunicationsFrame({ children }: { children: ReactNode }) {
  const place = useClubPlaceAt();
  if (place?.key !== COMMUNICATIONS_SEGMENT) return <>{children}</>;
  return <PlaceFrame place={place}>{children}</PlaceFrame>;
}
