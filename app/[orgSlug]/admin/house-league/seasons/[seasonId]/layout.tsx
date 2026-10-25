import type { ReactNode } from 'react';
import SeasonPhoneFrame from '@/components/admin/kit/club/SeasonPhoneFrame';
import SeasonLockLine from '@/components/admin/kit/club/league/SeasonLockLine';

/**
 * Every page of one house-league season (Club Tier Stage 9a, 9a·3): on a phone, the season's header and its page strip sit
 * above the page; on the desk the rail's season block does that job. A finished season says so once, on every page (Q16).
 */
export default function SeasonLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeasonPhoneFrame />
      <SeasonLockLine />
      {children}
    </>
  );
}
