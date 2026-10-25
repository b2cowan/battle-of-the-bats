'use client';
/**
 * AdminKitRail — the admin's desktop rail on the coaches portal's kit (Admin Design Continuity
 * slice 1). The admin's only rail since Part B deleted the old console sidebar (2026-09-29).
 *
 * ⚠ ONE RAIL, ALWAYS POPULATED (ratified club Stage 1 specimen 3). The old rail was a set of MODES —
 * empty at the hub, a different rail inside each program, "All Sections" to get out. This is one
 * object: Overview pinned, then the programs, then Organization, and the program you are in opens
 * onto its pages. Inside a TOURNAMENT the middle swaps for the old rail's tournament section (switcher,
 * Operations / Setup / Admin), restyled only, with Overview still pinned above it, so there is always
 * a way back to the club. A tournament-only organization (the Tournament plans have no club hub)
 * sees the tournament section alone, as it always has.
 *
 * ⚠ The programs, their pages and the Organization links come from `lib/admin-kit-nav.ts`, which the
 * phone bar reads too. Every gate is the old rail's gate — read that file's header before adding a row.
 *
 * ⚖ IT FOLDS TO A 64 STRIP OF ICONS, BY CHOICE, PER DEVICE (Sidebar Strip & Grid Width, Stage 2 — the
 * ratified hub's screens 2 and 8; the shared parts and their reasons are `components/shared/SidebarStrip`).
 * "Collapse sidebar" is the last row. The SAME rows render in both states and the stylesheet narrows them
 * under `html[data-sidebar='strip']`, so the server's sidebar is everybody's and nothing snaps on a cold
 * load. In the strip: labels become hairlines; every page is an icon with its name in a bubble on hover
 * and keyboard focus, and in its visually hidden label for a screen reader; counts sit on the icon's
 * corner; a program with 2+ pages — or the team or season block you are inside — opens a menu from its
 * icon instead of going to its first page (`opensMenu`); the tournament picker is an initials tile; a
 * tournament group folded shut in the full sidebar still shows its icons (the strip has no heading to open).
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ElementType } from 'react';
import {
  LayoutGrid, ChevronRight, Globe, Users2, HelpCircle, Trophy,
} from 'lucide-react';
import ReleaseDot from '@/components/whats-new/ReleaseDot';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import {
  CollapseSidebarRow, SidebarStripMenu, SidebarStripTile, SidebarStripTip, StripMenuButton, StripMenuGroup,
  StripMenuLink, stripMenuRowProps, useStripMenu, type StripMenuRow,
} from '@/components/shared/SidebarStrip';
import strip from '@/components/shared/SidebarStrip.module.css';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { useChatUnread } from '@/lib/use-chat-unread';
import { useSidebarStrip } from '@/lib/sidebar-strip';
import { TOUR_GROUPS } from '@/components/admin/admin-nav-config';
import { isKitLinkActive, ORGANIZATION_ICON, type KitLink, type KitProgram } from '@/lib/admin-kit-nav';
import { useAdminKitNav } from './useAdminKitNav';
import { STATUS_WORD } from '@/lib/tournament-status-words';
import { useRailTeamName } from './useRailTeam';
import { briefPageCount, briefProgramCount } from './club/ClubBriefProvider';
import { useHouseLeagueAccess, useHouseLeagueSeasons, type FrameSeason } from './useHouseLeagueSeasons';
import { seasonGroup, seasonPageHref, seasonPagesFor, seasonSegment, toReviewLabel } from '@/lib/house-league-season';
import type { HouseLeagueAccess } from '@/lib/house-league-access';
import styles from './AdminKitFrame.module.css';

/** A page as both the rail and the strip's menu list it (a season's Registrations carries its waiting count). */
type PageRow = { href: string; label: string; active: boolean; count?: number; countLabel?: string };

/** The amber waiting count, worn by a rail door and by its row in the strip's menu. */
function WaitingCount({ count, label, className = '' }: { count: number; label: string; className?: string }) {
  if (count <= 0) return null;
  return <span className={`${styles.count}${className ? ` ${className}` : ''}`} aria-label={label}>{count > 9 ? '9+' : count}</span>;
}

/** One rail door — the coach rail's row, with the admin's worklist count and chat badge. `stripIcon` is an
 *  icon only the strip draws (a row the full sidebar lists by name alone). */
