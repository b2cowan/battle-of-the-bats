'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useOrg } from '@/lib/org-context';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import AdminEventHeader from '@/components/admin/AdminEventHeader';
import AdminTopStrip from '@/components/admin/AdminTopStrip';
import { useAdminKit } from '@/components/admin/AdminKitProvider';
import { useNotificationUnread } from '@/lib/use-notification-unread';
import { CancellationGuard } from '@/components/admin/CancellationGuard';
import { getBillingHref } from '@/lib/billing-urls';
import { LiveLogicRail } from '@/components/live-logic/LiveLogicRail';
import EnablePushBanner from '@/components/notifications/EnablePushBanner';
import { AdminDensityProvider } from '@/lib/admin-density';
import { AdminWorklistProvider } from '@/lib/admin-worklist';
import AdminTitleManager from './AdminTitleManager';
import FeedbackRequestIdProvider from '@/components/feedback/FeedbackRequestIdProvider';
import styles from './admin.module.css';

// Admin Design Continuity — the kit frame, split into its own chunk (`/simplify`, slice 1). Statically
// imported, its ~100KB of source rode every admin page for every user, production included, where the
// switch can never turn it on. Loaded only when rendered (switch on); still server-rendered, so the
// first paint is the kit frame with no flash. The release slice makes these the only frame and can
// import them statically again.
const AdminKitRail = dynamic(() => import('@/components/admin/kit/AdminKitRail'));
const AdminKitBottomNav = dynamic(() => import('@/components/admin/kit/AdminKitBottomNav'));
const AdminKitProgramRow = dynamic(() => import('@/components/admin/kit/AdminKitProgramRow'));
// Club Tier Stage 1 — the morning brief, read once for the hub, the rail and the phone bar (and the
// plan-aware program order they share). Kit only, so it rides no switch-off page either.
const ClubBriefProvider = dynamic(() => import('@/components/admin/kit/club/ClubBriefProvider').then(m => m.ClubBriefProvider));

export default function AdminChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  // All hooks must be called unconditionally — before any early return.
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  // Admin Design Continuity — the switch (`lib/admin-kit-preview.ts`). Off: every line below renders
  // exactly what it always has. On: the kit frame (rail, phone bar, the phone's program row, the
  // coach shell's ground). The release slice deletes the legacy branch of each.
  const kit = useAdminKit();
  // Focused shells (onboarding / help / tournament-preview) render no sidebar or bottom nav, so no
  // bell or badge consumes the notification count there. Compute this up front to gate the hook below.
  const isOnboarding = pathname.endsWith('/admin/onboarding');
  const isTournamentPreview = pathname.includes('/admin/tournaments/preview/');
  const isHelp = pathname.includes('/admin/help');
  const isFocusedAdmin = isOnboarding || isHelp;
  const isFocused = isFocusedAdmin || isTournamentPreview;

  // Own the unread notification count ONCE for the whole admin shell — the desktop top-strip bell
  // (Stage C: moved up from the sidebar) and the mobile More-tab badge both read it, so a single
  // fetch + Realtime channel serves both (both are always mounted; CSS just hides one per
  // breakpoint). Skip it on focused shells that render no consumer, so we never hold a Realtime
  // channel open with nothing reading it.
  const notif = useNotificationUnread(!isFocused ? currentOrg?.id : null);
  // Chat unread is NOT hoisted here: the strip's chat door was removed (owner ruling
  // 2026-07-31 — chat is a section of the work, not an exit), so the sidebar's tournament
  // Chat badge is the only consumer again and self-serves, gated to tournament routes.

  // Cancelled-account redirect guard.
  // useOrg() provides the subscription status synchronously (from initialOrg set in the layout),
  // and usePathname() provides the current path on both server and client, so both agree on this
  // output — no hydration mismatch, no content flash, no loop.
  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';
  const billingPath = currentOrg ? getBillingHref(currentOrg.slug, currentOrg.planId) : null;
  if (isCanceled && billingPath && !pathname.startsWith(billingPath)) {
    return <CancellationGuard />;
  }
  // The kit's ground (the coach shell's page tone and grid). Not on the help guide yet: it is pinned
  // dark by ruling until slice 5 moves it onto the theme (R4), and a cream margin round a dark
  // reading surface would be a third look, not either of the two.
  const kitGround = kit && !isHelp;
  const shellClassName = isTournamentPreview
    ? styles.adminPreviewShell
    : `${styles.adminShell} ${isFocusedAdmin ? styles.adminShellFocused : ''}${kitGround ? ` ${styles.adminShellKit}` : ''}`;
  const mainClassName = isTournamentPreview
    ? styles.adminPreviewMain
    : `${styles.adminMain} ${isFocusedAdmin ? styles.adminMainFocused : ''}${kitGround ? ` ${styles.adminMainKit}` : ''}`;

  const frame = (
    <>
      <CancellationGuard />
      <AdminTitleManager />
      <FeedbackRequestIdProvider />
      <div className={shellClassName}>
        {/* Stage C — the operator frame strip: desktop-only fixed top bar (wordmark → Home,
            bell · account · Workspaces). NO chat door: chat is a destination for a fan and a
            SECTION OF THE WORK for an operator, so the strips deliberately don't eject into
            consumer chrome (binding ruling 2026-07-31; this comment still listed the removed
            door until the 2026-08-01 top-nav audit). Mounted INSIDE the shell so the strip can
            read the shell's own --admin-topstrip-h (custom properties don't reach siblings);
            position:fixed keeps it out of the flex flow regardless. The shell + sidebar +
            event header all offset by the same var (admin.module.css). */}
        {!isFocused && (
          <AdminTopStrip
            notifCount={notif.count}
            onNotifCountChange={notif.setCount}
          />
        )}
        {!isFocused && (kit ? <AdminKitRail /> : <AdminSidebar />)}
        <main className={mainClassName}>
          {isFocused ? (
            // R2 — a public page previewed inside the kit admin is the public page: the island puts
            // back the org's colours and the public dark palette (globals.css, `data-public-preview`).
            kit && isTournamentPreview
              ? <div className={styles.previewIsland} data-public-preview>{children}</div>
              : children
          ) : (
            <>
              {/* The Flip: one persistent shell header (event/org identity + status + pill), desktop
                  and mobile. Sticky; collapses on scroll. Supersedes the old mobile top bar + the
                  floating desktop pill. */}
              <AdminEventHeader />
              <div className={styles.mainPad}>
                <EnablePushBanner />
                {kit && <AdminKitProgramRow key={pathname} />}
                {children}
              </div>
            </>
          )}
        </main>
        {/* Inside the shell so the rail's top offset can read --admin-topstrip-h (custom
            properties don't reach siblings); position:fixed keeps it out of the flex flow. */}
        {!isFocused && <LiveLogicRail />}
      </div>
      {!isFocused && (kit
        ? <AdminKitBottomNav notifUnread={notif.count} />
        : <AdminBottomNav notifUnread={notif.count} />)}
    </>
  );

  return (
    <AdminDensityProvider>
      <AdminWorklistProvider>
        {kit ? <ClubBriefProvider>{frame}</ClubBriefProvider> : frame}
      </AdminWorklistProvider>
    </AdminDensityProvider>
  );
}
