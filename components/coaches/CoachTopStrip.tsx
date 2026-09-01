'use client';

/**
 * CoachTopStrip — the operator frame strip in the PREMIUM coach portal (Nav Unification
 * Stage H.1; D2 ratified 2026-07-31: "the FieldLogicHQ branding applies to the coaches
 * portal just like tournament admin — same product surface, admin hubs"). Reverses the
 * portal's no-wordmark ruling — logged in memory/design_decisions.md the same day.
 *
 * Sibling of AdminTopStrip: same anatomy (shared BrandLockup left; personal doors right),
 * this shell's skin — the CSS reads the portal's own tokens, so the strip flips warm/dark
 * with the account theme exactly like the sidebar beside it. Desktop >900px only; the
 * phone portal keeps its bottom nav + More sheet (mobile doors = the Stage H mobile pass,
 * gated on the More-sheet overflow check).
 *
 * Deliberate differences from AdminTopStrip (approved mockup = spec):
 *  • A "COACHES PORTAL" label sits beside the wordmark (2026-08-17 shell slimdown — the
 *    sidebar header that used to carry it is deleted; the strip owns identity now).
 *  • NO chat door — owner ruling 2026-07-31, see below.
 *
 * The bell JOINED this strip 2026-08-17 (owner-approved mockup, logged in
 * memory/design_decisions.md), superseding the "no bell" clause of the 2026-07-31 ruling.
 * That clause existed only because the sidebar header had one; with that header deleted,
 * the bell's single home is this corner — which is exactly where AdminTopStrip has always
 * kept its own. The no-duplicate-doors principle behind the old clause is preserved.
 *
 * THE ACCOUNT DOOR OPENS IN PLACE as of 2026-09-01 (owner-approved; plan of record
 * `docs/projects/active/COACH_ACCOUNT_MENU_PLAN.md`). It was the last strip control that
 * EJECTED the coach into consumer chrome — the exact fault that removed the chat door —
 * and it had no rescue link (only /chat ever got one). All three strip controls now open
 * in place (bell panel · account menu · Workspaces popover); actual exits live INSIDE
 * them, chosen knowingly, and the menu's outbound rows carry the way back. The sidebar's
 * own Sign out retired into the menu in the same change (one door per destination).
 * Hidden in the demo sandbox — a "Sign out" on the SHARED demo account must never render,
 * and a prospect who wanders out of a demo has simply been lost (mirrors AdminTopStrip).
 *
 * ⚠ THE CHAT DOOR WAS REMOVED (owner-ruled 2026-07-31; logged in memory/design_decisions.md —
 * do NOT re-add it from the earlier mockup). It was justified here as "your own conversations"
 * versus the portal's "team chat", but that distinction does not exist: the portal's own Chat
 * screen is per-USER, not per-team — it resolves from the same chat membership, lists the same
 * staff + tournament rooms, and heads itself "Your chats". So the strip's icon was a second
 * desktop door to the same conversations, sitting beside the sidebar's "Chat" at the same width.
 *
 * The portal's door won because this one EJECTED the coach into consumer chrome — the trip that
 * already needed a "Back to your Coaches Portal" rescue link added at A3 QA. Chat is a section
 * of the work, not an exit. Side effect: this shell no longer runs a third always-mounted
 * chat-unread pipeline, which retires the KNOWN COST this file used to carry.
 */

import BrandLockup from '@/components/shared/BrandLockup';
import NotificationBell from '@/components/notifications/NotificationBell';
import WorkspacesPill from '@/components/shared/WorkspacesPill';
import AccountMenu from '@/components/shared/AccountMenu';
import { useRoleSummary } from '@/lib/use-role-summary';
import { useOrg } from '@/lib/org-context';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import styles from './CoachTopStrip.module.css';

export default function CoachTopStrip({ wall = false }: {
  /** True on the portal's WALLS (billing-suspended, not-assigned): a wall keeps only the
   *  identity + exit doors it always had. Portal FUNCTION stays off — the bell (a working
   *  notification feed on the hard-block billing wall would undercut the wall's whole job;
   *  review 2026-08-17 — the notifications API is not billing-gated) and the account menu's
   *  Send feedback row. The menu's identity + exits (account, sign out) remain. */
  wall?: boolean;
}) {
  // The premium portal only renders signed-in, so this may run unconditionally.
  const roleSummary = useRoleSummary(true);
  const { currentOrg } = useOrg();
  /** "See it live" demo: hidden rather than disabled — the binding sandbox rule is hide the
   *  entry point, never let it dead-end. False for every real org. */
  const inSandbox = useIsSandbox();

  return (
    <header className={styles.strip}>
      <BrandLockup
        fieldClassName={styles.logoField}
        logicClassName={styles.logoLogic}
        hqClassName={styles.logoHq}
      />
      <span className={styles.stripDivider} aria-hidden />
      <span className={styles.stripLabel}>Coaches Portal</span>
      <div className={styles.doors}>
        {!wall && currentOrg?.slug && currentOrg.id && (
          <NotificationBell
            orgId={currentOrg.id}
            settingsHref={`/account/notifications?focus=coach-${currentOrg.slug}`}
            seeAllHref={`/${currentOrg.slug}/coaches/notifications`}
            panelPlacement="topStrip"
          />
        )}
        {!inSandbox && (
          <AccountMenu
            warm
            showTheme
            showFeedback={!wall}
            className={styles.iconDoor}
            settingsHref={
              currentOrg?.slug
                ? `/account/notifications?focus=coach-${currentOrg.slug}`
                : '/account/notifications'
            }
          />
        )}
        {/* 2+ places only (shared threshold inside the pill) — a single-team coach is
            already standing in their one place. warm: the popover reads the portal's
            --home-* set when the warm skin is active (falls back to HUD tokens in dark). */}
        <WorkspacesPill workspaces={roleSummary?.workspaces ?? []} className={styles.pill} warm />
      </div>
    </header>
  );
}
