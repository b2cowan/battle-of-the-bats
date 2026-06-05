import type { ReactNode } from 'react';
import CoachPortalShell from '@/components/coaches/CoachPortalShell';

/**
 * Wraps every /coaches route. The shell renders the portal chrome (rail + bottom
 * nav) only on the authenticated portal routes; the signup/marketing surfaces
 * (/coaches/join, /coaches/start, /coaches/claim, /coaches/checkout) pass through
 * untouched and keep the global marketing chrome.
 */
export default function CoachesPortalLayout({ children }: { children: ReactNode }) {
  return <CoachPortalShell>{children}</CoachPortalShell>;
}
