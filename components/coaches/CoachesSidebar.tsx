'use client';
import { Fragment, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, Shield, Trophy, CreditCard } from 'lucide-react';
import { useCoaches, resolveLiveSeason, resolveClosedSeason } from '@/lib/coaches-context';
import { coachTeamIdIn, resolveNavTeamId } from '@/lib/coach-nav-visibility';
import { coachNavGroupsFor, isCoachNavItemLit, type CoachNavItem } from '@/lib/coach-team-nav';
import { useOrg } from '@/lib/org-context';
import { coachBillingLink, coachHostedTournamentsLink } from '@/lib/coach-billing-access';
import { adminDoorHome } from '@/lib/member-home';
import { PLAN_BILLING_TITLE } from '@/lib/plan-billing-title';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { useChatUnread } from '@/lib/use-chat-unread';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import { CollapseSidebarRow, SidebarStripTip } from '@/components/shared/SidebarStrip';
import CoachTeamCell from './CoachTeamCell';
import strip from '@/components/shared/SidebarStrip.module.css';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ⚖ THE TEAM NAV — six groups, fixed, ordered by how often a coach opens them — LIVES IN `lib/coach-team-nav.ts` (navigation
 * Phase 4): this sidebar draws it, the phone's More sheet is it minus the bar's tabs, and the strip names the page from it.
 * Read that file's header before changing a row: item labels are the capability gate's keys; headings are free.
 *
 * ⚖ THE TEAM HEADS THE SIDEBAR (navigation Phase 4, E6/E10): `CoachTeamCell` — the team's tile and name, a chevron with two
 * teams or more, the whole cell opening the team list. It replaced the <select> and the folded strip's initials tile.
 * ⚖ NOTHING FOLDS (E14): the headings are labels; the rows and the foot scroll as one list under the pinned cell. 240 wide
 * (E9), 64 folded.
 *
 * ⚖ THE RAIL FOLDS TO A 64 STRIP OF ICONS, BY CHOICE, PER DEVICE (Sidebar Strip & Grid Width, Stage 2 —
 * the ratified hub's screen 9; the shared parts are `components/shared/SidebarStrip`, the one setting
 * `lib/sidebar-strip.ts`, shared with the club, tournament and free portals). "Collapse sidebar" is the
 * last row. The same rows render in both states and the stylesheet narrows them, so nothing snaps on a
 * cold load. ⚖ Ask 6: the five group headings become hairlines and EVERY page is an icon in today's
 * order. The team cell folds to its tile, opening the same list beside it (No live season included). A team
 * with no live season has its one door here as everywhere: the strip draws the rows this rail computes.
 */
