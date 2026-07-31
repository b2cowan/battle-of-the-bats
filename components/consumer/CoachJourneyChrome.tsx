import type { ReactNode } from 'react';
import ConsumerNav from '@/components/consumer/ConsumerNav';
import styles from '@/components/consumer/ConsumerShell.module.css';
import { createClient } from '@/lib/supabase-server';
import { getUserAccessContextsCached, hasCoachAccess, getPrimaryOrgDestination, workspaceDoorsFromContexts, type WorkspaceDoor } from '@/lib/user-contexts';
import { getStartMenuConfig } from '@/lib/start-menu';

/**
 * Warm consumer chrome for the coach sign-up JOURNEY routes that live OUTSIDE the (consumer)
 * route group — /coaches/start, /coaches/claim, and the post-provision success screen
 * (/coaches/welcome). It mounts the SAME warm ConsumerNav the four consumer tabs wear, so a
 * coach entering the sign-up flow from the app never loses the back-to-app anchor and the
 * journey reads as one app (design_decisions S1-2). Since Desktop Public UX Phase 1 (WI-5)
 * the nav is state-based platform-wide: anonymous = Home/Scores + Sign In, signed-in = the
 * full four tabs — so completing sign-up mid-journey swaps Sign In for Chat/Account. This
 * amends S1-2's original "nav shape never varies by auth state" wording; the anchor-tabs
 * intent (journey wears the same app chrome) still holds.
 *
 * The marketing Navbar + Footer are suppressed on these routes via isWarmJourneyPath (SiteChrome /
 * Footer), and ConsumerNav paints warm because isWarmSkinPath(pathname) is true here. Auth is
 * resolved server-side (mirrors app/(consumer)/layout.tsx) so ConsumerNav gets signedIn/isCoach.
 */
export default async function CoachJourneyChrome({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Persona-menu gating (WI-2) — this chrome is already dynamic (auth above). Started
  // before the contexts lookup so the two resolve concurrently (no dependency).
  const startMenuPromise = getStartMenuConfig().catch(() => undefined);
  let isCoach = false;
  let adminHref: string | null = null;
  let workspaces: WorkspaceDoor[] = [];
  if (user?.email) {
    const contexts = await getUserAccessContextsCached(user.id, user.email).catch(() => []);
    isCoach = hasCoachAccess(contexts);
    adminHref = getPrimaryOrgDestination(contexts);
    workspaces = workspaceDoorsFromContexts(contexts); // Stage D.2: the popover's rows
  }
  const startMenu = await startMenuPromise;

  return (
    <div className={styles.shell}>
      <ConsumerNav signedIn={!!user?.email} isCoach={isCoach} adminHref={adminHref} workspaces={workspaces} startMenu={startMenu} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
