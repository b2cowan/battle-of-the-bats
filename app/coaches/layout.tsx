import type { ReactNode } from 'react';
import CoachPortalShell from '@/components/coaches/CoachPortalShell';
import HelpDrawerProvider from '@/components/help/HelpDrawerProvider';

/**
 * Wraps every /coaches route. The shell renders the portal chrome (rail + bottom
 * nav) only on the authenticated portal routes. /coaches/join + /coaches/checkout
 * pass through and keep the marketing chrome; the warm sign-up journey
 * (/coaches/start, /coaches/claim, /coaches/welcome) also passes through here but
 * wears the consumer WARM chrome via its own nested layout (CoachJourneyChrome),
 * with the marketing Navbar/Footer suppressed via isWarmJourneyPath (design_decisions S1-2).
 *
 * HelpDrawerProvider hosts the in-context "?" slide-over for the team work pages
 * (its drawer + guide content load lazily, only on first click — no bundle cost here).
 */
export default function CoachesPortalLayout({ children }: { children: ReactNode }) {
  return (
    <HelpDrawerProvider>
      <CoachPortalShell>{children}</CoachPortalShell>
    </HelpDrawerProvider>
  );
}
