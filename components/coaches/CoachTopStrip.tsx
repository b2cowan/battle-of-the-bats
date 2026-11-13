'use client';

/**
 * CoachTopStrip — the operator frame strip in the PREMIUM coach portal (Nav Unification
 * Stage H.1; D2 ratified 2026-07-31: "the FieldLogicHQ branding applies to the coaches
 * portal just like tournament admin — same product surface, admin hubs"). Reverses the
 * portal's no-wordmark ruling — logged in memory/design_decisions.md the same day.
 *
 * ⚖ THE FREE PORTAL WEARS IT TOO, on a computer (owner ruling 2026-10-13, Free coach header parity —
 * "the account dropdown and notifications bell should be the same for free tier coaches"): ONE
 * component, so the two strips cannot drift. The `free` prop changes only whose bell it is.
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
 * in place (bell drawer · account menu · Workspaces popover); actual exits live INSIDE
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

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import BrandLockup from '@/components/shared/BrandLockup';
import NotificationBell from '@/components/notifications/NotificationBell';
import { TEAM_COACH_BELL, orgBell } from '@/lib/notification-bell-scope';
import WorkspacesPill from '@/components/shared/WorkspacesPill';
import AccountMenu from '@/components/shared/AccountMenu';
import { useRoleSummary } from '@/lib/use-role-summary';
import { useOrg } from '@/lib/org-context';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { useCoachDeskTitle, useCoachRecordSlotRef } from './CoachDeskTitle';
import { CoachStripHelp } from './CoachPageHelpSlot';
import own from '@/components/admin/AdminTopStrip.module.css';
import styles from './CoachTopStrip.module.css';

/**
 * ⚖ THE PAGE, OVER THE PAGE (navigation Phase 4, E6, C4; drawings tab 17): the page's name — the sidebar's lit row, the
 * page's `<h1>` on a computer — or, one level down, the way back and the record ("← Roster │ Avery Test", the name arriving from the page's header); then
 * the team's facts at the right end (`CoachStripFacts`, rendered on the server by the `@stripFacts` slot).
 */
function CoachStripPlace({ facts }: { facts: ReactNode }) {
  const { title } = useCoachDeskTitle();
  const recordSlot = useCoachRecordSlotRef();
  const placeRef = useRef<HTMLDivElement>(null);
  useFactsGiveWay(placeRef, title?.kind === 'back');
  return (
    <div ref={placeRef} className={own.place}>
      {title?.kind === 'name' && <h1 className={`${own.name} ${own.pageName}`}>{title.name}</h1>}
      {title?.kind === 'back' && (
        <>
          <Link href={title.href} className={own.back} aria-label={`Back to ${title.label}`}>
            <ArrowLeft size={15} aria-hidden />
            <span>{title.label}</span>
          </Link>
          <span className={own.backRule} aria-hidden />
          {/* ⚖ The record's own name and chips arrive HERE, from the page's header (a portal — see `recordSlot` in
              CoachDeskTitle). Until the page has loaded its record — and on a drill-in that never names itself here — the KIND of
              place stands in ("Player", from the address: `coachDrillBack().here`), exactly as the phone's bar does (`.teamBarHere`;
              navigation Phase 5b, A5 — one rule for every drill-in). Not a heading: the page's portaled title is the `<h1>`. */}
          <div ref={recordSlot} className={styles.recordSlot} />
          <span className={`${own.name} ${styles.recordHere}`}>{title.here}</span>
        </>
      )}
      {facts}
    </div>
  );
}

/**
 * ⚖ ON A RECORD'S PAGE THE TEAM'S FACTS GIVE WAY BEFORE THE NAME (navigation Phase 5b, A6·1, owner 2026-11-12). The strip is one
 * line by design (walk §486 E), and a record's name is typed by a coach — "Maximilien-Alexandre Beauchemin-Tremblay" was cut at
 * ≈1100–1420 wide while the facts kept their room. The team is named in the sidebar's cell, so when the place cannot hold the
 * name (and its chips) beside the facts, the facts go. Measured, not a width rule: while the facts show the name does not shrink
 * (CSS), the facts do — the club's name first (C9) — and only when the place then OVERFLOWS do they go. `data-crowded` hides them
 * (`display: none`, so a game day's "Open the bench" door leaves the Tab order with them rather than sitting clipped and
 * focusable). Re-measured when the place's width changes and when the slot's content does (the name arriving, a saved rename);
 * the attribute is not observed, so measuring cannot loop.
 */
