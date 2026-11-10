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
 * Inside a TOURNAMENT the middle swaps for the old rail's tournament section (switcher, Operations / Setup / Admin),
 * restyled only and unchanged by 13i (Ask 8). The way back to the club is the foot's "Club" door (navigation Phase 1, E4 —
 * it replaced the "Club overview" row). A tournament-only organization (the Tournament plans have no club hub) sees the
 * tournament section alone.
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
 * and Organization menus retired with the pages under the rows). The tournament picker is an initials tile with its own
 * menu; a tournament group folded shut in the full sidebar still shows its icons (the strip has no heading to open).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, type ElementType } from 'react';
import {
  LayoutGrid, ChevronRight, HelpCircle, Trophy,
} from 'lucide-react';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import {
  CollapseSidebarRow, SidebarStripMenu, SidebarStripTile, SidebarStripTip, StripMenuButton, useStripMenu,
} from '@/components/shared/SidebarStrip';
import strip from '@/components/shared/SidebarStrip.module.css';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { isSidebarStrip } from '@/lib/sidebar-strip';
import SidebarLogoTile from '@/components/shared/SidebarLogoTile';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { useChatUnread } from '@/lib/use-chat-unread';
import { TOUR_GROUPS } from '@/components/admin/admin-nav-config';
import { isKitLinkActive, isKitLinkActiveAmong, kitCountText, placeGroupHeading, type KitLink } from '@/lib/admin-kit-nav';
import { useAdminKitNav } from './useAdminKitNav';
import { STATUS_WORD } from '@/lib/tournament-status-words';
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

/** The club cell: the one logo tile and the name on up to two lines. Its whole name is the native `title`, set only while
 *  the name is cut and never in the folded strip (B3 — the strip's bubble already shows it). */
function ClubCell({ href, name, logoUrl, logoAspect }: { href: string; name: string; logoUrl?: string; logoAspect?: number }) {
  const nameRef = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  // Cut = the clamp is hiding lines, and the sidebar is not folded. Measured on mount and whenever the name's box changes
  // size — a window resize, and the strip folding (the label then collapses to a 1px clip, which resizes it).
  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const measure = () => setCut(!isSidebarStrip() && el.scrollHeight > el.clientHeight + 1);
    // `observe` reports the first size at once, so no separate first read.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [name]);
  return (
    <Link href={href} className={styles.clubCell}>
      <SidebarLogoTile source={logoUrl} aspect={logoAspect} name={name} />
      <span ref={nameRef} className={`${strip.rowLabel} ${styles.clubName}`} title={cut ? name : undefined}>{name}</span>
    </Link>
  );
}

