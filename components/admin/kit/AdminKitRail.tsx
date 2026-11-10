'use client';
/**
 * AdminKitRail — the admin's desktop rail on the coaches portal's kit (Admin Design Continuity
 * slice 1). The admin's only rail since Part B deleted the old console sidebar (2026-09-29).
 *
 * ⚖ PLACES IN THE SIDEBAR, PAGES ON THE PAGE (Club Tier Stage 13i, Asks 1, 2 and 5 = A, Ask 4 = B, owner 2026-11-06;
 * NAV_STANDARD N2, N3, N11). The club body lists PLACES only and never grows — the owner sees the same ten rows on every
 * screen: Overview · Calendar · Schedules, then Programs (Rep teams, House league, Tournaments), "Also on your plan" where
 * the plan carries what the club does not run yet, then Club (Accounting, Families, Public site, Organization). Nothing
 * renders under a row and no row carries a chevron: a place's pages are the tab row on its page (`PlaceFrame`). ONE row is
 * lit, the place you are in at any depth (`litClubPlace`). The groups are `useAdminKitNav`'s `placeGroups`, which the
 * phone's More sheet reads too. ⚰ The team block, the season block (and its `<select>`), the program pages, Public site's lone "Site editor"
 * row, Organization's rows and the bold "open program" style retired with it; so did the reversed half of the 2026-09-30
 * Accounting ruling ("separate jobs are listed in the rail").
 *
 * Inside a TOURNAMENT the sidebar is the EVENT's (navigation Phase 2 Part A, owner rulings E1, E10, E14, T3–T6, 2026-11-10):
 * the event heads it in the cell (its name, its logo or the organization's, else its initials), the whole cell opens the switch
 * list (`EventSwitchMenu`), and Operations / Setup / Admin are labels over rows that never fold. The way back to the club is
 * the foot's "Club" door (navigation Phase 1, E4 — it replaced the "Club overview" row). A tournament-only organization (the
 * Tournament plans have no club hub) sees the tournament section alone.
 * ⚖ PART B (owner 2026-11-10; E3, T1, T2, P2): the event's sidebar lists the EVENT's pages only, "Your notifications" last.
 * The organization's tournament screens (`isTournamentOrgScreen`: the list, Settings & access and its tabs, Plan & billing)
 * wear the ORGANIZATION's sidebar — a club's own (its foot's Tournaments door opens and lights the list), or a tournament-only
 * organization's short one: its cell, then Tournaments and Settings & access (shown only to someone who holds one of its tabs).
 *
 * ⚠ The programs, Organization and their gates come from `lib/admin-kit-nav.ts`, which the phone bar reads too. Every
 * gate is the old rail's gate — read that file's header before adding a row.
 *
 * ⚖ IT FOLDS TO A 64 STRIP OF ICONS, BY CHOICE, PER DEVICE (Sidebar Strip & Grid Width, Stage 2 — the ratified hub's
 * screens 2 and 8; the shared parts and their reasons are `components/shared/SidebarStrip`). "Collapse sidebar" is the
 * last row. The SAME rows render in both states and the stylesheet narrows them under `html[data-sidebar='strip']`, so
 * the server's sidebar is everybody's and nothing snaps on a cold load. In the strip: headings become hairlines; every
 * place is an icon with its name in a bubble on hover and keyboard focus, and in its visually hidden label for a screen
 * reader; counts sit on the icon's corner. ⚖ Every club icon is a straight link to its place (13i Ask 2 = A: the program
 * and Organization menus retired with the pages under the rows). Inside a tournament the cell folds to the event's 40px
 * tile, which opens the same switch list beside it (T3); its name is in the bubble.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, type ElementType } from 'react';
import {
  LayoutGrid, ChevronDown, HelpCircle, Trophy, Settings,
} from 'lucide-react';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import { CollapseSidebarRow, SidebarStripTip } from '@/components/shared/SidebarStrip';
import strip from '@/components/shared/SidebarStrip.module.css';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { isSidebarStrip } from '@/lib/sidebar-strip';
import SidebarLogoTile from '@/components/shared/SidebarLogoTile';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { useChatUnread } from '@/lib/use-chat-unread';
import { isKitLinkActive, isKitLinkActiveAmong, kitCountText, litTournamentRow, placeGroupHeading, SETTINGS_ACCESS_TITLE, type KitLink } from '@/lib/admin-kit-nav';
import { eventSwitchLine, eventTileSource } from '@/lib/admin-event-cell';
import { useAdminKitNav, useTournamentSettingsTabs } from './useAdminKitNav';
import EventSwitchMenu from './EventSwitchMenu';
import { briefPlaceCount } from './club/ClubBriefProvider';
import { PERMIT_WORDS as PW } from '@/lib/permit-words';
import { useFeeAlert } from './useFeeAlert';
import styles from './AdminKitFrame.module.css';

/** The amber waiting count, worn by a rail door (and the foot's Plan & billing, in red when a fee invoice is overdue). */
function WaitingCount({ count, label, className = '', tone = 'amber' }: { count: number; label: string; className?: string; tone?: 'amber' | 'red' }) {
  if (count <= 0) return null;
  return <span className={`${styles.count}${tone === 'red' ? ` ${styles.countRed}` : ''}${className ? ` ${className}` : ''}`} aria-label={label}>{kitCountText(count)}</span>;
}

