'use client';
/**
 * AdminKitBottomNav — the admin's phone bar and More menu on the coaches portal's kit (Admin Design
 * Continuity slice 1). The admin's only phone bar since Part B deleted the old console bar (2026-09-29).
 *
 * ⚠ THE SKIN IS THE COACH BAR'S OWN STYLESHEET, imported, not copied (`CoachesBottomNav.module.css`):
 * the 72px bar, its tabs, the More sheet that rises over a scrim while the bar stays visible and
 * tappable (the drawer-layers ruling, 2026-09-23: a MENU sits on top of the bar), its warm and dark
 * skins. One stylesheet is the only way two phone bars cannot drift.
 *
 * ⚠ TWO BARS, chosen by where you are (ratified club Stage 1 specimen 4, ADC specimen 4):
 *   · the CLUB bar everywhere outside a tournament — Overview, the club's first three programs,
 *     More. The same bar on every club screen; the program you are in lights up. (Today Families and
 *     the hub wear the TOURNAMENT bar, J4-045 / A12 — the defect this replaces.)
 *   · the TOURNAMENT bar inside a tournament, and always for a tournament-only organization — its tabs follow the
 *     event's PHASE, the one the header shows (`tournamentBarKeys`, owner 2026-10-16), with Dashboard pinned to the
 *     left corner: Dashboard · Teams · Schedule · Site in Draft; Dashboard · Teams · Schedule · Chat while Open;
 *     Dashboard · Results · Schedule · Chat from game day on, Check-in in More. Today's counts and today's context
 *     strip sit above them. A club's More gains "Club overview" at its top. An invite-only event (the free plan, a
 *     Premium coach's event) has no Check-in or Chat, so Messages, which opens Communications, takes Chat's place
 *     (M6, the free tournament tier, 2026-10-16).
 */
import { useEffect, useRef, useState, type ElementType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid, MoreHorizontal, X, ChevronRight, Bell, Globe, Home, User, Users2,
} from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { useChatUnread } from '@/lib/use-chat-unread';
import { useDismissable } from '@/lib/overlay-hooks';
import AdminContextStrip from '@/components/admin/AdminContextStrip';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import MoreSheetTiles, { type SheetTile } from '@/components/coaches/MoreSheetTiles';
import MoreSheetFoot from '@/components/coaches/MoreSheetFoot';
import WhatsNewSheetRow from '@/components/whats-new/WhatsNewSheetRow';
import { clubPhoneNav, tournamentSheetTiles } from '@/lib/nav-tiles';
import {
  clubSheetGroups, isKitLinkActive, isKitLinkActiveAmong, placeGroupHeading, tournamentBarKeys, type KitLink,
} from '@/lib/admin-kit-nav';
import { resolveEventPhase } from '@/lib/tournament-phase';
import { useAdminKitNav } from './useAdminKitNav';
import { briefPlaceCount } from './club/ClubBriefProvider';
import { kitCountText } from '@/lib/admin-kit-nav';
import { MESSAGES_TAB } from '@/lib/invite-only-words';
import styles from '@/components/coaches/CoachesBottomNav.module.css';
import kit from './AdminKitFrame.module.css';
import { useFeeAlert } from './useFeeAlert';

const badge = (n: number): string => (n > 9 ? '9+' : String(n));

/** One More-sheet section: its heading (none for a club group of one row) and its rows. */
type SheetGroup = { key: string; heading: string | null; places: KitLink[] };

type Tab = { key: string; href: string; icon: ElementType; label: string; active: boolean; count?: number; chat?: boolean };

