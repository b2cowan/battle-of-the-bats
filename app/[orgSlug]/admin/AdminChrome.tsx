'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useOrg } from '@/lib/org-context';
import AdminEventHeader from '@/components/admin/AdminEventHeader';
import AdminTopStrip from '@/components/admin/AdminTopStrip';
import { AdminKitProvider } from '@/components/admin/AdminKitProvider';
import { useNotificationUnread } from '@/lib/use-notification-unread';
import { CancellationGuard } from '@/components/admin/CancellationGuard';
import { getBillingHref } from '@/lib/billing-urls';
import EnablePushBanner from '@/components/notifications/EnablePushBanner';
import { AdminDensityProvider } from '@/lib/admin-density';
import { AdminWorklistProvider } from '@/lib/admin-worklist';
import AdminTitleManager from './AdminTitleManager';
import { SetupWizardProvider } from '@/components/admin/tournament/SetupWizardOpener';
import FeedbackRequestIdProvider from '@/components/feedback/FeedbackRequestIdProvider';
import styles from './admin.module.css';

// Admin Design Continuity — the admin's frame (the rail, the phone bar, the phone's program row) and the
// club's morning brief, each in its own chunk. They were split off in slice 1 so the dev-only switch's
// frame rode no production page; since the release they render on every admin page, and they STAY
// dynamic on purpose (Part B, 2026-09-29): a static import moves their stylesheets within the bundle,
// and equal-weight rules resolve by bundle order — a pixel risk the cleanup has no reason to take.
// Still server-rendered, so the first paint is the frame with no flash.
const AdminKitRail = dynamic(() => import('@/components/admin/kit/AdminKitRail'));
const AdminKitBottomNav = dynamic(() => import('@/components/admin/kit/AdminKitBottomNav'));
const AdminKitProgramRow = dynamic(() => import('@/components/admin/kit/AdminKitProgramRow'));
// Club Tier Stage 1 — the morning brief, read once for the hub, the rail and the phone bar (and the
// plan-aware program order they share).
const ClubBriefProvider = dynamic(() => import('@/components/admin/kit/club/ClubBriefProvider').then(m => m.ClubBriefProvider));

export default function AdminChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  // All hooks must be called unconditionally — before any early return.
  const pathname = usePathname();
  const { currentOrg } = useOrg();
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
  // 2026-07-31 — chat is a section of the work, not an exit), so the rail's tournament
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
  // The kit's ground (the coach shell's page tone and grid). Not on the help guide: when the guide
  // was pinned dark (until slice 5, R4) a cream margin round it would have been a third look, and it
  // moved onto the theme on the shell's own ground — the ground walk §245 W6 passed.
  const kitGround = !isHelp;
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
      {/* R2 on the preview's own GROUND too (slice 6, the preview's Warm tab bar): the preview shell
          paints `--pitch-black`, which the kit turns to paper in Warm, and the public top-tab row is a
          92%-opaque bar composited over it — its tab labels fell to 4.40:1. The island below restores
          the public palette only INSIDE `main`; marking the shell as well puts the public ground back
          under everything the preview draws. */}
      <div className={shellClassName} {...(isTournamentPreview ? { 'data-public-preview': '' } : {})}>
        {/* Stage C — the operator frame strip: desktop-only fixed top bar (wordmark → Home,
            bell · account · Workspaces). NO chat door: chat is a destination for a fan and a
            SECTION OF THE WORK for an operator, so the strips deliberately don't eject into
            consumer chrome (binding ruling 2026-07-31; this comment still listed the removed
            door until the 2026-08-01 top-nav audit). Mounted INSIDE the shell so the strip can
            read the shell's own --admin-topstrip-h (custom properties don't reach siblings);
            position:fixed keeps it out of the flex flow regardless. The shell + rail +
            event header all offset by the same var (admin.module.css). */}
        {!isFocused && (
          <AdminTopStrip
            notifCount={notif.count}
            onNotifCountChange={notif.setCount}
          />
        )}
        {!isFocused && <AdminKitRail />}
        <main className={mainClassName}>
          {isFocused ? (
            // R2 — a public page previewed inside the admin is the public page: the island puts back
            // the org's colours and the public dark palette (globals.css, `data-public-preview`). The
            // kit is OFF for every component inside it, too (slice 4c): a shared part that asks —
            // a portaled bottom sheet — must answer as the public page it sits in.
            isTournamentPreview
              ? <div className={styles.previewIsland} data-public-preview><AdminKitProvider on={false}>{children}</AdminKitProvider></div>
              : children
          ) : (
            <>
              {/* The Flip: one persistent shell header (event/org identity + status + pill), desktop
                  and mobile. Sticky; collapses on scroll. Supersedes the old mobile top bar + the
                  floating desktop pill. */}
              <AdminEventHeader />
              <div className={styles.mainPad}>
                <EnablePushBanner />
                <AdminKitProgramRow key={pathname} />
                {children}
              </div>
            </>
          )}
        </main>
      </div>
      {!isFocused && <AdminKitBottomNav notifUnread={notif.count} />}
    </>
  );

  return (
    <AdminDensityProvider>
      <AdminWorklistProvider>
        {/* The one setup wizard every door opens (Tournament admin redesign Stage 4, D2): above the pages
            so its notice survives the move to the new draft's board. */}
        <SetupWizardProvider>
          <ClubBriefProvider>{frame}</ClubBriefProvider>
        </SetupWizardProvider>
      </AdminWorklistProvider>
    </AdminDensityProvider>
  );
}
