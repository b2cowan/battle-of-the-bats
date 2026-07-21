import type { ReactNode } from 'react';
import CoachJourneyChrome from '@/components/consumer/CoachJourneyChrome';

/**
 * Post-provision success screen — the last warm step of the sign-up journey before the handoff into
 * the operating portal (design_decisions S1-2). Wears the same consumer warm chrome as the rest of
 * the journey; the marketing Navbar + Footer are suppressed here via isWarmJourneyPath.
 */
export default function CoachesWelcomeLayout({ children }: { children: ReactNode }) {
  return <CoachJourneyChrome>{children}</CoachJourneyChrome>;
}
