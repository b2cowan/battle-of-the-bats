'use client';

import { createContext, useContext } from 'react';

/**
 * The club a page under `/{org}/` belongs to, for the one thing that cannot read it from params: the club's "not found"
 * (Club Tier Stage 4a). Next 16's `not-found.tsx` receives no props, so `app/[orgSlug]/layout.tsx` — which has the
 * club in hand anyway — hands the boundary its name and whether its public site is open. No identity: safe in
 * service-worker-cached anonymous HTML, like the rest of that layout.
 */
export interface PublicClub {
  slug: string;
  name: string;
  siteOpen: boolean;
}

const PublicClubContext = createContext<PublicClub | null>(null);

export function PublicClubProvider({ club, children }: { club: PublicClub; children: React.ReactNode }) {
  return <PublicClubContext.Provider value={club}>{children}</PublicClubContext.Provider>;
}

export function usePublicClub(): PublicClub | null {
  return useContext(PublicClubContext);
}