function useFactsGiveWay(placeRef: RefObject<HTMLDivElement | null>, on: boolean) {
  useLayoutEffect(() => {
    const place = placeRef.current;
    if (!on || !place) return;
    const fit = () => {
      place.removeAttribute('data-crowded');
      if (place.scrollWidth > place.clientWidth + 1) place.setAttribute('data-crowded', '');
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(place);
    const mo = new MutationObserver(fit);
    mo.observe(place, { childList: true, subtree: true, characterData: true });
    return () => { ro.disconnect(); mo.disconnect(); place.removeAttribute('data-crowded'); };
  }, [placeRef, on]);
}

/** The paid portal's off-team pages that publish a help topic (navigation Phase 6b, T6·1): their strip holds the "?"'s width.
 *  `admin-page-help.test.ts` keeps this list equal to the pages that publish one. They draw their header only once their data
 *  has loaded (Join a club shows "Loading…" first), so the width is held until the topic lands, up to a few seconds. */
const OFF_TEAM_HELP_PAGES = /\/coaches\/(notifications|billing|link-org)\/?$/;
const OFF_TEAM_HOLD_MS = 4000;

export default function CoachTopStrip({ wall = false, free = false, facts = null }: {
  /** True on the portal's WALLS (billing-suspended, not-assigned): a wall keeps only the
   *  identity + exit doors it always had. Portal FUNCTION stays off — the bell (a working
   *  notification feed on the hard-block billing wall would undercut the wall's whole job;
   *  review 2026-08-17 — the notifications API is not billing-gated) and the account menu's
   *  Send feedback row. The menu's identity + exits (account, sign out) remain. */
  wall?: boolean;
  /** The FREE coaches portal wears this same strip on a computer (owner ruling 2026-10-13, "Free coach
   *  header parity": the same bell and account menu in the same corner, never a lookalike). It has no
   *  club, so its bell is the coach's own — their team's notices from every host club
   *  (`TEAM_COACH_BELL`) — and its settings door opens Account → Notifications, where the Pause switch
   *  governs that bell. Everything else is the paid strip unchanged. */
  free?: boolean;
  /** The team's facts for the right end (the coaches layout's `@stripFacts` slot, through `CoachesChrome`). */
  facts?: ReactNode;
}) {
  // The premium portal only renders signed-in, so this may run unconditionally.
  const roleSummary = useRoleSummary(true);
  const { currentOrg } = useOrg();
  /** "See it live" demo: hidden rather than disabled — the binding sandbox rule is hide the
   *  entry point, never let it dead-end. False for every real org. */
  const inSandbox = useIsSandbox();
  // The bell's settings door carries the way home, exactly as the AccountMenu's row does —
  // AccountReturnBar reads `?back=` and pins "← Back to your Coaches Portal" over /account. Until
  // 2026-09-03 this was the one strip door that ejected a coach with no way back (coach-notifications
  // review A3/D2): the mechanism existed three rows away and this link simply never used it.
  const pathname = usePathname() ?? '';
  const offTeamHelp = OFF_TEAM_HELP_PAGES.test(pathname);
  const back = encodeURIComponent(pathname);
  // ⚖ SPLIT ON THE SIDEBAR'S EDGE ON A TEAM'S PAGES ONLY (navigation Phase 4, E6/E7/E9): over the 240 sidebar the wordmark and
  // "Coach" (the short word for the sidebar-width cell; "Coaches Portal" stays on every other surface), over the page its
  // name and the team's facts. Never on a wall, never the free portal (E13 — its strip stays exactly as it was), and not
  // off a team's pages (the hub, notifications, Plan & billing keep today's strip).
  const { teamId } = useCoachDeskTitle();
  const split = !wall && !free && !!teamId;

  const doors = (
      <div className={styles.doors}>
        {!wall && free && (
          <NotificationBell
            bell={TEAM_COACH_BELL}
            portal="coach"
            settingsHref={`/account/notifications?back=${back}`}
          />
        )}
        {!wall && !free && currentOrg?.slug && currentOrg.id && (
          <NotificationBell
            bell={orgBell(currentOrg.id)!}
            portal="coach"
            settingsHref={`/account/notifications?focus=coach-${currentOrg.slug}&back=${back}`}
          />
        )}
        {/* ⚖ THE PAGE'S "?" (owner 2026-11-12, navigation Phase 4b — reverses the 2026-07-31 boundary on purpose): beside the bell, in
            the strip's own door size, drawn only once a page has published a help topic — a team's pages and, since Phase 6b (T6·1,
            owner 2026-11-13), the off-team pages too (notifications, Plan & billing, Join a club). Not on a wall or the free portal
            (no host). The width is held where a topic is coming — a team's pages (`split`) and those three, known from the address —
            so the bell does not slide when the page's help lands after the first paint. */}
        {!wall && !free && <CoachStripHelp reserve={split || offTeamHelp} holdMs={offTeamHelp ? OFF_TEAM_HOLD_MS : undefined} />}
        {!inSandbox && (
          <AccountMenu
            warm
            showWhatsNew
            showTheme
            showFeedback={!wall}
            // ⚖ Help, under What's new (E16, owner 2026-11-09) — the Premium portal's sidebar gave it up. Not on a wall (no
            // sidebar had it there) nor the free portal (out of this project, E13: its own sidebar keeps Help).
            helpHref={!wall && !free && currentOrg?.slug ? `/${currentOrg.slug}/coaches/help` : undefined}
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
  );

  if (split) {
    return (
      <header className={`${styles.strip} ${styles.stripSplit}`}>
        <div className={own.lcell}>
          <BrandLockup tone="follow" size={15} className={own.lcellBrand} />
          <span className={`${styles.stripDivider} ${own.lcellWord}`} aria-hidden />
          <span className={`${styles.stripLabel} ${own.lcellWord}`}>Coach</span>
        </div>
        <div className={own.rcell}>
          <CoachStripPlace facts={facts} />
          {doors}
        </div>
      </header>
    );
  }

  return (
    <header className={`${styles.strip}${free ? ` ${styles.stripFree}` : ''}`}>
      <BrandLockup tone="follow" size={15} />
      <span className={styles.stripDivider} aria-hidden />
      <span className={styles.stripLabel}>Coaches Portal</span>
      {doors}
    </header>
  );
}