export default function AdminKitRail() {
  const pathname = usePathname();
  const nav = useAdminKitNav();
  const {
    base, brief, orgLinks, placeGroups, litPlace, tournamentOnly, isCanceled,
    onTournaments, portalDoors, calendarLink, permitsLink, permitsCount, schedulesLink, billingLink, helpHref, isSandbox,
  } = nav;
  const feeAlert = useFeeAlert();
  const currentOrg = useOrg().currentOrg;
  const clubName = currentOrg?.name ?? null;
  // The rail the strip's name bubble hangs beside.
  const railRef = useRef<HTMLElement>(null);

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
          on the server's first paint). */}
      {clubName && <ClubCell href={base} name={clubName} logoUrl={currentOrg?.logoUrl} logoAspect={currentOrg?.logoAspect} />}
      <nav className={styles.railScroll} aria-label="Admin navigation">
        {!tournamentOnly && !isCanceled && !onTournaments && (
          // ⚖ Not inside a tournament (E4, navigation Phase 1): "Club overview" became the foot's "Club" door — a row that
          // swaps the whole sidebar is a portal door, and the portal doors live in the foot.
          <RailRow href={base} label="Overview" active={pathname === base} icon={LayoutGrid} />
        )}
        {/* The club calendar (Club Tier 6b, Ask 7): directly under Overview — it spans every program, so it is no
            program's row. `kitCalendarLink` holds its gate. ⚖ Not inside a tournament (owner 2026-10-20): there Overview
            is the one way back to the club, as Programs and Organization already are not rows, and the phone's tournament
            bar never carried either. Schedules, below, follows the same rule. */}
        {calendarLink && !tournamentOnly && !onTournaments && (
          <RailRow href={calendarLink.href} label={calendarLink.label} active={isKitLinkActive(pathname, calendarLink)} icon={calendarLink.icon} />
        )}
        {/* The club's permits (Club Tier 13c, C1 = A): between Calendar and Schedules — the time the club holds, then where
            it hands it out. A place, unheaded like its neighbours (N2). `kitPermitsLink` holds its gate. */}
        {permitsLink && !tournamentOnly && !onTournaments && (
          <RailRow href={permitsLink.href} label={permitsLink.label} active={isKitLinkActive(pathname, permitsLink)} icon={permitsLink.icon}
            count={permitsCount} countLabel={PW.outsideCountLabel(permitsCount)} />
        )}
        {/* The club scheduler (Club Tier 11a): directly under Calendar — Calendar reads what is booked, Schedules hands the
            club's time out. `kitSchedulesLink` holds its gate (owner or admin, the plan's key, rep teams to hand time to). */}
        {schedulesLink && !tournamentOnly && !onTournaments && (
          <RailRow href={schedulesLink.href} label={schedulesLink.label} active={isKitLinkActive(pathname, schedulesLink)} icon={schedulesLink.icon} />
        )}

        {onTournaments ? (
          <TournamentRail labelled={!tournamentOnly} />
        ) : (
          <>
            {/* ⚖ The club's places, in their groups (13i Ask 5 = A). A heading is drawn over two or more rows; over a lone
                row its space stays with no word (N2) — so a registrar's House league and Organization still sit apart. */}
            {placeGroups.map(group => {
              const heading = placeGroupHeading(group);
              return (
                <Fragment key={group.key}>
                  <div className={styles.label} aria-hidden={heading ? undefined : true}>{heading ?? '\u00a0'}</div>
                  {group.places.map(placeRow)}
                </Fragment>
              );
            })}
            {tournamentOnly && !isCanceled && (
              // The one Tournaments list (D7) — `/tournaments` alone opens the selected event's board.
              <RailRow href={`${base}/tournaments/manage`} label="Tournaments" active={false} icon={Trophy} />
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

      </nav>

      {/* ⚖ ONE SIDEBAR FOOT (N4, rewritten by navigation Phase 1, E4 + E16, owner 2026-11-09), PINNED under the scrolling
          rows: Plan & billing (the owner, with its bill pill), a hairline, the doors to the other portals this person holds
          (Club inside a tournament · Tournaments in the club once it hosts one · Coaches Portal), then Collapse sidebar.
          Help is the desktop account menu's (beside What's new) — except in the demo sandbox, which hides the account menu,
          so its sidebar keeps Help where Plan & billing would be (a sandbox has no billing door). On Plan & billing's page
          its row is the one lit row (`litClubPlace`). Send feedback and Sign out live in the account menu only (2026-09-01).
          No live-site door (Ask 9, Stage 13a): the header's "View site" pill is on every screen. */}
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
          {portalDoors.map(door => (
            <Link key={door.key} href={door.href} className={`${styles.item} ${styles.footItem}`}>
              {door.icon && <door.icon size={14} aria-hidden />} <span className={strip.rowLabel}>{door.label}</span>
            </Link>
          ))}
        </div>
        {/* ⚖ The last row (Ask 2). */}
        <CollapseSidebarRow className={`${styles.item} ${styles.footItem}`} />
      </div>
      <SidebarStripTip scopeRef={railRef} />
    </aside>
    </>
  );
}

/** The tournament groups a status opens by default (the old rail's rule; a stored choice replaces it). */
function defaultGroups(status: string): Set<string> {
  return new Set(TOUR_GROUPS.filter(g => g.defaultOpenFor.includes(status)).map(g => g.key));
}

/** Today's tournament rail, restyled: switcher, Operations / Setup / Admin. */
function TournamentRail({ labelled }: { labelled: boolean }) {
  const pathname = usePathname();
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const worklist = useAdminWorklist();
  const { base, tournamentGroups: groups, billingLink } = useAdminKitNav();
  // Asked only where Chat is a row (an invite-only event has no Chat, the free tournament tier, R5).
  const chatUnread = useChatUnread(groups.some(g => g.items.some(i => i.key === 'chat')));
  // Seeded with defaults rather than an empty set, as the coach rail seeds its own (CoachesSidebar): the empty set drew
  // every group closed for a frame on each load. The tournament arrives after the first render (a client fetch), so the
  // seed is draft's set until then; a stored set, or an event past draft, still settles a frame later.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => defaultGroups(currentTournament?.status ?? 'draft'));
  const [groupsReady, setGroupsReady] = useState(false);
  // The strip's tile opens the tournament list (its own menu: the club's programs never show beside it).
  const { openKey, anchorRef, toggle, close } = useStripMenu(pathname);

  // The same stored preference, key and defaults as today's rail: a restyle must not reset an
  // organizer's open groups.
  useEffect(() => {
    if (groupsReady) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem('fl_nav_groups') ?? 'null');
        if (Array.isArray(parsed) && parsed.every(v => typeof v === 'string')) {
          setOpenGroups(new Set(parsed as string[]));
          setGroupsReady(true);
          return;
        }
      } catch { /* fall through to the defaults */ }
      setOpenGroups(defaultGroups(currentTournament?.status ?? 'draft'));
      setGroupsReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [groupsReady, currentTournament?.status]);

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('fl_nav_groups', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  const allKeys = groups.flatMap(g => g.items.map(i => i.key));
  // Plan & billing (the footer link) sits under Settings & access's address: it is the more specific door, so Settings
  // steps aside while it is the page on screen.
  const itemActive = (key: string) => pathname.startsWith(`${base}/tournaments/${key}`)
    && !allKeys.some(k => k !== key && k.length > key.length && pathname.startsWith(`${base}/tournaments/${k}`))
    && isKitLinkActiveAmong(pathname, { key, label: key, href: `${base}/tournaments/${key}` }, [billingLink]);

  // ⚰ The switcher's + and the strip's "New tournament" are gone (owner 2026-10-19): a new tournament starts on the
  // Tournaments page's own New tournament, its one door (with its slot line), and the switcher takes the full width.
  const tileName = currentTournament?.name ?? tournaments[0]?.name ?? '';
  // A group's rows. A group folded shut keeps them in the page, out of sight (`foldedGroup`) — the strip shows
  // every icon, because it has no heading to open.
  const rows = (g: (typeof groups)[number]) => g.items.map(i => (
    <RailRow
      key={i.key}
      href={i.href}
      label={i.label}
      active={itemActive(i.key)}
      icon={i.icon}
      count={worklist[i.key] ?? 0}
      chatUnread={i.key === 'chat' ? chatUnread : undefined}
    />
  ));

  return (
    <>
      {labelled && <div className={styles.label}>Tournament</div>}
      {tournaments.length > 0 && (
        <>
          <div className={`${styles.switcher} ${strip.fullOnly}`}>
            {tournaments.length > 1 ? (
              <select
                className={styles.switcherSelect}
                value={currentTournament?.id ?? ''}
                onChange={e => { const t = tournaments.find(x => x.id === e.target.value); if (t) setCurrentTournament(t); }}
                aria-label="Editing tournament"
                id="admin-tournament-select"
              >
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            ) : (
              <span className={styles.switcherName}>{currentTournament?.name}</span>
            )}
          </div>
          {/* The strip's tile (hub screen 8): the event's initials, opening the list. */}
          <SidebarStripTile
            name={tileName}
            label={`${tileName} · switch tournament`}
            open={openKey === 'tournament'}
            onToggle={el => toggle('tournament', el)}
          />
        </>
      )}
      {groups.map(g => {
        const hasActive = g.items.some(i => itemActive(i.key));
        const open = openGroups.has(g.key) || hasActive;
        return (
          <div key={g.key}>
            <button
              type="button"
              className={`${styles.groupHeader}${hasActive ? ` ${styles.groupHeaderActive}` : ''}`}
              onClick={() => toggleGroup(g.key)}
              aria-expanded={open}
            >
              <span className={styles.groupHeaderText}>{g.label}</span>
              <ChevronRight size={12} className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ''}`} aria-hidden />
            </button>
            <div className={strip.stripRule} aria-hidden />
            {open ? rows(g) : <div className={strip.foldedGroup}>{rows(g)}</div>}
          </div>
        );
      })}
      <SidebarStripMenu key={openKey ?? 'closed'} open={openKey === 'tournament'} anchorRef={anchorRef} title="Tournaments" onClose={close}>
        {tournaments.map(t => (
          <StripMenuButton
            key={t.id}
            current={t.id === currentTournament?.id}
            meta={STATUS_WORD[t.status]}
            onSelect={() => setCurrentTournament(t)}
          >
            {t.name}
          </StripMenuButton>
        ))}
      </SidebarStripMenu>
    </>
  );
}

/* ⚰ CreateTournamentWizard — the rail's own copy of the setup wizard — was here until Stage 4 (2026-10-06):
   the frame mounts ONE wizard now (components/admin/tournament/SetupWizardOpener.tsx), outside the rail for
   the reason this copy gave (the rail's `position: sticky` would trap a modal under the page). */
