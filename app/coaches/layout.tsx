import type { ReactNode } from 'react';
import CoachPortalShell from '@/components/coaches/CoachPortalShell';
import HelpDrawerProvider from '@/components/help/HelpDrawerProvider';
import { CoachesOverlayProvider } from '@/lib/coaches-overlay';
import { getAuthUserCached } from '@/lib/supabase-server';
import { getUserAccessContextsCached, hasCoachAccess, getPrimaryOrgDestination, workspaceDoorsFromContexts, type WorkspaceDoor } from '@/lib/user-contexts';
import { getStartMenuConfig } from '@/lib/start-menu';

/**
 * Wraps every /coaches route. The shell renders the portal chrome (A2 consumer chrome:
 * global consumer nav + team/event header + section tabs/rail) only on the authenticated
 * portal routes. The warm journey (/coaches/start, /coaches/claim, /coaches/welcome, /coaches/join since The first look
 * 2026-10-19, and /coaches/checkout since 2026-10-20)
 * also passes through here but wears the consumer WARM chrome via its own nested layout
 * (CoachJourneyChrome), with the marketing Navbar/Footer suppressed via isWarmJourneyPath.
 *
 * signedIn/isCoach are SSR'd here for the global ConsumerNav's labels (the desktop
 * utility cluster + badge fetch gating) — same resolution the (consumer) layout uses,
 * shared via the per-request cache. They label chrome only, never gate content.
 *
 * HelpDrawerProvider hosts the in-context "?" slide-over for the team work pages
 * (its drawer + guide content load lazily, only on first click — no bundle cost here).
 *
 * CoachesOverlayProvider is the paid portal's overlay safety net (Free coach header parity, phone, owner
 * B2 2026-10-15): a FORM-layer surface — a window you type into — counts itself open, and the phone's team
 * bar then leaves the thumb's, the keyboard's and the screen reader's reach (and the page behind stops
 * scrolling), exactly as in the paid portal (the 2026-09-23 drawer-layers ruling). A MENU never counts.
 */
export default async function CoachesPortalLayout({ children }: { children: ReactNode }) {
  // One auth round trip per request, shared with the journey chrome nested below (checkout complete re-renders on every poll).
  const user = await getAuthUserCached();

  // Persona-menu gating (WI-2) — started before the contexts lookup so both resolve
  // concurrently; this layout is already dynamic (auth above).
  const startMenuPromise = getStartMenuConfig().catch(() => undefined);
  let isCoach = false;
  let adminHref: string | null = null;
  let workspaces: WorkspaceDoor[] = [];
  if (user?.email) {
    const contexts = await getUserAccessContextsCached(user.id, user.email).catch(() => []);
    isCoach = hasCoachAccess(contexts);
    // WI-3: an org admin who also coaches keeps their Admin Area door inside the portal
    // (the coach pill itself stays hidden here — self-referential).
    adminHref = getPrimaryOrgDestination(contexts);
    workspaces = workspaceDoorsFromContexts(contexts); // Stage D.2: the popover's rows
  }
  const startMenu = await startMenuPromise;

  return (
    <HelpDrawerProvider warm>
      <CoachesOverlayProvider>
        <CoachPortalShell signedIn={!!user?.email} isCoach={isCoach} adminHref={adminHref} workspaces={workspaces} startMenu={startMenu}>
          {children}
        </CoachPortalShell>
      </CoachesOverlayProvider>
    </HelpDrawerProvider>
  );
}
