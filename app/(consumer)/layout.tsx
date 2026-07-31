import type { Metadata } from 'next';
import ConsumerNav from '@/components/consumer/ConsumerNav';
import ConsumerThemeManager from '@/components/consumer/ConsumerThemeManager';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import styles from '@/components/consumer/ConsumerShell.module.css';
import { getAuthUserCached } from '@/lib/supabase-server';
import { getUserAccessContextsCached, hasCoachAccess, getPrimaryOrgDestination, workspaceDoorsFromContexts, type WorkspaceDoor } from '@/lib/user-contexts';
import { getUserTheme } from '@/lib/user-preferences';
import { getStartMenuConfig } from '@/lib/start-menu';
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
  const user = await getAuthUserCached();

  // Phase 3: surface the coaches hub inside the fan shell for accounts that coach.
  // Rides the access-context source of truth so claimable (email-matched, unclaimed)
  // teams count too — those coaches land on the hub's claim flow. Signed-out visitors
  // and crawlers never pay for this lookup; the /account page shares this resolution
  // via the per-request cache.
  // One parallel pass: whether the account coaches (surfaces the coaches hub) AND its saved
  // Dark⇄Warm theme. The layout already resolved `user`, so reading the theme here (vs. a client
  // fetch from the theme manager) avoids a second auth round-trip; the manager reconciles it
  // client-side. Signed-out visitors and crawlers skip these two identity lookups (they still
  // pay the one plan-gating read below — the persona menu's gating matters most to them).
  // Persona-menu gating (WI-2) — this layout is already dynamic (auth above), so the
  // cookies+DB read inside is free of new rendering consequences. Kicked off BEFORE the
  // identity lookups so it runs concurrently with them (it depends on neither).
  const startMenuPromise = getStartMenuConfig().catch(() => undefined);
  let isCoach = false;
  let adminHref: string | null = null;
  let workspaces: WorkspaceDoor[] = [];
  let accountTheme: UserTheme | null = null;
  if (user?.email) {
    const [contexts, theme] = await Promise.all([
      getUserAccessContextsCached(user.id, user.email).catch(() => []),
      getUserTheme(user.id).catch(() => null),
    ]);
    isCoach = hasCoachAccess(contexts);
    adminHref = getPrimaryOrgDestination(contexts); // WI-3: the ONE persistent operator door
    workspaces = workspaceDoorsFromContexts(contexts); // Stage D.2: the popover's rows, same source
    accountTheme = theme;
  }
  const startMenu = await startMenuPromise;

  return (
    <div className={styles.shell}>
      <ConsumerThemeManager accountTheme={accountTheme} />
      <ConsumerNav signedIn={!!user?.email} isCoach={isCoach} adminHref={adminHref} workspaces={workspaces} startMenu={startMenu} />
      <div className={styles.content}>{children}</div>
      <InstallAppPrompt
        followsUserTheme
        subtitle="Follow your teams and get live scores — add it to your home screen."
      />
    </div>
  );
}