function RailRow({ href, label, active, icon: Icon, stripIcon: StripIcon, sub, count = 0, countLabel, chatUnread }: {
  href: string; label: string; active: boolean; icon?: ElementType; stripIcon?: ElementType; sub?: boolean;
  count?: number; countLabel?: string; chatUnread?: number;
}) {
  return (
    <Link
      href={href}
      className={`${styles.item}${sub ? ` ${styles.sub}` : ''}${active ? ` ${styles.itemActive}` : ''}`}
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

/** A program (or Organization) row: the door to its first screen, open while you are inside it. In the
 *  strip, `menu` makes it the button that opens the program's menu. `hasPages` (pages listed under it while
 *  open) decides where its count sits; `opensPages` (more than its own one page) decides its chevron. */
function ProgramRow({ href, label, icon: Icon, open, hasPages, opensPages, count = 0, menu }: {
  href: string; label: string; icon: ElementType; open: boolean; hasPages: boolean; opensPages: boolean; count?: number;
  menu?: StripMenuRow;
}) {
  return (
    <Link
      href={href}
      className={`${styles.item}${open ? ` ${styles.programOpen}` : ''}`}
      {...(menu ? stripMenuRowProps(menu) : {})}
    >
      <Icon size={14} aria-hidden />
      <span className={strip.rowLabel}>{label}</span>
      {/* The morning brief's waiting items for this program (Club Tier Stage 1, specimen 3) — the
          same number the hub's door and the phone tab show. Hidden while open when its pages carry it;
          a program with no pages (Accounting, one page with tabs — Stage 3a Ask 2) keeps it inside too.
          ⚠ In the strip its pages are in the menu, so the icon keeps its count while open
          (`countWhenOpen` shows only there): no count is lost in the strip. */}
      <WaitingCount
        count={count}
        label={`${count} waiting`}
        className={`${strip.cornerCount}${open && hasPages ? ` ${styles.countWhenOpen}` : ''}`}
      />
      {opensPages && <ChevronRight size={13} className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ''}`} aria-hidden />}
    </Link>
  );
}

export default function AdminKitRail() {
  const pathname = usePathname();
  const nav = useAdminKitNav();
  const {
    base, orgSlug, programs, alsoOnPlan, brief, orgLinks, section, tournamentOnly, isCanceled,
    onTournaments, coachDoor, calendarLink, schedulesLink, helpHref, siteInNav,
  } = nav;
  const repTeamId = pathname.match(/\/rep-teams\/teams\/([^/]+)/)?.[1] ?? null;
  const seasonId = pathname.match(/\/house-league\/seasons\/([^/]+)/)?.[1] ?? null;
  const repTeamName = useRailTeamName(repTeamId);
  const seasons = useHouseLeagueSeasons(!!seasonId);
  const thisSeason = seasons.find(s => s.id === seasonId) ?? null;
  const leagueAccess = useHouseLeagueAccess(thisSeason);

  // The strip: the setting as rendered (for a menu row's accessibility attributes only — CSS owns the look),
  // the one open menu, and the rail the name bubble and the menu hang beside.
  const railRef = useRef<HTMLElement>(null);
  const stripNow = useSidebarStrip();
  const { openKey, anchorRef, toggle, close } = useStripMenu(pathname);
  const menuFor = (key: string): StripMenuRow => ({ key, strip: stripNow, openKey, toggle });


  const pageRow = (link: KitLink) => (
    <RailRow
      key={link.key}
      href={link.href}
      label={link.label}
      active={isKitLinkActive(pathname, link)}
      sub
      count={briefPageCount(brief, link.key)}
    />
  );

  const repTeamPath = repTeamId ? `${base}/rep-teams/teams/${repTeamId}` : null;
  const seasonPath = seasonId ? `${base}/house-league/seasons/${seasonId}` : null;

  // ⚖ Ask 3 (ruled): in the strip a program opens a menu when it has two or more pages — or when you are
  // inside its team or season, whose block sits in the menu; a one-page program goes straight to its page.
  const opensMenu = (p: KitProgram) =>
    p.pages.length > 1 || (p.key === 'rep-teams' && !!repTeamId) || (p.key === 'house-league' && !!seasonId);
  // ⚖ N3 (the nav standard, Ask A2, 2026-10-17): the full sidebar's chevron promises pages UNDER the row — more than
  // the one page the row itself opens, or House league, whose seasons' pages open under it. Public site (one page, the
  // site editor) carries none.
  const opensPages = (p: KitProgram) => p.pages.length > 1 || p.key === 'house-league';

  // One program's group: its row, and — while you are inside it — its pages.
  const programGroup = (p: KitProgram) => {
    const open = section === p.key;
    return (
      <div key={p.key}>
        <ProgramRow
          href={p.href}
          label={p.label}
          icon={p.icon}
          open={open}
          hasPages={p.pages.length > 0}
          opensPages={opensPages(p)}
          count={briefProgramCount(brief, p.key)}
          menu={opensMenu(p) ? menuFor(p.key) : undefined}
        />
        {open && p.key === 'house-league' && seasonId && seasonPath ? (
          // 9a·2: inside a season, House league's own rows and the season's block are set in under it, one line beside them.
          <div className={styles.seasonBlock}>
            {p.pages.map(pageRow)}
            <SeasonBlock seasonId={seasonId} seasons={seasons} pages={seasonPages(seasonPath, pathname, leagueAccess, thisSeason)} />
          </div>
        ) : open && p.pages.map(pageRow)}
        {open && p.key === 'rep-teams' && repTeamPath && (
          <RepTeamBlock name={repTeamName} pages={repTeamPages(repTeamPath, pathname)} />
        )}
      </div>
    );
  };

  // The strip's menu for whichever program row (or Organization) is open — the same pages the full rail
  // lists under it, with their counts, and the team or season block you are inside.
  const menuProgram = openKey ? [...programs, ...alsoOnPlan].find(p => p.key === openKey) ?? null : null;
  const pageMenuRow = (link: KitLink) => (
    <StripMenuLink
      key={link.key}
      href={link.href}
      active={isKitLinkActive(pathname, link)}
      trailing={<WaitingCount count={briefPageCount(brief, link.key)} label={`${briefPageCount(brief, link.key)} need attention`} />}
    >
      {link.label}
    </StripMenuLink>
  );
  const programMenu = menuProgram && (
    <>
      {menuProgram.pages.map(pageMenuRow)}
      {menuProgram.key === 'rep-teams' && repTeamPath && (
        <StripMenuGroup label={repTeamName ?? 'Team'}>
          {repTeamPages(repTeamPath, pathname).map(r => (
            <StripMenuLink key={r.href} href={r.href} active={r.active}>{r.label}</StripMenuLink>
          ))}
        </StripMenuGroup>
      )}
      {menuProgram.key === 'house-league' && seasonId && seasonPath && (
        <>
          <StripMenuGroup label="Season">
            {seasonPages(seasonPath, pathname, leagueAccess, thisSeason).map(r => (
              <StripMenuLink
                key={r.href}
                href={r.href}
                active={r.active}
                trailing={r.count ? <WaitingCount count={r.count} label={r.countLabel ?? ''} /> : undefined}
              >
                {r.label}
              </StripMenuLink>
            ))}
          </StripMenuGroup>
          {/* The full rail's season switcher, as rows: each other season opens on the page you are on. */}
          {seasons.length > 1 && (
            <StripMenuGroup label="Other seasons">
              {seasons.filter(s => s.id !== seasonId).map(s => (
                <StripMenuLink key={s.id} href={seasonPageHref(`${base}/house-league/seasons/${s.id}`, seasonSegment(pathname))}>
                  {switcherName(s)}
                </StripMenuLink>
              ))}
            </StripMenuGroup>
          )}
        </>
      )}
    </>
  );
  // ⚠ Organization's own page (the org hub its full-sidebar row opens) is not one of its listed pages, so
  // its menu leads with it — without that row the strip would lose the page (a door lost; plan §9).
  const orgMenu = openKey === 'org' && (
    <>
      <StripMenuLink href={`${base}/org`} active={pathname === `${base}/org`}>Organization</StripMenuLink>
      {orgLinks.map(pageMenuRow)}
    </>
  );

  return (
    <>
    <aside className={`${styles.rail} ${strip.stripLayer}`} ref={railRef}>
      <nav className={styles.railScroll} aria-label="Admin navigation">
        {!tournamentOnly && !isCanceled && (
          // Inside a tournament this row is the one way back to the club, so it says so — as the phone's More sheet does.
          <RailRow href={base} label={onTournaments ? 'Club overview' : 'Overview'} active={pathname === base} icon={LayoutGrid} />
        )}
        {/* The club calendar (Club Tier 6b, Ask 7): directly under Overview — it spans every program, so it is no
            program's row. `kitCalendarLink` holds its gate. ⚖ Not inside a tournament (owner 2026-10-20): there Overview
            is the one way back to the club, as Programs and Organization already are not rows, and the phone's tournament
            bar never carried either. Schedules, below, follows the same rule. */}
        {calendarLink && !tournamentOnly && !onTournaments && (
          <RailRow href={calendarLink.href} label={calendarLink.label} active={isKitLinkActive(pathname, calendarLink)} icon={calendarLink.icon} />
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
            {!tournamentOnly && !isCanceled && programs.length > 0 && (
              <>
                <div className={styles.label}>Programs</div>
                {programs.map(programGroup)}
              </>
            )}
            {/* What the plan carries but the club does not run yet (specimens 1 and 3): quiet, one
                row each — they join Programs the day the club starts its first season or event. */}
            {!tournamentOnly && !isCanceled && alsoOnPlan.length > 0 && (
              <>
                <div className={styles.label}>Also on your plan</div>
                {alsoOnPlan.map(programGroup)}
              </>
            )}
            {tournamentOnly && !isCanceled && (
              // The one Tournaments list (D7) — `/tournaments` alone opens the selected event's board.
              <RailRow href={`${base}/tournaments/manage`} label="Tournaments" active={false} icon={Trophy} />
            )}
            {orgLinks.length > 0 && (
              <>
                <div className={styles.label}>{tournamentOnly ? 'Account' : 'Organization'}</div>
                {tournamentOnly || isCanceled
                  ? orgLinks.map(link => (
                      // Listed by name in the full sidebar; the strip draws the icon the phone's More menu
                      // gives each (an icon-less row would be an empty square there).
                      <RailRow key={link.key} href={link.href} label={link.label} active={isKitLinkActive(pathname, link)} stripIcon={link.icon} />
                    ))
                  : (
                    <>
                      <ProgramRow href={`${base}/org`} label="Organization" icon={ORGANIZATION_ICON} open={section === 'org'} hasPages opensPages menu={menuFor('org')} />
                      {/* Doors only — an owner's area is not listed for anyone else (owner, 2026-10-01;
                          the hub's Organization section says whose it is, `lib/admin-kit-nav.ts` ⚰). */}
                      {section === 'org' && orgLinks.map(pageRow)}
                    </>
                  )}
              </>
            )}
          </>
        )}

        <div className={styles.spacer} />

        {/* ⚖ ONE SIDEBAR FOOT (the nav standard's N4, Ask B1, 2026-10-17): Help, then the other portal, then Collapse
            sidebar last. Send feedback and Sign out live in the top strip's account menu only — the 2026-09-01 one-sign-out
            rule the coaches portal already kept (the account menu is hidden in the demo sandbox, where a shared demo user
            must never be signed out, so the sandbox loses nothing it should have). */}
        <div className={styles.foot}>
          <Link href={helpHref} className={`${styles.item} ${styles.footItem}`} target="_blank" rel="noopener noreferrer">
            <HelpCircle size={14} aria-hidden /> <span className={strip.rowLabel}>Help</span> <ReleaseDot className={strip.cornerDot} />
          </Link>
          {coachDoor.show && (
            <Link href={coachDoor.href} className={`${styles.item} ${styles.footItem}`}>
              <Users2 size={14} aria-hidden /> <span className={strip.rowLabel}>Coaches Portal</span>
            </Link>
          )}
          {/* "Public site" appears once per screen (N4): the foot's door only where the sidebar lists no Public site row
              (whose page links to the live site). Otherwise today's conditions, kept: not inside a tournament (the
              header's flip pill owns that door there) and not in org admin. */}
          {!onTournaments && section !== 'org' && !siteInNav && (
            <Link href={`/${orgSlug}`} className={`${styles.item} ${styles.footItem}`}>
              <Globe size={14} aria-hidden /> <span className={strip.rowLabel}>Public site</span>
            </Link>
          )}
        </div>
        {/* ⚖ The last row (Ask 2): a rare door ends the body, never a pinned row. */}
        <CollapseSidebarRow className={`${styles.item} ${styles.footItem}`} />
      </nav>
      <SidebarStripTip scopeRef={railRef} />
      <SidebarStripMenu
        key={openKey ?? 'closed'}
        open={!!(programMenu || orgMenu)}
        anchorRef={anchorRef}
        title={menuProgram?.label ?? 'Organization'}
        onClose={close}
      >
        {programMenu || orgMenu}
      </SidebarStripMenu>
    </aside>
    </>
  );
}

/** A season as the switcher names it: a finished one says so (copy §7; a `<select>` option cannot carry a tag). */
function switcherName(s: FrameSeason): string {
  return seasonGroup(s) === 'past' ? `${s.name} · Finished` : s.name;
}

/** A rep team's five pages, for its block in the rail and in the strip's menu. */
function repTeamPages(t: string, pathname: string): PageRow[] {
  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  return [
    { href: t, label: 'Team page', active: pathname === t || under(`${t}/history`) },
    { href: `${t}/roster`, label: 'Roster', active: under(`${t}/roster`) },
    { href: `${t}/schedule`, label: 'Schedule', active: under(`${t}/schedule`) },
    { href: `${t}/tryouts`, label: 'Tryouts', active: under(`${t}/tryouts`) },
    { href: `${t}/coaches`, label: 'Coaches', active: under(`${t}/coaches`) },
  ];
}

/**
 * A house-league season's pages (9a·2: Overview · Registrations · Teams & draft · Schedule · Standings · Money · Email
 * families), the ones this person can open, for its block in the rail and in the strip's menu. Registrations carries the
 * season's waiting count, the amber pill alone.
 */
function seasonPages(s: string, pathname: string, access: HouseLeagueAccess | null, season: FrameSeason | null): PageRow[] {
  const at = seasonSegment(pathname);
  const pages = access ? seasonPagesFor(access) : [];
  return pages.map(p => {
    const count = p.key === 'registrations' ? season?.pendingReviewCount ?? 0 : 0;
    return {
      href: seasonPageHref(s, p.segment),
      label: p.label,
      active: at === p.segment,
      count,
      countLabel: count ? toReviewLabel(count) : undefined,
    };
  });
}

/**
 * Inside one rep team — the TEAM's block (Club Tier Stage 2, specimen 2's rail). It used to open only
 * inside a season page and point at that season's screens; the club now works on a team's live season,
 * so the block belongs to the team: its page, then Roster · Schedule · Tryouts · Coaches. Its label is
 * the team's name once the page has read it (`useRailTeamName`), "Team" until then. How the admin rail
 * groups things against the portal's rail is the project's nav review (Stage 8), not redesigned here.
 */
function RepTeamBlock({ name, pages }: { name: string | null; pages: PageRow[] }) {
  return (
    <>
      <div className={`${styles.subLabel} ${styles.subLabelTeam}`}>{name ?? 'Team'}</div>
      {pages.map(r => <RailRow key={r.href} href={r.href} label={r.label} active={r.active} sub />)}
    </>
  );
}

/**
 * Inside one house-league season — its block, set in under House league (9a·2): the switcher, then the season's pages.
 * The switcher shows whenever the list has read the season you are in (one season reads as its name), lists live seasons
 * first and finished ones marked, and keeps the page you are on.
 */
function SeasonBlock({ seasonId, seasons, pages }: { seasonId: string; seasons: FrameSeason[]; pages: PageRow[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentOrg } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  return (
    <>
      <div className={styles.subLabel}>Season</div>
      {seasons.some(s => s.id === seasonId) && (
        <div className={styles.switcher}>
          <select
            className={styles.switcherSelect}
            value={seasonId}
            aria-label="Switch season"
            id="hl-season-select"
            onChange={e => router.push(seasonPageHref(`${base}/house-league/seasons/${e.target.value}`, seasonSegment(pathname)))}
          >
            {seasons.map(o => <option key={o.id} value={o.id}>{switcherName(o)}</option>)}
          </select>
        </div>
      )}
      {pages.map(r => <RailRow key={r.href} href={r.href} label={r.label} active={r.active} sub count={r.count} countLabel={r.countLabel} />)}
    </>
  );
}

/** The tournament groups a status opens by default (the old rail's rule; a stored choice replaces it). */
function defaultGroups(status: string): Set<string> {
  return new Set(TOUR_GROUPS.filter(g => g.defaultOpenFor.includes(status)).map(g => g.key));
}

/** Today's tournament rail, restyled: switcher, Operations / Setup / Admin (Accounting is Admin's last row). */
function TournamentRail({ labelled }: { labelled: boolean }) {
  const pathname = usePathname();
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const worklist = useAdminWorklist();
  const { base, tournamentGroups: groups } = useAdminKitNav();
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
  const itemActive = (key: string) => pathname.startsWith(`${base}/tournaments/${key}`)
    && !allKeys.some(k => k !== key && k.length > key.length && pathname.startsWith(`${base}/tournaments/${k}`));

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
      {/* ⚰ Accounting's lone row after the groups is gone: it is the Admin group's last row (Ask B4,
          `kit-tournament-groups.ts`), the same list the phone's More sheet reads. */}
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