export default function CoachesSidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const { assignments, closedAssignments } = useCoaches();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const inSandbox = useIsSandbox();
  const billingHref = coachBillingLink(currentOrg, userRole, userCapabilities, inSandbox);
  const tournamentsHref = coachHostedTournamentsLink(currentOrg, userRole, userCapabilities, inSandbox);
  // The "Admin" door — for anyone the club admin itself admits, landing on THEIR home (F-XR-2; the rule is
  // lib/member-home.ts `adminDoorHome`, shared with the phone bar's More sheet). A coach-only user has no door.
  const adminHome = adminDoorHome(orgSlug, userRole, currentOrg, userCapabilities);
  const chatUnread = useChatUnread();

  const urlTeamId = coachTeamIdIn(pathname);
  // Off-team pages (notifications, the hub) keep the coach's team in the rail — the SAME fallback
  // the phone bar has always used, from one shared rule (lib/coach-nav-visibility.ts; review R7,
  // owner-approved D5 2026-09-03). Before this the rail emptied to "Choose a team…" + Help on the
  // one screen a coach reads off-team, while the bar beneath it still pointed at their team.
  const currentTeamId = resolveNavTeamId(urlTeamId, assignments, closedAssignments);

  // Remember the last team the coach was in (per org) — the /coaches entry point lands
  // there on the next visit (owner call, Batch 3 QA 2026-07-29). Best-effort only.
  // ⚠ The URL's team, not the resolved one: a fallback must never overwrite a real visit.
  useEffect(() => {
    if (!urlTeamId) return;
    try { localStorage.setItem(`flhq-coach-last-team:${orgSlug}`, urlTeamId); } catch { /* ignore */ }
  }, [urlTeamId, orgSlug]);

  // The team's LIVE season, and — when it has none — its newest closed one. ONE resolution rule,
  // shared with the bottom nav, the masthead and every page (lib/coach-season-view.ts), so no
  // surface can drift on which season it is describing.
  //
  // ⚠ **A CLOSED SEASON IS ONE PAGE** (owner ruling 2026-08-18). The nav a coach between seasons
  // sees is that page and nothing else — not the whole menu with read-only screens behind it, which
  // is what the twenty-nine deleted finished-season branches existed to explain.
  const liveSeason = resolveLiveSeason(assignments, currentTeamId);
  const closedSeason = resolveClosedSeason(assignments, closedAssignments, currentTeamId);
  const workingSeason = liveSeason ?? closedSeason;
  const seasonFinished = !liveSeason && !!closedSeason;

  const base = `/${orgSlug}/coaches`;
  const teamBase = `${base}/teams/${currentTeamId}`;
  // Assistant Coaches: hide nav areas the current coach isn't cleared for — the gate shared with the phone's bar and the
  // strip's name (`coachNavGroupsFor`, lib/coach-team-nav.ts), so it's one source of truth. Head coaches have full
  // capabilities so nothing hides; fail-open if caps are absent (server still enforces). A team with no live season has
  // ONE door (`withClosedSeasonNav` inside it).
  const groups = currentTeamId && workingSeason ? coachNavGroupsFor(workingSeason.capabilities, seasonFinished) : [];

  const renderNavItem = ({ label, href, icon: Icon }: CoachNavItem) => {
    const lit = isCoachNavItemLit(pathname, teamBase, href);
    return (
      <Link
        key={label}
        href={`${teamBase}${href}`}
        className={`${styles.sidebarItem}${lit ? ` ${styles.sidebarItemActive}` : ''}`}
        aria-current={lit ? 'page' : undefined}
      >
        <Icon size={14} />
        <span className={strip.rowLabel}>{label}</span>
        {label === 'Chat' && <ChatUnreadBadge count={chatUnread} className={strip.cornerCount} />}
      </Link>
    );
  };

  // The strip: the name bubble hangs beside the rail.
  const railRef = useRef<HTMLElement>(null);

  return (
    <nav className={`${styles.sidebar} ${strip.stripLayer}`} ref={railRef}>
      {/* ⚠ THE SIDEBAR HEADER IS DELETED (owner-approved mockup 2026-08-17, logged in
          memory/design_decisions.md): "Coaches Portal" and the NotificationBell moved up into
          CoachTopStrip, and the org name is gone from the rail entirely — the masthead eyebrow
          already names the club on every team page, so the rail printed it twice within two
          inches. The rail owns navigation; the strip owns identity. */}

      {/* ⚖ The team heads the sidebar, pinned outside the scrolling list (navigation Phase 4). */}
      <CoachTeamCell orgSlug={orgSlug} currentTeamId={currentTeamId} />

      <div className={styles.sidebarScroll}>
      {/* Team-scoped nav — ONE menu, one order, in every season state. A team with no live season has ONE door. ⚠ A group
          renders only when the coach can see something in it, so an assistant's sidebar is shorter — but every item they
          DO have is always in the same place: position is a function of the coach's grants, never of what the team has got
          round to doing yet. The landing slot (Overview, or Season's End) has no heading. */}
      {groups.length > 0 && (
        <div className={styles.sidebarSection}>
          {groups.map((group, gi) => (
            <Fragment key={gi}>
              {group.label && (
                <>
                  <div className={strip.stripRule} aria-hidden />
                  <div className={styles.sidebarGroupHeader}>{group.label}</div>
                </>
              )}
              {group.items.map(renderNavItem)}
            </Fragment>
          ))}
        </div>
      )}
      {/* ⚖ ONE SIDEBAR FOOT (N4, rewritten by navigation Phase 1, E4 + E16, owner 2026-11-09), the admin's order: Plan &
          billing (the standalone owner), a hairline, the doors to the other portals this person holds (Club · Tournaments
          you run), then Collapse sidebar last. Help is the desktop account menu's (under What's new) — except in the demo
          sandbox, which hides the account menu, so its sidebar keeps Help where Plan & billing would be. */}
      <div className={styles.sidebarSpacer} />
      <div className={styles.sidebarDivider} />
      <div className={styles.sidebarSection}>
        {inSandbox && (
          <Link href={`${base}/help`} className={`${styles.sidebarItem} ${styles.sidebarFootItem}`} target="_blank" rel="noopener noreferrer">
            <HelpCircle size={14} />
            <span className={strip.rowLabel}>Help</span>
          </Link>
        )}
        {billingHref && (
          <Link href={billingHref} id="coaches-billing" className={`${styles.sidebarItem} ${styles.sidebarFootItem}${pathname === billingHref ? ` ${styles.sidebarItemActive}` : ''}`}>
            <CreditCard size={14} />
            <span className={strip.rowLabel}>{PLAN_BILLING_TITLE}</span>
          </Link>
        )}
        {(billingHref || inSandbox) && (adminHome || tournamentsHref) && <div className={styles.sidebarFootSep} aria-hidden />}
        {adminHome && (
          // The club's door, named "Club" as the admin's foot names it (was "Admin" — the owner's strip words, 2026-11-09).
          <Link href={adminHome.href} className={`${styles.sidebarItem} ${styles.sidebarFootItem}`}>
            <Shield size={14} />
            <span className={strip.rowLabel}>Club</span>
          </Link>
        )}
        {tournamentsHref && (
          <Link href={tournamentsHref} id="coaches-tournaments" className={`${styles.sidebarItem} ${styles.sidebarFootItem}`}>
            <Trophy size={14} />
            <span className={strip.rowLabel}>Tournaments you run</span>
          </Link>
        )}
        {/* Sign out retired into the top strip's account menu 2026-09-01 (one door per
            destination — `COACH_ACCOUNT_MENU_PLAN.md`). The phone More sheet keeps its own:
            the strip doesn't exist below 900px. */}
      </div>
      {/* ⚖ The last row (Sidebar Strip Ask 2), at the rail's foot as drawn: a rare door ends the body. */}
      <CollapseSidebarRow className={`${styles.sidebarItem} ${styles.sidebarFootItem}`} />
      </div>

      <SidebarStripTip scopeRef={railRef} />
    </nav>
  );
}
