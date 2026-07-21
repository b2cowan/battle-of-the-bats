import type { ReactNode } from 'react';
import CoachJourneyChrome from '@/components/consumer/CoachJourneyChrome';

/**
 * The Premium Coaches Portal signup wears the consumer app's warm chrome (mobile bottom tab bar /
 * desktop warm top strip) instead of the marketing chrome — a coach signing up never loses the
 * back-to-app anchor (design_decisions S1-2). The marketing Navbar + Footer are suppressed here via
 * isWarmJourneyPath. This nests inside app/coaches/layout.tsx, whose CoachPortalShell passes
 * /coaches/start through untouched.
 */
export default function CoachesStartLayout({ children }: { children: ReactNode }) {
  return <CoachJourneyChrome>{children}</CoachJourneyChrome>;
}
