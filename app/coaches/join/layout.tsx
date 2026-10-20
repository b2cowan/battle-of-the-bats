import type { ReactNode } from 'react';
import CoachJourneyChrome from '@/components/consumer/CoachJourneyChrome';

/**
 * The coach join page (where an organizer's "your team is registered" email lands) wears the app's own frame — the
 * consumer top bar and phone tabs, as /coaches/start does — never the marketing bar and footer (The first look,
 * Ask 5a, 2026-10-19; plan rule 1). The marketing chrome is suppressed via isWarmJourneyPath. This nests inside
 * app/coaches/layout.tsx, whose CoachPortalShell passes /coaches/join through untouched.
 */
export default function CoachesJoinLayout({ children }: { children: ReactNode }) {
  return <CoachJourneyChrome>{children}</CoachJourneyChrome>;
}
