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
 * line is a second line in the bar (A2 = a): dates · chip, and it never folds away. On every other screen
 * the bar shows the organization's name alone (Phase 2 hands it each club place's name, facts and tabs).
 *
 * ⚠ NO SCROLL COLLAPSE, anywhere (owner 2026-11-07, the portal took it out 2026-09-21): the collapse made
 * content jump under the thumb. The bar's height changes only when you navigate, never on scroll, and
 * `--admin-header-h` publishes it for the in-page sticky toolbars.
 *
 * HEADING SEMANTICS. On club screens the bar's name is the page's `<h1>`; inside a tournament the name stays
 * a link and the page's own title (Teams, Schedule…) stays the `<h1>` on the paper. ⚠ Phase 1: the bar's
 * name is the `<h1>` on the club's Overview ONLY (its paper heading is gone, A3). Every other club screen
 * still draws its own paper heading until Phase 2 hands its title to the bar, and two `<h1>`s on one page
 * is the defect to avoid — so the name is a `<span>` there.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FlipPill from '@/components/shared/FlipPill';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useAdminFlip } from '@/lib/use-admin-flip';
import { resolveEventPhase, PHASE_LABEL } from '@/lib/tournament-phase';
import { formatEventDateRange } from '@/lib/timezone';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { kit as coachKit } from '@/components/coaches/kit';
import styles from './kit/AdminKitEventHeader.module.css';

export default function AdminEventHeader({ suspended = false }: {
  /** A cancelled account (`AdminChrome` decides): the org's name alone — no tournament identity, no door to a public
   *  site whose pages are suspended. */
  suspended?: boolean;
} = {}) {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();
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
  } else {
    // Org-level screens: the org IS the identity, so it's the title (no small line until Phase 2 names a place).
    title = currentOrg?.name ?? 'Admin';
  }

  // The link wraps the name rather than being it: the name clamps its lines, and the link's own box is
  // free to grow into a thumb's target on a touch screen without un-clamping them.
  const name = onOverview
    ? <h1 className={styles.name}>{title}</h1>
    : <span className={styles.name}>{title}</span>;
  const nameEl = titleHref
    ? <Link href={titleHref} className={styles.nameLink} title={`${title} — open dashboard`}>{name}</Link>
    : name;

  // The phase chip keeps its shipped look: red for a live event, olive while open, quiet otherwise.
  const tone = phase === 'gameday' ? coachKit.chipDanger : phase === 'open' ? coachKit.chipGood : styles.chipNeutral;
  const hasMeta = Boolean(club || dates || phaseLabel);
  return (
    <header ref={ref} role="banner" className={styles.header}>
      <div className={styles.row}>
        <div className={styles.identity}>
          {nameEl}
          {hasMeta && (
            // Each fact is its own span and the separator is drawn BETWEEN siblings (the portal's rule), so a
            // missing fact never strands a dot. The club is the desk bar's only (A4: a phone leaves it off).
            <div className={styles.meta}>
              {club && <span className={styles.metaClub}>{club}</span>}
              {dates && <span>{dates}</span>}
              {phaseLabel && (
                <span className={`${coachKit.chip} ${styles.chip} ${tone}`} data-phase={phase ?? undefined}>
                  {phase === 'gameday' && <span className={styles.dot} aria-hidden />}
                  {phaseLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {!suspended && <FlipPill resolution={flip} variant="inline" className={styles.pill} />}
      </div>
    </header>
  );
}
