'use client';

/**
 * Shared admin header ("The Flip") — one persistent bar across the whole admin shell (desktop + mobile),
 * so the flip door to the public side is always in the same top-right spot and never disappears. Not
 * rendered on focused shells (onboarding/help/preview).
 *
 * THE BAR NAMES WHERE YOU ARE (Admin header bar, option 4, owner 2026-11-07; plan
 * `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`). The name sits on top; a small line UNDER it carries the
 * facts, in the coaches portal's masthead meta voice (`.teamHeaderMeta`). Inside a tournament: the event's
 * name (a link to its dashboard), then the club (desktop only) · the dates · the status chip. On a phone that
 * line is a second line in the bar (A2 = a): dates · chip, and it never folds away. On the club's Overview it
 * is the club's name alone.
 *
 * IN A CLUB PLACE (Phase 2): the place's name, its way up ("← Seasons"), the switcher beside the name, the
 * small line (the club on desktop · the section · the status chip), and the place's TAB ROW pinned inside the
 * bar (`HubTabBar inBar`). The place's frame hands these over (`AdminBarPlace.tsx`); before it has, the bar
 * knows the place from the address alone (`clubPlaceAt`) and draws the frame's own placeholder, so the club's
 * name never shows and swaps. Every other screen shows the organization's name alone.
 *
 * ⚠ NO SCROLL COLLAPSE, anywhere (owner 2026-11-07, the portal took it out 2026-09-21): the collapse made
 * content jump under the thumb. The bar's height changes only when you navigate, never on scroll, and
 * `--admin-header-h` publishes it for the in-page sticky toolbars.
 *
 * HEADING SEMANTICS. The bar's name is the page's one `<h1>` wherever it IS the page's title: the club's
 * Overview (its paper heading is gone, A3) and every club place that hands the bar its name (that place's
 * paper heading went with it). Inside a tournament the name stays a link and the page's own title (Teams,
 * Schedule…) stays the `<h1>` on the paper; on every other club screen (a team, a record page, a place not
 * moved yet) the page still draws its own heading, so the name is a `<span>` there. Two `<h1>`s on one
 * page is the defect to avoid.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import FlipPill from '@/components/shared/FlipPill';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useAdminFlip } from '@/lib/use-admin-flip';
import { resolveEventPhase, PHASE_LABEL } from '@/lib/tournament-phase';
import { formatEventDateRange } from '@/lib/timezone';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { kit as coachKit } from '@/components/coaches/kit';
import HubTabBar from '@/components/shared/HubTabBar';
import { useClubPlaceAt, useHandedBarPlace, type AdminBarPlace } from './AdminBarPlace';
import styles from './kit/AdminKitEventHeader.module.css';

export default function AdminEventHeader({ suspended = false }: {
  /** A cancelled account (`AdminChrome` decides): the org's name alone — no tournament identity, no door to a public
   *  site whose pages are suspended. */
  suspended?: boolean;
} = {}) {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();
  const addressPlace = useClubPlaceAt();
  const handed = useHandedBarPlace();
  const flip = useAdminFlip();
  const ref = useRef<HTMLElement>(null);

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
  // the bar's content does (navigation, a name loading in, a breakpoint), never on scroll.
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

  const onTournament =
    !suspended &&
    pathname.includes('/admin/tournaments') &&
    !pathname.includes('/admin/tournaments/preview') &&
    !!currentTournament?.slug;

  // The club's Overview (A3): its paper heading is gone, so the bar's name is the page's one `<h1>`. A
  // tournament-only workspace has no Overview (`AdminHub` sends it to its tournaments), and a cancelled
  // account's one page draws its own heading.
  const onOverview =
    !suspended &&
    !!currentOrg &&
    !isTournamentOnlyWorkspace(currentOrg) &&
    pathname.replace(/\/+$/, '') === `/${currentOrg.slug}/admin`;

  // A club place (Phase 2): known from the address first, then the frame's hand-off for THIS place. The lit
  // tab is always the address's, so a hand-off a beat behind a tab change never lights the old tab.
  const routePlace = !suspended && !onTournament ? addressPlace : null;
  const place: AdminBarPlace | null = routePlace
    ? (handed?.key === routePlace.key ? { ...handed, activeId: routePlace.activeId } : routePlace)
    : null;

  let title: string;
  let club: string | null = null;  // the small line's first fact (desktop only)
  let dates: string | null = null;
  let titleHref: string | null = null;
  let phase: string | null = null;
  let phaseLabel: string | null = null;

  if (onTournament && currentTournament) {
    title = currentTournament.name;
    club = currentOrg?.name ?? null;
    // ONE chip from ONE rule — the board's (G1): the dates, OR the first game having started, until the
    // event is marked complete. It used to read the dates alone, so after the last day it said "Open"
    // while the dashboard below it said game day. Past the last day it stays game day even with no game
    // ever started — the organizer marking it complete is the only thing that ends it (the coach site
    // reads the same status).
    phase = resolveEventPhase({
      status: currentTournament.status,
      startDate: currentTournament.startDate,
      endDate: currentTournament.endDate,
      firstGameStarted: Boolean(currentTournament.firstGameStarted),
    });
    phaseLabel = PHASE_LABEL[phase as keyof typeof PHASE_LABEL] ?? null;
    dates = formatEventDateRange(currentTournament.startDate, currentTournament.endDate, true);
    titleHref = `/${currentOrg?.slug ?? ''}/admin/tournaments/dashboard`;
  } else if (place) {
    title = place.title;
    club = currentOrg?.name ?? null;
  } else {
    // Org-level screens: the org IS the identity, so it's the title, with no small line.
    title = currentOrg?.name ?? 'Admin';
  }

  // The link wraps the name rather than being it: the name clamps its lines, and the link's own box is
  // free to grow into a thumb's target on a touch screen without un-clamping them.
  const isPageTitle = onOverview || !!place;
  const name = isPageTitle
    ? <h1 className={styles.name}>{title}</h1>
    : <span className={styles.name}>{title}</span>;
  const nameEl = titleHref
    ? <Link href={titleHref} className={styles.nameLink} title={`${title} — open dashboard`}>{name}</Link>
    : name;

  // The phase chip keeps its shipped look: red for a live event, olive while open, quiet otherwise.
  const tone = phase === 'gameday' ? coachKit.chipDanger : phase === 'open' ? coachKit.chipGood : styles.chipNeutral;
  const facts = place?.facts ?? [];
  const deskFacts = place?.deskFacts ?? [];
  // What a phone's small line holds: the club and the desk facts are the desk's only (A4, a team's group).
  const phoneLine = Boolean(facts.length || dates || phaseLabel || place?.chip);
  const hasMeta = Boolean(club) || deskFacts.length > 0 || phoneLine;
  // A line holding only desk words (Rep teams, Accounting: the club) is a desk line: a phone draws no line.
  const deskOnly = hasMeta && !phoneLine;
  // A row of one tab is no row (`HubTabBar`'s own rule), and then the bar keeps its bottom padding.
  const tabbed = place && place.tabs.length > 1 ? place : null;
  return (
    <header ref={ref} role="banner" className={`${styles.header}${tabbed ? ` ${styles.withTabs}` : ''}`}>
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
            ? <div className={styles.titleRow}>{nameEl}<span className={styles.switcher}>{place.switcher}</span></div>
            : nameEl}
          {hasMeta && (
            // Each fact is its own span and the separator is drawn BETWEEN siblings (the portal's rule), so a
            // missing fact never strands a dot. The club is the desk bar's only (A4: a phone leaves it off).
            <div className={`${styles.meta}${deskOnly ? ` ${styles.metaDeskOnly}` : ''}`}>
              {club && <span className={styles.metaDesk}>{club}</span>}
              {facts.map(f => <span key={f}>{f}</span>)}
              {deskFacts.map(f => <span key={f} className={styles.metaDesk}>{f}</span>)}
              {dates && <span>{dates}</span>}
              {phaseLabel && (
                <span className={`${coachKit.chip} ${styles.chip} ${tone}`} data-phase={phase ?? undefined}>
                  {phase === 'gameday' && <span className={styles.dot} aria-hidden />}
                  {phaseLabel}
                </span>
              )}
              {place?.chip && <span className={`${styles.chip} ${styles.metaChip}`}>{place.chip}</span>}
            </div>
          )}
        </div>
        {!suspended && <FlipPill resolution={flip} variant="inline" className={styles.pill} />}
      </div>
      {tabbed && <HubTabBar inBar tabs={tabbed.tabs} activeId={tabbed.activeId} ariaLabel={tabbed.ariaLabel} />}
    </header>
  );
}
