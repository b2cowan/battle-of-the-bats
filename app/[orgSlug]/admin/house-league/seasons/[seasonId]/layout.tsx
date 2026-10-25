import type { ReactNode } from 'react';
import SeasonPhoneFrame from '@/components/admin/kit/club/SeasonPhoneFrame';

/**
 * Every page of one house-league season (Club Tier Stage 9a, 9a·3): on a phone, the season's header and its page strip sit
 * above the page; on the desk the rail's season block does that job and this adds nothing.
 */
export default function SeasonLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeasonPhoneFrame />
      {children}
    </>
  );
}
