'use client';

/**
 * AdminTopStrip — the operator frame strip (Nav Unification Stage C, owner-directed
 * 2026-07-31). The app's thin top bar, worn by the admin shell in its own dark skin:
 * the wordmark exits to Home on the left (grammar Zone 1 — platform identity lives HERE
 * now, not in the sidebar), and the person's own doors sit in the top-right corner every
 * other surface uses (Zone 3): notifications · account · the Workspaces popover.
 * Desktop only (>900px) — phones keep the bottom nav + More sheet, which already carry
 * these doors. The ⇄ flip pill deliberately stays in AdminEventHeader: the strip is the
 * frame's doors; the flip belongs to the place identity it flips.
 *
 * NO CHAT DOOR (owner ruling 2026-07-31, generalized from the coach strip — logged in
 * memory/design_decisions.md; do NOT re-add it from the earlier mockup): a /chat door here
 * duplicated the shell's own Chat section and EJECTED the operator into consumer chrome.
 * The strip keeps only genuine leave-this-place doors — wordmark · bell · account ·
 * workspaces; chat is a section of the work, not an exit. (Also retires what would have
 * been a second chat-unread pipeline on every admin pageview.)
 *
 * The Workspaces popover renders only for 2+ places (shared threshold inside the pill):
 * a single-place admin is already standing in their one place — a pill would be
 * self-referential noise. This replaces the sidebar footer's old "All Workspaces" link.
 *
 * The bell's count is HOISTED from AdminChrome (one fetch + Realtime channel, shared with
 * the mobile More badge) — this component opens no pipelines of its own beyond the one
 * role-summary fetch feeding the Workspaces popover.
 */

import { type Dispatch, type SetStateAction } from 'react';
import NotificationBell from '@/components/notifications/NotificationBell';
import AccountMenu from '@/components/shared/AccountMenu';
import BrandLockup from '@/components/shared/BrandLockup';
import WorkspacesPill from '@/components/shared/WorkspacesPill';
import { useRoleSummary } from '@/lib/use-role-summary';
import { useOrg } from '@/lib/org-context';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { getNotificationSettingsHref } from '@/lib/billing-urls';
import styles from './AdminTopStrip.module.css';

export default function AdminTopStrip({ notifCount, onNotifCountChange }: {
  /** Hoisted unread count from the admin shell — see the header comment. */
  notifCount?: number;
  onNotifCountChange?: Dispatch<SetStateAction<number>>;
}) {
  const { currentOrg } = useOrg();
  // The admin shell only renders signed-in — the hook may run unconditionally.
  const roleSummary = useRoleSummary(true);
  /** "See it live" demo: the account door leads out of the sandbox into the real platform, and a
   *  prospect who wanders out of a demo has simply been lost. Hidden rather than disabled — the
   *  binding sandbox rule is hide the entry point, never let it dead-end. The wordmark beside it
   *  goes inert for the same reason (BrandLockup). False for every real org. */
  const inSandbox = useIsSandbox();

  return (
    <header className={styles.strip}>
      <BrandLockup
        fieldClassName={styles.logoField}
        logicClassName={styles.logoLogic}
        hqClassName={styles.logoHq}
      />
      <div className={styles.doors}>
        {currentOrg?.id && (
          <NotificationBell
            orgId={currentOrg.id}
            settingsHref={getNotificationSettingsHref(currentOrg.slug)}
            seeAllHref={`/${currentOrg.slug}/admin/notifications`}
            count={notifCount}
            onCountChange={onNotifCountChange}
            panelPlacement="topStrip"
          />
        )}
        {/* The account door opens IN PLACE (2026-09-01, shared with the coach strip — plan
            `docs/projects/active/COACH_ACCOUNT_MENU_PLAN.md`): identity, notification
            settings, feedback, the account pages, sign out. NO theme control here —
            tournament pages always show the organizer's colors, and a toggle that visibly
            does nothing where you stand reads as broken. */}
        {!inSandbox && (
          <AccountMenu
            className={styles.iconDoor}
            settingsHref={
              currentOrg?.slug ? getNotificationSettingsHref(currentOrg.slug) : '/account/notifications'
            }
          />
        )}
        <WorkspacesPill workspaces={roleSummary?.workspaces ?? []} className={styles.pill} />
      </div>
    </header>
  );
}
