import type { ReactNode } from 'react';
import CoachPortalShell from '@/components/coaches/CoachPortalShell';
import HelpDrawerProvider from '@/components/help/HelpDrawerProvider';

/**
 * Wraps every /coaches route. The shell renders the portal chrome (rail + bottom
 * nav) only on the authenticated portal routes; the signup/marketing surfaces
 * (/coaches/join, /coaches/start, /coaches/claim, /coaches/checkout) pass through
 * untouched and keep the global marketing chrome.
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