export default function AdminKitBottomNav({ notifUnread = 0 }: { notifUnread?: number }) {
  const pathname = usePathname();
  const nav = useAdminKitNav();
  const {
    base, programs, alsoOnPlan, brief, placeGroups, litPlace, tournamentOnly, onTournaments, isCanceled, coachDoor, tournamentGroups,
    calendarLink, permitsLink, schedulesLink, billingLink, helpHref, isSandbox,
  } = nav;
  const { currentOrg } = useOrg();
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const worklist = useAdminWorklist();
  const tournamentBar = onTournaments || tournamentOnly;
  // Chat's unread count rides the bar only where Chat is a door (an invite-only event has none, R5).
  const chatInNav = tournamentGroups.some(g => g.items.some(i => i.key === 'chat'));
  const chatUnread = useChatUnread(tournamentBar && chatInNav);

  const [moreOpen, setMoreOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useDismissable(moreOpen, moreRef, () => setMoreOpen(false));
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMoreOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  // ── The tournament bar: today's lifecycle-aware tabs, from the SAME groups the rail lists ──────
  // (sandbox-curated, role-gated, Summary once the event is over, every row's address resolved — `useAdminKitNav`).
  const groupItems = (key: string) => tournamentGroups.find(g => g.key === key)?.items ?? [];
  const opsByKey = new Map(groupItems('operations').map(i => [i.key, i]));
  const setupByKey = new Map(groupItems('setup').map(i => [i.key, i]));
  // The PHASE picks the tabs, read with the header's own rule (the dates, or the first game having started) the way
  // the context strip reads it, so the header, the board and the bar can never disagree (owner, 2026-10-16).
  const phase = currentTournament
    ? resolveEventPhase({
        status: currentTournament.status,
        startDate: currentTournament.startDate,
        endDate: currentTournament.endDate,
        firstGameStarted: Boolean(currentTournament.firstGameStarted),
      })
    : 'draft';
  type TourItem = (typeof tournamentGroups)[number]['items'][number];
  const relabel = (item: TourItem | undefined, label: string, icon?: ElementType): TourItem | undefined =>
    (item ? { ...item, label, ...(icon ? { icon: icon as TourItem['icon'] } : {}) } : undefined);
  // Where the plan has no Chat (an invite-only event, M6), Messages (Communications) takes its place.
  const tourPrimary: TourItem[] = tournamentBarKeys(phase)
    .map(key =>
      key === 'branding' ? relabel(setupByKey.get('branding'), 'Site', Globe)
      : key === 'chat' ? opsByKey.get('chat') ?? relabel(opsByKey.get('communication'), MESSAGES_TAB)
      : opsByKey.get(key))
    .filter((i): i is TourItem => Boolean(i));
  const primaryKeys = new Set(tourPrimary.map(i => i.key));
  const tourDoor = (i: TourItem): KitLink => ({
    key: i.key, label: i.label, href: i.href, icon: i.icon,
    // A door with a query (Accounting's `?tournamentId=`) lights on its page's path.
    ...(i.href.includes('?') ? { also: [i.href.split('?')[0]] } : {}),
  });
  // ⚖ The tournament's tiles (N8, Ask C2): Check-in · Staff kit · Teams on game day only, read from this person's own
  // Operations rows (so a plan without Check-in or Staff kit gets none). They stay listed in Operations: they come and go.
  const tourTiles = tournamentBar ? tournamentSheetTiles(phase, [...opsByKey.values()].map(tourDoor)) : null;
  const chatIsPrimary = primaryKeys.has('chat');
  // More lists every group row the bar does not already show as a tab — an icon on every row, the sidebar's (N7).
  const tourMoreGroups: SheetGroup[] = tournamentGroups
    .map(g => ({ key: g.key, heading: g.label, places: g.items.filter(i => !primaryKeys.has(i.key)).map(tourDoor) }))
    .filter(g => g.places.length > 0);

  // ── The club bar: ONE bar for every club (owner, 2026-10-17 — `lib/nav-tiles.ts` holds the rule and its calls) ─────
  // Overview · Calendar · Rep teams · Accounting · More, and Schedules · House league · Families as the tiles at the top
  // of More, in the programs' own order (N10). What the plan carries but the club does not run yet never fills a tab or a
  // tile: it lists under the sheet's "Also on your plan", as in the sidebar. A cancelled club's bar is More.
  const club = clubPhoneNav<KitLink>({
    calendar: calendarLink, schedules: schedulesLink, programs: isCanceled ? [] : programs, alsoOnPlan,
  });
  // A place's door (a program, or Organization) lights while you are anywhere inside the place — the sidebar's one lit row
  // (`litClubPlace`: none on Plan & billing's page); the calendar and the scheduler on their own pages.
  const placeKeys = new Set(placeGroups.flatMap(g => g.places.map(p => p.key)));
  const doorActive = (d: KitLink) => (placeKeys.has(d.key) ? litPlace === d.key : isKitLinkActive(pathname, d));
  const underHref = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // The morning brief's waiting count for a place's door — a tab, a tile or a sheet row carries it alike, as the sidebar's.
  // ⚠ Declared before the tabs below read it: a later `const` is a crash on every club render (the design pass caught it).
  const programCount = (key: string) => briefPlaceCount(brief, key);
  // ⚖ The sheet's groups (N7, 13i B5): the sidebar's places under the sidebar's names, less what the bar and the tiles show.
  // Organization is ONE row (its pages are its tabs); a one-row group draws no heading (the owner's Tournaments).
  const sheetGroups: SheetGroup[] = clubSheetGroups(placeGroups, club).map(g => ({ ...g, heading: placeGroupHeading(g) }));

  const tabs: Tab[] = tournamentBar
    ? tourPrimary.map(i => ({
        key: i.key, href: i.href, icon: i.icon, label: i.label,
        active: underHref(i.href),
        count: worklist[i.key] ?? 0,
        chat: i.key === 'chat',
      }))
    : [
        ...(isCanceled ? [] : [{ key: 'overview', href: base, icon: LayoutGrid, label: 'Overview', active: pathname === base }]),
        ...club.tabs.map(d => ({
          key: d.key, href: d.href, icon: d.icon ?? LayoutGrid, label: d.label,
          active: doorActive(d),
          // The morning brief's waiting items — the number the hub's door and the rail show (a program's only).
          count: programCount(d.key),
        })),
      ];

  const moreLinks: KitLink[] = tournamentBar
    ? tourMoreGroups.flatMap(g => g.places)
    : [...(club.schedulesRow ? [club.schedulesRow] : []), ...(club.tiles ?? []), ...(permitsLink ? [permitsLink] : []), ...sheetGroups.flatMap(g => g.places)];
  // More is lit on any page it holds a row for: its places, Notifications, and Plan & billing (its You row).
  const moreActive = moreLinks.some(doorActive)
    || (!tournamentBar && !!billingLink && isKitLinkActive(pathname, billingLink))
    || pathname === `${base}/notifications`;
  const moreChat = tournamentBar && chatInNav && !chatIsPrimary ? chatUnread : 0;
  // Fee invoice alerts, Part 2: the Plan & billing signal rides More's pill (and the sheet's own row) — amber to pay, red overdue.
  const feeAlert = useFeeAlert();
  const moreUnread = moreChat + notifUnread;
  // ⚖ While a fee signal exists the pill shows ONLY its count, in its tone (owner, 2026-11-05): adding unread messages to an
  // invoice count printed a number that read as invoices. The unread are still spoken in the label and listed in the sheet.
  const moreBadge = feeAlert ? feeAlert.count : moreUnread;
  // One spoken label: the unread part only when there are unread, then the fee part in its own words (never "invoices unread").
  const moreLabel = ['More', ...(moreUnread > 0 ? [`${badge(moreUnread)} unread`] : []), ...(feeAlert ? [feeAlert.label] : [])].join(', ');
  const feeTone = feeAlert ? (feeAlert.tone === 'red' ? styles.feeRed : styles.feeAmber) : '';
  const close = () => setMoreOpen(false);

  const row = (l: KitLink, count = 0) => {
    const Icon = l.icon;
    // A club row is a place (or the scheduler), lit as the sidebar lights it; a tournament row steps aside for Plan & billing,
    // which lives under Settings & access's address on the tournament tiers.
    const active = tournamentBar ? isKitLinkActiveAmong(pathname, l, [billingLink]) : doorActive(l);
    // Chat's row counts unread messages (the 9+ badge); every other row a program's waiting count (Stage 13a: to 99).
    const chat = l.key === 'chat';
    const countText = chat ? badge(count) : kitCountText(count);
    return (
      <Link
        key={l.key}
        href={l.href}
        className={`${styles.dropItem}${active ? ` ${styles.dropActive}` : ''}`}
        role="menuitem"
        onClick={close}
      >
        {Icon && <Icon size={17} aria-hidden />}
        <span>{l.label}</span>
        {count > 0 && <span className={styles.dropCount} aria-label={`${countText} ${chat ? 'unread' : 'waiting'}`}>{countText}</span>}
        <ChevronRight size={14} className={styles.dropChevron} aria-hidden />
      </Link>
    );
  };
  // A tile in the shared row: its nav row's icon, lit as that row lights.
  const sheetTile = (t: KitLink): SheetTile => ({
    key: t.key, href: t.href, label: t.label,
    icon: t.icon ?? LayoutGrid,
    active: tournamentBar ? underHref(t.href) : doorActive(t),
    count: tournamentBar ? worklist[t.key] ?? 0 : programCount(t.key),
  });
  // Doors only, as the rail: an owner's area is not listed for anyone else (owner, 2026-10-01). A null heading: a club group
  // of one row, which draws none (N2, 13i).
  const group = ({ key, heading, places }: SheetGroup) => (
    <div key={key} className={styles.dropSection}>
      {heading && <div className={styles.dropSectionLabel}>{heading}</div>}
      <div className={styles.dropGrid} data-cols={places.length > 1 ? 2 : 1}>
        {places.map(l => row(l, l.key === 'chat' ? moreChat : tournamentBar ? 0 : programCount(l.key)))}
      </div>
    </div>
  );

  return (
    <nav className={styles.bottomNav} aria-label="Admin mobile navigation">
      {tournamentBar && <AdminContextStrip />}

      {tabs.map(t => (
        <Link
          key={t.key}
          href={t.href}
          className={`${styles.tab}${t.active ? ` ${styles.active}` : ''}`}
          id={`admin-mob-${t.label.toLowerCase().replace(/\s+/g, '-')}`}
          aria-current={t.active ? 'page' : undefined}
          aria-label={t.chat && chatUnread > 0 ? `${t.label}, ${badge(chatUnread)} unread` : undefined}
        >
          <span className={styles.iconWrap}>
            <t.icon size={22} strokeWidth={t.active ? 2.5 : 1.8} aria-hidden />
            {t.active && <span className={styles.activeDot} />}
            {(t.count ?? 0) > 0 && <span aria-hidden className={styles.tabCount}>{kitCountText(t.count!)}</span>}
            {t.chat && chatUnread > 0 && <span aria-hidden className={styles.tabCount}>{badge(chatUnread)}</span>}
          </span>
          <span className={styles.label}>{t.label}</span>
        </Link>
      ))}

      <div ref={moreRef} className={styles.moreWrap}>
        <button
          type="button"
          className={`${styles.tab}${moreOpen || moreActive ? ` ${styles.active}` : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          id="admin-mob-more"
          aria-haspopup="true"
          aria-expanded={moreOpen}
          aria-label={!moreOpen && moreBadge > 0 ? moreLabel : undefined}
        >
          <span className={styles.iconWrap}>
            {moreOpen ? <X size={22} strokeWidth={2} aria-hidden /> : <MoreHorizontal size={22} strokeWidth={moreActive ? 2.5 : 1.8} aria-hidden />}
            {moreActive && !moreOpen && <span className={styles.activeDot} />}
            {!moreOpen && moreBadge > 0 && <span aria-hidden className={`${styles.tabCount}${feeTone ? ` ${feeTone}` : ''}`}>{feeAlert ? kitCountText(moreBadge) : badge(moreBadge)}</span>}
          </span>
          <span className={styles.label}>More</span>
        </button>

        {moreOpen && (
          <>
            <div className={styles.sheetScrim} aria-hidden onClick={() => setMoreOpen(false)} />
            <div className={styles.dropdown} role="menu">
              <span className={styles.sheetGrab} aria-hidden />

              {/* ⚖ ONE MORE-SHEET ORDER FOR EVERY OPERATOR PORTAL (the nav standard's N7, Ask B2, 2026-10-17): (1) the place
                  you're in, a tournament only — Club overview, then the tournament picker; (2) Notifications; (3) the tiles;
                  (4) the sidebar's groups, under the sidebar's names, in its order, an icon on every row; (5) You — Account,
                  Home, the other portal; (6) Help, Send feedback, Download app, Sign out. */}
              {tournamentBar && !tournamentOnly && (
                // Named by where it goes, never "Back to…" (2026-07-31; N6, Ask A5): the club's Overview, in its icon.
                <Link className={styles.dropItem} href={base} role="menuitem" id="admin-mob-club-overview" onClick={() => setMoreOpen(false)}>
                  <LayoutGrid size={17} aria-hidden />
                  <span>Club overview</span>
                </Link>
              )}

              {currentOrg?.id && (
                <Link
                  className={`${styles.dropItem}${pathname === `${base}/notifications` ? ` ${styles.dropActive}` : ''}`}
                  href={`${base}/notifications`}
                  role="menuitem"
                  id="admin-mob-notifications"
                  onClick={() => setMoreOpen(false)}
                >
                  <Bell size={17} aria-hidden />
                  <span>Notifications</span>
                  {notifUnread > 0 && <span className={styles.dropCount} aria-label={`${badge(notifUnread)} unread`}>{badge(notifUnread)}</span>}
                </Link>
              )}


              {tournamentBar ? (
                <>
                  {tournaments.length > 0 && (
                    <div className={styles.dropSection}>
                      <div className={styles.dropSectionLabel}>Current tournament</div>
                      <div className={kit.switcher}>
                        {tournaments.length > 1 ? (
                          <select
                            className={kit.switcherSelect}
                            value={currentTournament?.id ?? ''}
                            onChange={e => { const t = tournaments.find(x => x.id === e.target.value); if (t) setCurrentTournament(t); }}
                            id="admin-mob-tournament-select"
                            aria-label="Current tournament"
                          >
                            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}{t.isActive ? ' - Live' : ''}</option>)}
                          </select>
                        ) : (
                          <span className={kit.switcherName}>{currentTournament?.name}</span>
                        )}
                      </div>
                      {/* No "Review launch checklist" row: Dashboard, which holds the checklist, is pinned to the bar in
                          every phase (owner 2026-10-16), so More never needs a second door to it. */}
                    </div>
                  )}
                  {tourTiles && <MoreSheetTiles tiles={tourTiles.map(sheetTile)} onPick={close} />}
                  {tourMoreGroups.map(group)}
                </>
              ) : (
                <>
                  {/* The club's tiles — Schedules · House league · Families, filled from Programs (`clubPhoneNav`). Without
                      three, none, and the scheduler (Club Tier 11a, the rail's gate) stays a full row: it spans every
                      program, so it belongs to no group. The calendar is a tab on the bar. */}
                  {club.tiles && <MoreSheetTiles tiles={club.tiles.map(sheetTile)} onPick={close} />}
                  {club.schedulesRow && row(club.schedulesRow)}
                  {/* Permits (Club Tier 13c, C1 = A): the sidebar's unheaded place, so the sheet's lone row at the top of its
                      list — above the owner's Tournaments, the treasurer's Organization. A row, never a fourth tile (N8). */}
                  {permitsLink && row(permitsLink)}
                  {/* The sidebar's places, under its headings (Programs · Also on your plan · Club), in its order. */}
                  {sheetGroups.map(group)}
                </>
              )}

              {/* You: Account and Home lead out of the demo sandbox (it ends the demo on arrival), so the sandbox hides
                  them, as the top strip hides the account menu. What's new sits beside Account (owner 2026-11-07); it opens a
                  public page in a new tab, so the sandbox keeps it and the group always has a row to show. */}
              <>
                  <div className={styles.dropDivider} />
                  <div className={styles.dropSectionLabel}>You</div>
                  <div className={styles.dropGrid} data-cols="2">
                    {!isSandbox && (
                      <Link className={styles.dropItem} href="/account" role="menuitem" id="admin-mob-account" onClick={close}>
                        <User size={17} aria-hidden /><span>Account</span>
                      </Link>
                    )}
                    <WhatsNewSheetRow itemClass={styles.dropItem} id="admin-mob-whats-new" onClose={close} />
                    {!isSandbox && (
                      <Link className={styles.dropItem} href="/discover" role="menuitem" id="admin-mob-home" onClick={close}>
                        <Home size={17} aria-hidden /><span>Home</span>
                      </Link>
                    )}
                    {coachDoor.show && (
                      <Link className={styles.dropItem} href={coachDoor.href} role="menuitem" id="admin-mob-coaches-portal" onClick={close}>
                        <Users2 size={17} aria-hidden /><span>Coaches Portal</span>
                      </Link>
                    )}
                    {billingLink && <Link className={styles.dropItem} href={billingLink.href} role="menuitem" id="admin-mob-billing" onClick={close} aria-current={isKitLinkActive(pathname, billingLink) ? 'page' : undefined}>
                      {billingLink.icon && <billingLink.icon size={17} aria-hidden />}<span>{billingLink.label}</span>
                      {feeAlert && <span className={`${styles.dropCount} ${feeTone}`} aria-label={feeAlert.label}>{kitCountText(feeAlert.count)}</span>}
                    </Link>}
                  </div>
              </>

              <div className={styles.dropDivider} />
              {/* Help (new on the admin phone, N7), Send feedback, Download app, Sign out — the one foot every sheet wears. */}
              <MoreSheetFoot idPrefix="admin-mob" helpHref={helpHref} onClose={close} onFeedback={() => setFeedbackOpen(true)}>
                {/* ⚖ No live-site door in the sheet (Ask 9 = A, Stage 13a): the header's globe ("View site") is on every screen. */}
              </MoreSheetFoot>
            </div>
          </>
        )}
      </div>

      {feedbackOpen && <FeedbackWidget open onClose={() => setFeedbackOpen(false)} />}
    </nav>
  );
}
