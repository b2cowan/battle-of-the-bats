'use client';

/**
 * AdminTopStrip — the operator frame strip (Nav Unification Stage C, owner-directed
 * 2026-07-31). The app's thin top bar, worn by the admin shell in the coaches portal's skin:
 * the wordmark exits to Home on the left (grammar Zone 1 — platform identity lives HERE
 * now, not in the sidebar), and the person's own doors sit in the top-right corner every
 * other surface uses (Zone 3): notifications · account · the Workspaces popover.
 * Desktop only (>900px) — phones keep the bottom nav + More sheet, which already carry
 * these doors.
 *
 * ⚖ ROUND 4 (Admin header bar, option B, owner 2026-11-08, D1–D5): THE STRIP NAMES WHERE YOU ARE. It splits on
 * the sidebar's edge: over the sidebar, the wordmark and the portal's word — "Club" or "Events" (owner 2026-11-09,
 * `adminStripWord`; it replaced D4's "Admin") —, the mark alone when
 * the sidebar is collapsed; over the page, the place — its way up, its name, its switcher, its chip, from the ONE
 * model the phone bar reads (`useAdminPlace`) — then View site beside the bell (it moved up from the bar; the
 * phone keeps its globe in the bar), the account menu and Workspaces. The place's name starts at the page
 * column's padding, where the bar's name sat. Which header names the place is CSS at 900/901px, never a width
 * read in script, so the server's first paint is already right; the copy not shown is `display: none`, so the
 * page keeps one `<h1>`. Overview says "Overview" here (D2): the club heads the sidebar (`AdminKitRail`).
 * A cancelled account's one page keeps the strip as it was: no sidebar to split on, and its bar names the org.
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
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { orgBell } from '@/lib/notification-bell-scope';
import AccountMenu from '@/components/shared/AccountMenu';
import BrandLockup from '@/components/shared/BrandLockup';
import WorkspacesPill from '@/components/shared/WorkspacesPill';
import { useRoleSummary } from '@/lib/use-role-summary';
import { useOrg } from '@/lib/org-context';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { getNotificationSettingsHref } from '@/lib/billing-urls';
import FlipPill from '@/components/shared/FlipPill';
import { useAdminFlip } from '@/lib/use-admin-flip';
import { adminStripWord, WORKSPACE_KIND_LABEL } from '@/lib/workspace-labels';
import { adminHelpHref } from '@/lib/admin-kit-nav';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { useAdminPlace } from './useAdminPlace';
import styles from '@/components/coaches/CoachTopStrip.module.css';
import own from './AdminTopStrip.module.css';

/** The place, drawn for the strip (desktop). The phone's rendering of the same model is `AdminEventHeader`. */
function StripPlace() {
  const { title, titleHref, isPageTitle, onOverview, place, dates, phaseChip } = useAdminPlace(false);
  // D2: on the club's Overview the strip says "Overview" (the club already heads the sidebar). The phone's Overview bar
  // still names the club (A3).
  const text = onOverview ? 'Overview' : title;
  const name = isPageTitle ? <h1 className={own.name}>{text}</h1> : <span className={own.name}>{text}</span>;
  return (
    <div className={own.place}>
      {place?.back && (
        <>
          <Link href={place.back.href} className={own.back} aria-label={`Back to ${place.back.label}`}>
            <ArrowLeft size={15} aria-hidden />
            <span>{place.back.label}</span>
          </Link>
          <span className={own.backRule} aria-hidden />
        </>
      )}
      {titleHref
        ? <Link href={titleHref} className={own.nameLink} title={`${title} — open dashboard`}>{name}</Link>
        : name}
      {place?.switcher && <span className={own.switcher}>{place.switcher}</span>}
      {/* A record's own fact sits beside its name as quiet words, the way a tournament's dates do (round 5, Q4). */}
      {place?.detail && <span className={own.dates}>{place.detail}</span>}
      {dates && <span className={own.dates}>{dates}</span>}
      {phaseChip && <span className={own.chip}>{phaseChip}</span>}
      {place?.chip && <span className={own.chip}>{place.chip}</span>}
    </div>
  );
}