/** One rail door — the coach rail's row, with the admin's worklist count and chat badge. `stripIcon` is an
 *  icon only the strip draws (a row the full sidebar lists by name alone). */
function RailRow({ href, label, active, icon: Icon, stripIcon: StripIcon, count = 0, countLabel, chatUnread }: {
  href: string; label: string; active: boolean; icon?: ElementType; stripIcon?: ElementType;
  count?: number; countLabel?: string; chatUnread?: number;
}) {
  return (
    <Link
      href={href}
      className={`${styles.item}${active ? ` ${styles.itemActive}` : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      {Icon && <Icon size={14} aria-hidden />}
      {StripIcon && <StripIcon size={14} aria-hidden className={strip.whenStrip} />}
      <span className={strip.rowLabel}>{label}</span>
      <WaitingCount count={count} label={countLabel ?? `${count} need attention`} className={strip.cornerCount} />
      {chatUnread !== undefined && <ChatUnreadBadge count={chatUnread} className={strip.cornerCount} />}
    </Link>
  );
}

/** A cell's name and its whole-name `title`, set only while the two-line clamp cuts it and never in the folded strip (B3 —
 *  the strip's bubble already shows it). Measured on mount and whenever the name's box changes size — a window resize, and the
 *  strip folding (the label then collapses to a 1px clip, which resizes it). */
function CellName({ name }: { name: string }) {
  const nameRef = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const measure = () => setCut(!isSidebarStrip() && el.scrollHeight > el.clientHeight + 1);
    // `observe` reports the first size at once, so no separate first read.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [name]);
  return <span ref={nameRef} className={`${strip.rowLabel} ${styles.clubName}`} title={cut ? name : undefined}>{name}</span>;
}

/** The club cell: the one logo tile and the name on up to two lines, a link to Overview. */
function ClubCell({ href, name, logoUrl, logoAspect }: { href: string; name: string; logoUrl?: string; logoAspect?: number }) {
  return (
    <Link href={href} className={styles.clubCell}>
      <SidebarLogoTile source={logoUrl} aspect={logoAspect} name={name} />
      <CellName name={name} />
    </Link>
  );
}

/**
 * ⚖ THE EVENT HEADS ITS SIDEBAR (navigation Phase 2 Part A; E1, E10, owner 2026-11-09, and the gate's T3–T6, 2026-11-10). The
 * club cell's frame, height and name, with the event's tile (its own logo, else the organization's, else its initials — a
 * badly shaped event logo shows the EVENT's initials, T5) and a chevron. The name alone: the dates and the phase are the
 * strip's (E2). ⚖ THE WHOLE CELL OPENS THE SWITCH LIST (§6; T6): one target, never a name opening one thing beside a chevron
 * opening another. The chevron shows whenever there is an event — the list always carries "All tournaments", and every
 * person who can open an event can open that list (a person scoped to some events sees only theirs there). Folded, the cell
 * is the 40px tile and its name is the bubble's ("Fall Classic 2026 · switch tournament"); no game-day dot (T4).
 * Keyboard: Enter, Space or the down arrow opens; the list owns the keys from there (`EventSwitchMenu`).
 */
function EventCell({ base }: { base: string }) {
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const pathname = usePathname();
  const cellRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // The list closes when the page changes (the shell survives client navigation — "All tournaments", a sidebar row).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }
  if (!currentTournament) return null;
  const name = currentTournament.name;
  const { source, aspect } = eventTileSource(currentTournament, currentOrg);
  // Built only while the list is open: the cell re-renders on every page change, and the list is shut nearly always.
  const rows = open
    ? tournaments.map(t => ({ id: t.id, name: t.name, line: eventSwitchLine(t), current: t.id === currentTournament.id }))
    : [];
  return (
    <>
      <button
        ref={cellRef}
        type="button"
        className={`${styles.clubCell} ${styles.eventCell}${open ? ` ${styles.eventCellOpen}` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} · switch tournament`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
      >
        <SidebarLogoTile source={source} aspect={aspect} name={name} />
        <CellName name={name} />
        <ChevronDown size={16} aria-hidden className={`${styles.eventChevron} ${strip.fullOnly}`} />
      </button>
      <EventSwitchMenu
        open={open}
        anchorRef={cellRef}
        rows={rows}
        allHref={`${base}/tournaments/manage`}
        onPick={id => { const t = tournaments.find(x => x.id === id); if (t) setCurrentTournament(t); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export default function AdminKitRail() {
  const pathname = usePathname();
  const nav = useAdminKitNav();
  const {
    base, brief, orgLinks, placeGroups, litPlace, tournamentOnly, isCanceled,
    // The computer's foot (Part B, T1) — named `portalDoors` here, as the phone's list is in the More sheet (PHASE-3: one list).
    inEvent, deskPortalDoors: portalDoors, calendarLink, permitsLink, permitsCount, schedulesLink, billingLink, helpHref, isSandbox,
  } = nav;
  const feeAlert = useFeeAlert();
  const currentOrg = useOrg().currentOrg;
  const clubName = currentOrg?.name ?? null;
  // ⚖ On one of the event's own pages with an event to show, the event heads the sidebar (Phase 2); everywhere else — the
  // organization's tournament screens included (Part B, E3 + T1) — the club or the organization does.
  const { currentTournament } = useTournament();
  const eventHeads = inEvent && !!currentTournament;
  // A Tournament-plan organization's Settings & access (E3): its row shows only for someone who holds one of its tabs, opens
  // the first of them straight away (no stop at the door), and lights on every one.
  const settingsTabs = useTournamentSettingsTabs();
  const settingsAccess: KitLink | null = settingsTabs?.length
    ? { key: 'tsettings', label: SETTINGS_ACCESS_TITLE, href: settingsTabs[0].href, also: [`${base}/tournaments/settings`], icon: Settings }
    : null;
  const tournamentsList: KitLink = { key: 'manage', label: 'Tournaments', href: `${base}/tournaments/manage`, also: [`${base}/tournaments/archives`] };
  // The rail the strip's name bubble hangs beside.
  const railRef = useRef<HTMLElement>(null);
  // ⚖ Leaving an event for the organization's screens (the list's "All tournaments", Part B) swaps the event's cell for the
  // organization's. A keyboard user's focus was on the cell that left: it moves to the cell that came, never to the page body.
  const wasEvent = useRef(eventHeads);
  useEffect(() => {
    const lost = !document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected;
    if (wasEvent.current && !eventHeads && lost) (railRef.current?.firstElementChild as HTMLElement | null)?.focus();
    wasEvent.current = eventHeads;
  }, [eventHeads]);

  // ⚖ N9 (13i B3): a place's row carries the sum of its tabs' waiting counts (`briefPlaceCount`), at every depth.
  const placeRow = (place: KitLink) => {
    const count = briefPlaceCount(brief, place.key);
    return (
      <RailRow
        key={place.key}
        href={place.href}
        label={place.label}
        icon={place.icon}
        active={litPlace === place.key}
        count={count}
        countLabel={`${count} waiting`}
      />
    );
  };

  return (
    <>
    <aside className={`${styles.rail} ${strip.stripLayer}`} ref={railRef}>
      {/* ⚖ THE CLUB HEADS THE SIDEBAR (Admin header bar round 4, option B, owner 2026-11-08, D1 and D5). The club's name,
          a link to Overview (switching clubs stays in the strip's Workspaces pill). Its height is the desktop tab band's
          (`--admin-band-h`, one variable both read), so its bottom rule and the band's are one line; it keeps that height
          on a screen with no tabs, so the navigation below never moves. Collapsed: the club's initials, its name in the
          bubble. A tournament-only organization's cell names the organization; inside a club's tournament, the club.
          ⚖ Phase 1 Part B (owner 2026-11-09): the name on up to two lines and the ONE logo tile (the logo, or the initials when
          there is none, it is wider than 2 : 1 or taller than 1 : 2, or it will not load — decided from the logo's stored shape,
          on the server's first paint).
          ⚖ Inside a tournament the EVENT heads it (Phase 2, `EventCell`), from the event the server seeded (Phase 0), so the
          first paint is the last. With no event yet, the club or organization's cell as before. */}
      {eventHeads
        ? <EventCell base={base} />
        : clubName && <ClubCell href={base} name={clubName} logoUrl={currentOrg?.logoUrl} logoAspect={currentOrg?.logoAspect} />}
      <nav className={styles.railScroll} aria-label="Admin navigation">
        {!tournamentOnly && !isCanceled && !inEvent && (
          // ⚖ Not inside a tournament (E4, navigation Phase 1): "Club overview" became the foot's "Club" door — a row that
          // swaps the whole sidebar is a portal door, and the portal doors live in the foot.
          <RailRow href={base} label="Overview" active={pathname === base} icon={LayoutGrid} />
        )}
        {/* The club calendar (Club Tier 6b, Ask 7): directly under Overview — it spans every program, so it is no
            program's row. `kitCalendarLink` holds its gate. ⚖ Not inside a tournament (owner 2026-10-20): there Overview
            is the one way back to the club, as Programs and Organization already are not rows, and the phone's tournament
            bar never carried either. Schedules, below, follows the same rule. */}
        {calendarLink && !tournamentOnly && !inEvent && (
          <RailRow href={calendarLink.href} label={calendarLink.label} active={isKitLinkActive(pathname, calendarLink)} icon={calendarLink.icon} />
        )}
        {/* The club's permits (Club Tier 13c, C1 = A): between Calendar and Schedules — the time the club holds, then where
            it hands it out. A place, unheaded like its neighbours (N2). `kitPermitsLink` holds its gate. */}
        {permitsLink && !tournamentOnly && !inEvent && (
          <RailRow href={permitsLink.href} label={permitsLink.label} active={isKitLinkActive(pathname, permitsLink)} icon={permitsLink.icon}
            count={permitsCount} countLabel={PW.outsideCountLabel(permitsCount)} />
        )}
        {/* The club scheduler (Club Tier 11a): directly under Calendar — Calendar reads what is booked, Schedules hands the
            club's time out. `kitSchedulesLink` holds its gate (owner or admin, the plan's key, rep teams to hand time to). */}
        {schedulesLink && !tournamentOnly && !inEvent && (
          <RailRow href={schedulesLink.href} label={schedulesLink.label} active={isKitLinkActive(pathname, schedulesLink)} icon={schedulesLink.icon} />
        )}

        {inEvent ? (
          <TournamentRail />
        ) : (
          <>
            {/* ⚖ The club's places, in their groups (13i Ask 5 = A). Every group with a row wears its heading, over one row
                or many; a group with no rows draws nothing (owner, 2026-11-09). */}
            {placeGroups.map(group => {
              const heading = placeGroupHeading(group);
              return (
                <Fragment key={group.key}>
                  {heading && <div className={styles.label}>{heading}</div>}
                  {group.places.map(placeRow)}
                </Fragment>
              );
            })}
            {tournamentOnly && !isCanceled && (
              // ⚖ A TOURNAMENT-ONLY ORGANIZATION'S OWN SIDEBAR (E3, navigation Phase 2 Part B): the one Tournaments list (D7 —
              // `/tournaments` alone opens the selected event's board), then Settings & access, the place whose tabs are
              // Members · Payouts · PDF settings · Web address (P1). No labels: two rows are no groups.
              <>
                <RailRow href={tournamentsList.href} label={tournamentsList.label} active={isKitLinkActive(pathname, tournamentsList)} icon={Trophy} />
                {settingsAccess && (
                  // Plan & billing's page sits under Settings & access's address: its foot row is the lit one there.
                  <RailRow href={settingsAccess.href} label={settingsAccess.label} icon={settingsAccess.icon}
                    active={isKitLinkActive(pathname, settingsAccess) && !(billingLink && isKitLinkActive(pathname, billingLink))} />
                )}
              </>
            )}
            {tournamentOnly && orgLinks.length > 0 && (
              // The tournament-only organization's flat Account list (unchanged by 13i; a cancelled club has no Organization
              // links): listed by name in the full sidebar; the strip draws the icon the phone's More menu gives each (an
              // icon-less row would be an empty square).
              <>
                <div className={styles.label}>Account</div>
                {orgLinks.map(link => (
                  <RailRow key={link.key} href={link.href} label={link.label} active={isKitLinkActiveAmong(pathname, link, orgLinks)} stripIcon={link.icon} />
                ))}
              </>
            )}
          </>
        )}


      {/* ⚖ ONE SIDEBAR FOOT (N4, rewritten by navigation Phase 1, E4 + E16, owner 2026-11-09), the LAST ROWS OF THE ONE
          SCROLLING LIST (owner 2026-11-09: the whole nav scrolls, the foot is not pinned — a spacer rests it at the bottom
          when the screen is tall): Plan & billing (the owner, with its bill pill), a hairline, the doors to the other portals this person holds
          (Club inside a tournament · Tournaments in the club once it hosts one · Coaches Portal), then Collapse sidebar.
          Help is the desktop account menu's (beside What's new) — except in the demo sandbox, which hides the account menu,
          so its sidebar keeps Help where Plan & billing would be (a sandbox has no billing door). On Plan & billing's page
          its row is the one lit row (`litClubPlace`). Send feedback and Sign out live in the account menu only (2026-09-01).
          No live-site door (Ask 9, Stage 13a): the header's "View site" pill is on every screen. */}
      <div className={styles.spacer} />
      <div className={styles.railFoot}>
        <div className={styles.foot}>
          {billingLink && <Link href={billingLink.href} className={`${styles.item} ${styles.footItem}${isKitLinkActive(pathname, billingLink) ? ` ${styles.itemActive}` : ''}`} aria-current={isKitLinkActive(pathname, billingLink) ? 'page' : undefined}>
            {billingLink.icon && <billingLink.icon size={14} aria-hidden />} <span className={strip.rowLabel}>{billingLink.label}</span>
            {/* Fee invoice alerts, Part 2: an invoice to pay (amber), an overdue one (red) or a failed plan payment (amber). */}
            {feeAlert && <WaitingCount count={feeAlert.count} label={feeAlert.label} tone={feeAlert.tone} className={strip.cornerCount} />}
          </Link>}
          {isSandbox && (
            <Link href={helpHref} className={`${styles.item} ${styles.footItem}`} target="_blank" rel="noopener noreferrer">
              <HelpCircle size={14} aria-hidden /> <span className={strip.rowLabel}>Help</span>
            </Link>
          )}
          {(billingLink || isSandbox) && portalDoors.length > 0 && <div className={styles.footSep} aria-hidden />}
          {portalDoors.map(door => {
            // ⚖ T1: on a club's Tournaments list its foot door is the lit row (as Plan & billing lights on its own page).
            const lit = door.key === 'tournaments' && isKitLinkActive(pathname, door);
            return (
              <Link key={door.key} href={door.href} className={`${styles.item} ${styles.footItem}${lit ? ` ${styles.itemActive}` : ''}`} aria-current={lit ? 'page' : undefined}>
                {door.icon && <door.icon size={14} aria-hidden />} <span className={strip.rowLabel}>{door.label}</span>
              </Link>
            );
          })}
        </div>
        {/* ⚖ The last row (Ask 2). */}
        <CollapseSidebarRow className={`${styles.item} ${styles.footItem}`} />
      </div>
      </nav>
      <SidebarStripTip scopeRef={railRef} />
    </aside>
    </>
  );
}

/**
 * The event's sidebar: Operations / Setup / Admin, each a LABEL over its rows. ⚖ NOTHING FOLDS (E14, owner 2026-11-09): the
 * headings were buttons that hid their rows (a stored choice, `fl_nav_groups`, and a phase's defaults); they are now the club's
 * own `.label`, and the list scrolls between the pinned cell and the foot. A chevron in a sidebar now only ever means "switch"
 * (the event's cell, N3). In the strip a label is a hairline, as the club's is. The switcher is the cell's (`EventCell`).
 */
function TournamentRail() {
  const pathname = usePathname();
  const worklist = useAdminWorklist();
  // The event's own pages (Part B): Settings & access and the list are the organization's; "Your notifications" is last (T2).
  const { base, deskTournamentGroups: groups, billingLink } = useAdminKitNav();
  // Asked only where Chat is a row (an invite-only event has no Chat, the free tournament tier, R5).
  const chatUnread = useChatUnread(groups.some(g => g.items.some(i => i.key === 'chat')));

  // ONE lit row, the one the strip names (`litTournamentRow`).
  const lit = litTournamentRow(pathname, base, groups.flatMap(g => g.items.map(i => i.key)), billingLink);
  const itemActive = (key: string) => key === lit;

  return (
    <>
      {groups.map(g => (
        <Fragment key={g.key}>
          <div className={styles.label}>{g.label}</div>
          {g.items.map(i => (
            <RailRow
              key={i.key}
              href={i.href}
              label={i.label}
              active={itemActive(i.key)}
              icon={i.icon}
              count={worklist[i.key] ?? 0}
              chatUnread={i.key === 'chat' ? chatUnread : undefined}
            />
          ))}
        </Fragment>
      ))}
    </>
  );
}

/* ⚰ CreateTournamentWizard — the rail's own copy of the setup wizard — was here until Stage 4 (2026-10-06):
   the frame mounts ONE wizard now (components/admin/tournament/SetupWizardOpener.tsx), outside the rail for
   the reason this copy gave (the rail's `position: sticky` would trap a modal under the page). */
