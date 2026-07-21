import type { ReactNode } from 'react';
import ConsumerNav from '@/components/consumer/ConsumerNav';
import styles from '@/components/consumer/ConsumerShell.module.css';
import { createClient } from '@/lib/supabase-server';
import { getUserAccessContextsCached, hasCoachAccess } from '@/lib/user-contexts';

/**
 * Warm consumer chrome for the coach sign-up JOURNEY routes that live OUTSIDE the (consumer)
 * route group — /coaches/start, /coaches/claim, and the post-provision success screen
 * (/coaches/welcome). It mounts the SAME warm ConsumerNav (desktop top strip + mobile bottom tab
 * bar: Home / Scores / Chat / Account) the four consumer tabs wear, so a coach entering the
 * sign-up flow from the app never loses the back-to-app anchor and the journey reads as one app
 * (design_decisions S1-2). Nav shape never varies by auth state (R1); signed-out shows the app
 * wordmark + Sign in.
 *
 * The marketing Navbar + Footer are suppressed on these routes via isWarmJourneyPath (SiteChrome /
 * Footer), and ConsumerNav paints warm because isWarmSkinPath(pathname) is true here. Auth is
 * resolved server-side (mirrors app/(consumer)/layout.tsx) so ConsumerNav gets signedIn/isCoach.
 */
export default async function CoachJourneyChrome({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isCoach = false;
  if (user?.email) {
    const contexts = await getUserAccessContextsCached(user.id, user.email).catch(() => []);
    isCoach = hasCoachAccess(contexts);
  }

  return (
    <div className={styles.shell}>
      <ConsumerNav signedIn={!!user?.email} isCoach={isCoach} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