export default function AdminTopStrip({ notifCount, onNotifCountChange, suspended = false }: {
  /** Hoisted unread count from the admin shell — see the header comment. */
  notifCount?: number;
  onNotifCountChange?: Dispatch<SetStateAction<number>>;
  /** A cancelled account's one page (owner 2026-11-05): the strip is the ONLY chrome left, so it shows on a phone too
   *  (the account menu and the Workspaces pill are the exits the hidden bottom bar used to carry) and drops the bell,
   *  whose notifications open tools the account no longer has. */
  suspended?: boolean;
}) {
  const { currentOrg, canOpen } = useOrg();
  // The admin shell only renders signed-in — the hook may run unconditionally.
  const roleSummary = useRoleSummary(true);
  /** "See it live" demo: the account door leads out of the sandbox into the real platform, and a
   *  prospect who wanders out of a demo has simply been lost. Hidden rather than disabled — the
   *  binding sandbox rule is hide the entry point, never let it dead-end. The wordmark beside it
   *  goes inert for the same reason (BrandLockup). False for every real org. */
  const inSandbox = useIsSandbox();
  const flip = useAdminFlip();
  // Admin Design Continuity — the strip wears the COACHES PORTAL'S strip, stylesheet and all (one
  // stylesheet is the only way two strips cannot drift), its doors take their warm skins, and the
  // account menu offers the Appearance choice: the admin follows the account theme, so the old "a
  // toggle that visibly does nothing reads as broken" reason for hiding it no longer holds.

  const split = !suspended;
  const pathname = usePathname();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  // ⚖ "Club" or "Events" (owner 2026-11-09), from the address and the plan — both known on the server, so the first paint
  // says it; the tournament-only test is `useAdminKitNav`'s (the plan's fact, D8).
  const tournamentOnly = canOpen('module_tournaments') && !!currentOrg && isTournamentOnlyWorkspace(currentOrg);
  const stripWord = adminStripWord({ onTournaments: pathname.startsWith(`${base}/tournaments`), tournamentOnly });
  // The portal word: in the split strip, the short form for the sidebar-width cell (D4), which a collapsed sidebar hides
  // with the wordmark's name. A cancelled account's one page keeps its strip exactly as it was (no sidebar, no cell; on
  // a phone too): the full word, never hidden by a sidebar preference it has no sidebar for (/review, 2026-11-08).
  const wordClass = split ? ` ${own.lcellWord}` : '';
  const word = (
    <>
      {/* ⚖ The strip names its portal (the nav standard's N6, Ask A6, 2026-10-17), as the coach strip says "Coaches
          Portal": someone with both hats flips between two shells that look alike. */}
      <span className={`${styles.stripDivider}${wordClass}`} aria-hidden />
      <span className={`${styles.stripLabel}${wordClass}`}>{split ? stripWord : WORKSPACE_KIND_LABEL.organization}</span>
    </>
  );
  const doors = (
      <div className={styles.doors}>
        {/* View site, beside the bell (D1). Not on a cancelled account's one page: its public site is suspended. */}
        {flip && !suspended && <FlipPill resolution={flip} variant="inline" className={own.pill} />}
        {currentOrg?.id && !suspended && (
          <NotificationBell
            bell={orgBell(currentOrg.id)!}
            portal="admin"
            settingsHref={getNotificationSettingsHref(currentOrg.slug)}
            count={notifCount}
            onCountChange={onNotifCountChange}
          />
        )}
        {/* The account door opens IN PLACE (2026-09-01, shared with the coach strip — plan
            `docs/projects/active/COACH_ACCOUNT_MENU_PLAN.md`): identity, notification
            settings, feedback, the account pages, sign out — and the Appearance choice, since
            the admin follows the account theme (above). */}
        {!inSandbox && (
          <AccountMenu
            showWhatsNew
            // ⚖ Help lives here on a desktop, under What's new (E16, owner 2026-11-09): the guide for where you are, in a
            // new tab. The phone keeps it at the More sheet's foot; the sandbox (no menu) keeps it in the sidebar's foot. Not on
            // a cancelled account's one page: its help would bounce to billing (a door that dead-ends).
            helpHref={!suspended && currentOrg?.slug ? adminHelpHref(pathname, base) : undefined}
            className={styles.iconDoor}
            settingsHref={
              currentOrg?.slug ? getNotificationSettingsHref(currentOrg.slug) : '/account/notifications'
            }
            warm
            showTheme
          />
        )}
        <WorkspacesPill workspaces={roleSummary?.workspaces ?? []} className={styles.pill} warm />
      </div>
  );

  return (
    <header className={`${styles.strip}${suspended ? ` ${styles.stripAlways}` : ''}${split ? ` ${styles.stripSplit}` : ''}`}>
      {split ? (
        <>
          <div className={own.lcell}>
            <BrandLockup tone="follow" size={15} className={own.lcellBrand} />
            {word}
          </div>
          <div className={own.rcell}>
            <StripPlace />
            {doors}
          </div>
        </>
      ) : (
        <>
          <BrandLockup tone="follow" size={15} />
          {word}
          {doors}
        </>
      )}
    </header>
  );
}
