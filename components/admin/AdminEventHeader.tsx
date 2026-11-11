'use client';

/**
 * Shared admin header ("The Flip") — one persistent bar across the whole admin shell (desktop + mobile),
 * so the flip door to the public side is always in the same top-right spot and never disappears. Not
 * rendered on focused shells (onboarding/help/preview).
 *
 * THE BAR NAMES WHERE YOU ARE (Admin header bar, option 4, owner 2026-11-07; plan
 * `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`). The name sits on top; a small line UNDER it carries the
 * facts, in the coaches portal's masthead meta voice (`.teamHeaderMeta`). Inside a tournament: the event's
 * name (a link to its dashboard), then the dates · the status chip, a second line in the bar (A2 = a) that
 * never folds away. On the club's Overview it is the club's name alone.
 *
 * IN A CLUB PLACE (Phase 2): the place's name, its way up ("← Seasons"), the switcher beside the name, the
 * small line (the section · the status chip), and the place's TAB ROW pinned inside the bar (`HubTabBar
 * inBar`). The place's frame hands these over (`AdminBarPlace.tsx`); before it has, the bar knows the place
 * from the address alone (`clubPlaceAt`) and draws the frame's own placeholder, so the club's name never shows
 * and swaps. Every other screen shows the organization's name alone. What it names comes from ONE model
 * (`useAdminPlace`), which the desktop strip reads too.
 *
 * ⚖ ROUND 4 (owner 2026-11-08, D1–D5): ABOVE 900px THIS BAR IS THE TAB BAND ALONE. The place names itself in
 * the top strip (`AdminTopStrip`), View site sits there by the bell, and the club heads the sidebar in a cell
 * exactly the band's height (`--admin-band-h`, one variable both read), so the two bottom rules are one line. A
 * place without tabs (Overview, a tournament, every other screen) draws no desktop bar at all. The phone keeps
 * everything below exactly as it was.
 *
 * ⚠ NO SCROLL COLLAPSE, anywhere (owner 2026-11-07, the portal took it out 2026-09-21): the collapse made
 * content jump under the thumb. The bar's height changes only when you navigate, never on scroll, and
 * `--admin-header-h` publishes it for the in-page sticky toolbars.
 *
 * ⚖ THE TOURNAMENT PHONE NAMES THE PAGE (navigation Phase 3, E5 + R1–R4, owner 2026-11-11). On an event's own page the
 * bar's first line is the page — the sidebar's lit row, in its words, the SAME answer the strip gives on a computer
 * (`useDeskTitle`, one rule for both widths) — and the event rides the small line under it: its name, its phase chip and a
 * chevron (R1: no dates there; they are in the list's rows). The small line is the door to the event sheet
 * (`AdminEventSwitchSheet`), and its 44px target is the name and the line together (R4): the bar keeps its height, and a tap
 * on the page's name opens the list too. On the organization's own tournament screens (the Tournaments list, a Tournament
 * plan's Plan & billing) the bar names the screen and has no small line (R3: no event is theirs). The More sheet's picker
 * went with it, so each width has one way to change event.
 *
 * HEADING SEMANTICS — ONE `<h1>` PER WIDTH. The bar's name is the page's `<h1>` wherever it IS the page's title: a page the
 * strip names (above), the club's Overview (its paper heading is gone, A3) and every club place that hands the bar its name.
 * Where the bar names the page, the paper's own title is hidden at BOTH widths (`AdminPageHeader`'s `data-desk-named`, CSS
 * only). On every other screen (a team, a record page, a place not moved yet, an event page with no sidebar row of its own)
 * the page still draws its own heading, so the bar's name is a `<span>` there. Above 900px this name row is `display: none`
 * and the strip's name is the `<h1>`; at 900px and below the strip's place is `display: none` and this one is. The event
 * door is a `<button>` BESIDE the `<h1>`, never around it — its target only overlaps the name.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import FlipPill from '@/components/shared/FlipPill';
import { useAdminFlip } from '@/lib/use-admin-flip';
import { useOrg } from '@/lib/org-context';
import HubTabBar from '@/components/shared/HubTabBar';
import { useAdminPlace } from './useAdminPlace';
import { useDeskTitle } from './DeskNamedPage';
import AdminEventSwitchSheet, { ADMIN_EVENT_SHEET_ID } from './kit/AdminEventSwitchSheet';
import styles from './kit/AdminKitEventHeader.module.css';

export default function AdminEventHeader({ suspended = false }: {
  /** A cancelled account (`AdminChrome` decides): the org's name alone — no tournament identity, no door to a public
   *  site whose pages are suspended. */
  suspended?: boolean;
} = {}) {
  const pathname = usePathname();
  const { title, onEvent, isPageTitle, place, tabbed, phaseChip, phaseLabel } = useAdminPlace(suspended);
  // The page's name, the strip's own answer (null for a cancelled account, a place, the preview, a page with no row).
  const deskTitle = useDeskTitle();
  const { currentOrg } = useOrg();
  const flip = useAdminFlip();
  const ref = useRef<HTMLElement>(null);
  const doorRef = useRef<HTMLButtonElement>(null);
  // The event sheet belongs to the page it was opened on: a new page (a row, "All tournaments") finds it shut.
  const [sheetAt, setSheetAt] = useState<string | null>(null);
  // Forgotten on the next page, so coming back to this one never reopens it unasked (/review 2026-11-11).
  if (sheetAt !== null && sheetAt !== pathname) setSheetAt(null);
  const sheetOpen = onEvent && sheetAt === pathname;
  const closeSheet = useCallback(() => setSheetAt(null), []);

  // The router doesn't reset the shell's inner scroller (.adminMain on a phone) on navigation, so a new
  // page could otherwise open mid-scroll. Reset it whenever the route changes.
  useEffect(() => {
    let node: HTMLElement | null = ref.current?.parentElement ?? null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === 'auto' || oy === 'scroll') { node.scrollTo(0, 0); break; }
      node = node.parentElement;
    }
  }, [pathname]);

  // Publish the rendered bar height so in-page sticky toolbars can stick BELOW it (via
  // `top: var(--admin-header-h)`) instead of being buried under it. With no collapse it changes only when
  // the bar's content does (navigation, a name loading in, a breakpoint), never on scroll. On desktop the bar is the tab
  // band alone, or not drawn at all (`display: none`), and then this publishes 0.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty('--admin-header-h', `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--admin-header-h'); };
  }, [pathname]);

  // No door (focused/preview shells) → no header.
  if (!flip) return null;

  // ⚖ The page's name where the strip names it (Phase 3, both widths); else the place's, the club's or the organization's, an
  // `<h1>` only where it is the page's title. An event page with no row of its own keeps the event's name here (a `<span>`:
  // its paper keeps the title), and the small line under it is still the door to the list.
  const name = deskTitle
    ? <h1 className={styles.name}>{deskTitle}</h1>
    : isPageTitle
      ? <h1 className={styles.name}>{title}</h1>
      : <span className={styles.name}>{title}</span>;

  const facts = place?.facts ?? [];
  // The phone's small line: a place's section, its detail and its chip. ⚖ Round 4 (D1, D3, 2026-11-08): the desktop has no
  // small line at all (the club heads the sidebar, the place names itself in the strip). On an event's page the line is the
  // event door instead (below); on the organization's tournament screens there is none (R3).
  const hasMeta = Boolean(facts.length || place?.detail || place?.chip);
  // ⚖ THE EVENT DOOR (Phase 3, R1 + R4): the event's name (when the line above names the page), its phase chip and a chevron —
  // one button, whose 44px target reaches up over the page's name (`.eventDoor::before`). Always a door while there is an
  // event (T6, 2026-11-11): the sheet holds that event and "All tournaments" even when it is the only one.
  const eventDoor = onEvent && (
    <button
      ref={doorRef}
      type="button"
      className={`${styles.meta} ${styles.eventDoor}`}
      aria-haspopup="menu"
      aria-expanded={sheetOpen}
      aria-controls={sheetOpen ? ADMIN_EVENT_SHEET_ID : undefined}
      aria-label={`${title}${phaseLabel ? ` · ${phaseLabel}` : ''} · switch tournament`}
      onClick={() => setSheetAt(at => (at === pathname ? null : pathname))}
    >
      {deskTitle && <span className={styles.doorName}>{title}</span>}
      {phaseChip}
      <ChevronDown size={14} aria-hidden className={styles.doorChevron} />
    </button>
  );
  // ⚖ ON DESKTOP THE BAR IS THE TAB BAND ALONE (round 4, D1): the name row is the phone's (the strip names the place
  // above 900px), and a place without tabs draws no desktop bar at all. A cancelled account's one page keeps its row:
  // it has no sidebar to split the strip on, so its strip stays as it was and this bar keeps naming the organization.
  const deskClass = suspended ? '' : tabbed ? ` ${styles.deskBand}` : ` ${styles.deskNone}`;
  return (
    <>
    <header ref={ref} role="banner" className={`${styles.header}${tabbed ? ` ${styles.withTabs}` : ''}${deskClass}`}>
      <div className={styles.row}>
        {place?.back && (
          // The way up, named by where it goes (the paper header's `backTo`, moved in): the arrow alone on a phone.
          <>
            <Link href={place.back.href} className={styles.back} aria-label={`Back to ${place.back.label}`}>
              <ArrowLeft size={15} aria-hidden />
              <span className={styles.backLabel}>{place.back.label}</span>
            </Link>
            <span className={styles.backRule} aria-hidden />
          </>
        )}
        <div className={styles.identity}>
          {place?.switcher
            // The name is cut to one line with "…"; the switcher beside it never is.
            ? <div className={styles.titleRow}>{name}<span className={styles.switcher}>{place.switcher}</span></div>
            : name}
          {eventDoor}
          {hasMeta && (
            // Each fact is its own span and the separator is drawn BETWEEN siblings (the portal's rule), so a
            // missing fact never strands a dot.
            <div className={styles.meta}>
              {facts.map(f => <span key={f}>{f}</span>)}
              {/* A record's own fact (round 5, Q4): "Born Mar 14, 2015", a past season's team. */}
              {place?.detail && <span>{place.detail}</span>}
              {place?.chip && <span className={`${styles.chip} ${styles.metaChip}`}>{place.chip}</span>}
            </div>
          )}
        </div>
        {!suspended && <FlipPill resolution={flip} variant="inline" className={styles.pill} />}
      </div>
      {tabbed && <HubTabBar inBar tabs={tabbed.tabs} activeId={tabbed.activeId} ariaLabel={tabbed.ariaLabel} />}
    </header>
    {/* The bar's SIBLING, outside the sticky header's stacking context, inside the admin shell that defines the bottom bar's
        clearance (`--coach-foot-clear`) — the coach masthead's arrangement. A client mount, opened only by a tap. */}
    {sheetOpen && currentOrg && (
      <AdminEventSwitchSheet base={`/${currentOrg.slug}/admin`} onClose={closeSheet} opener={doorRef} />
    )}
    </>
  );
}
