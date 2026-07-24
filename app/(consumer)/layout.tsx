import type { Metadata } from 'next';
import ConsumerNav from '@/components/consumer/ConsumerNav';
import ConsumerThemeManager from '@/components/consumer/ConsumerThemeManager';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import styles from '@/components/consumer/ConsumerShell.module.css';
import { createClient } from '@/lib/supabase-server';
import { getUserAccessContextsCached, hasCoachAccess } from '@/lib/user-contexts';
import { getUserTheme } from '@/lib/user-preferences';
import type { UserTheme } from '@/lib/user-theme';

/**
 * Consumer shell layout (unified-app Phase 1). Wraps the logged-out front door —
 * the directory and its Scores / Following / Account siblings — in one app-like
 * shell. The marketing Navbar and Footer are suppressed on these routes (see
 * SiteChrome / Footer, keyed off lib/consumer-routes) so this shell owns the chrome.
 *
 * We resolve sign-in state here only to label the desktop header's utility link
 * ("Sign in" vs "Your workspaces"); anonymous visitors (and crawlers) render the
 * public front door exactly the same either way.
 */
// PWA install identity for the consumer front door (Discover/Scores/Following/
// Account). Without this <link rel="manifest">, Android Chromium never fires
// `beforeinstallprompt`, so the install banner can't appear here — the same
// manifest wiring the tournament/admin/coaches shells already carry (unified-app,
// one app at scope '/'). Merges with each page's own title/description.
export const metadata: Metadata = {
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'FieldLogicHQ',
  },
};

export default async function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Phase 3: surface the coaches hub inside the fan shell for accounts that coach.
  // Rides the access-context source of truth so claimable (email-matched, unclaimed)
  // teams count too — those coaches land on the hub's claim flow. Signed-out visitors
  // and crawlers never pay for this lookup; the /account page shares this resolution
  // via the per-request cache.
  // One parallel pass: whether the account coaches (surfaces the coaches hub) AND its saved
  // Dark⇄Warm theme. The layout already resolved `user`, so reading the theme here (vs. a client
  // fetch from the theme manager) avoids a second auth round-trip; the manager reconciles it
  // client-side. Signed-out visitors and crawlers pay for neither lookup.
  let isCoach = false;
  let accountTheme: UserTheme | null = null;
  if (user?.email) {
    const [contexts, theme] = await Promise.all([
      getUserAccessContextsCached(user.id, user.email).catch(() => []),
      getUserTheme(user.id).catch(() => null),
    ]);
    isCoach = hasCoachAccess(contexts);
    accountTheme = theme;
  }

  return (
    <div className={styles.shell}>
      <ConsumerThemeManager accountTheme={accountTheme} />
      <ConsumerNav signedIn={!!user?.email} isCoach={isCoach} />
      <div className={styles.content}>{children}</div>
      <InstallAppPrompt
        followsUserTheme
        subtitle="Follow your teams and get live scores — add it to your home screen."
      />
    </div>
  );
}
