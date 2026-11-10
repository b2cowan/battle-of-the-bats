import type { ReactNode } from 'react';
import { getAuthenticatedUser } from '@/lib/api-auth';
import TermsAcceptGate from '@/components/legal/TermsAcceptGate';

/**
 * The house-league coach's team page (Club Tier 9c) is a SIGNED-IN surface under none of the portal shells — family contacts,
 * the schedule, score entry — and the league-coach invitation lands people here. So it mounts the sign-in screen itself
 * (GST/HST Stage 6 step 6.3, Chunk B; the shell census in `tests/unit/legal-acceptance-doors.test.ts` names it). The page's
 * own read is request-cached, so this costs nothing more; a visitor is never asked (the page sends them to sign in).
 */
export default async function LeagueCoachTeamLayout({ children }: { children: ReactNode }) {
  const user = await getAuthenticatedUser();
  return <TermsAcceptGate user={user}>{children}</TermsAcceptGate>;
}
