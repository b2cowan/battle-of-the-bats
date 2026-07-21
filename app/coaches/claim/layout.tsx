import type { ReactNode } from 'react';
import CoachJourneyChrome from '@/components/consumer/CoachJourneyChrome';

/**
 * The tournament-team claim signup reuses the same warm TeamSignupClient, so it wears the same
 * consumer warm chrome as /coaches/start (design_decisions S1-2) rather than the marketing chrome —
 * warm content under a marketing navbar would seam. Marketing Navbar + Footer are suppressed here
 * via isWarmJourneyPath.
 */
export default function CoachesClaimLayout({ children }: { children: ReactNode }) {
  return <CoachJourneyChrome>{children}</CoachJourneyChrome>;
}
