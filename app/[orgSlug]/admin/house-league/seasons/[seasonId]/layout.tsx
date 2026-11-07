import type { ReactNode } from 'react';
import SeasonFrame from '@/components/admin/kit/club/SeasonFrame';
import SeasonLockLine from '@/components/admin/kit/club/league/SeasonLockLine';

/**
 * Every page of one house-league season. ⚖ A season is a place (Club Tier Stage 13i, A4): its one header and its tab row,
 * on a desk and a phone alike, sit above the page (`SeasonFrame`). A finished season says so once, on every page (Q16).
 */
export default function SeasonLayout({ children }: { children: ReactNode }) {
  return (
    <SeasonFrame>
      <SeasonLockLine />
      {children}
    </SeasonFrame>
  );
}
