'use client';

/**
 * Shared admin header ("The Flip") — one persistent header across the whole admin shell (desktop +
 * mobile), so the flip door to the public side is always in the same top-right spot and never
 * disappears. Shows event identity (an eyebrow with the org and the dates, the tournament name and its
 * live/open/draft chip) with the FlipPill anchored top-right; on non-tournament screens it shows the org
 * instead and the pill flips to the org's public site. On a phone it collapses to a slim name + chip +
 * pill strip on scroll and expands back at the top — mirroring the public event header. Supersedes the
 * old mobile top bar and the floating desktop pill. Not rendered on focused shells (onboarding/help/preview).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FlipPill from '@/components/shared/FlipPill';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useAdminFlip } from '@/lib/use-admin-flip';
import { resolvePhase, isGameDay, PHASE_LABEL } from '@/lib/tournament-phase';
import { formatEventDateRange } from '@/lib/timezone';
import { kit as coachKit } from '@/components/coaches/kit';
import styles from './kit/AdminKitEventHeader.module.css';

/** Nearest scrollable ancestor (the app-shell scroll container on mobile), or null. */
function getScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === 'auto' || oy === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

export default function AdminEventHeader() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();
  const flip = useAdminFlip();
  const ref = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Collapse once the content is scrolled a little. The shell scrolls the document on desktop and an
  // inner container (.adminMain) on mobile — a capture-phase window listener catches both, and we read
  // whichever moved. Also reset the inner scroller on navigation (the router doesn't reset it, so a new
  // page could otherwise open mid-scroll / pre-collapsed) and re-find it across the 900px breakpoint.
  useEffect(() => {
    let scroller = ref.current ? getScrollParent(ref.current) : null;
    let raf = 0;
    // Desktop has the room, so the header stays full even on scroll (owner call) — only mobile
    // condenses. Hysteresis (mobile): collapse past 64px, expand only below 12px. The 52px dead-zone is
    // wider than the header's collapse height change, so it can't bounce back across the line ("shake").
    const mq = window.matchMedia('(max-width: 900px)');
    const read = () => {
      if (!mq.matches) { setCollapsed(false); return; }
      const y = Math.max(window.scrollY || 0, scroller?.scrollTop || 0);
      setCollapsed(prev => (prev ? y > 12 : y > 64));
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(read); };
    const onResize = () => { scroller = ref.current ? getScrollParent(ref.current) : null; read(); };
    scroller?.scrollTo(0, 0);
    read();
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [pathname]);

  // Publish the rendered header height so in-page sticky toolbars can stick BELOW it (via
  // `top: var(--admin-header-h)`) instead of being buried under it. Tracks the collapse height change.
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
    pathname.includes('/admin/tournaments') &&
    !pathname.includes('/admin/tournaments/preview') &&
    !!currentTournament?.slug;

  let title: string;
  let eyebrow: string | null = null; // small org line above the name (tournament screens)
  let sub: string | null = null;     // date range (tournament screens)
  let titleHref: string | null = null;
  let phase: string | null = null;
  let phaseLabel: string | null = null;

  if (onTournament && currentTournament) {
    title = currentTournament.name;
    eyebrow = currentOrg?.name ?? null;
    // ONE chip from ONE rule — the board's (G1): the dates, OR the first game having started, until the
    // event is marked complete. It used to read the dates alone, so after the last day it said "Open"
    // while the dashboard below it said game day.
    phase = resolvePhase({
      status: currentTournament.status,
      isGameDay: isGameDay({
        startDate: currentTournament.startDate,
        endDate: currentTournament.endDate,
        firstGameStarted: Boolean(currentTournament.firstGameStarted),
      }),
    });
    phaseLabel = PHASE_LABEL[phase as keyof typeof PHASE_LABEL] ?? null;
    sub = formatEventDateRange(currentTournament.startDate, currentTournament.endDate, true);
    titleHref = `/${currentOrg?.slug ?? ''}/admin/tournaments/dashboard`;
  } else {
    // Org-level screens: the org IS the identity, so it's the title (no redundant eyebrow/status).
    title = currentOrg?.name ?? 'Admin';
  }

  // The link wraps the name rather than being it: the name clamps its lines, and the link's own box is
  // free to grow into a thumb's target on a touch screen without un-clamping them.
  const nameEl = (cls: string) =>
    titleHref
      ? <Link href={titleHref} className={styles.nameLink} title={`${title} — open dashboard`}><span className={cls}>{title}</span></Link>
      : <span className={cls}>{title}</span>;

  // ADC specimen 2: "today's event header, drawn as the kit's page header: an eyebrow, a title and one
  // status chip. The same phase rule and the same dates; only the skin changes." The org and the dates
  // share the eyebrow; the phase chip sits beside the name in the kit's chip (red for a live event, as
  // drawn in specimen 4; olive while open; quiet otherwise). One structure — no DOM swap on scroll (that
  // caused the jitter): the collapse is a class, and the effects above publish the height it leaves.
  const tone = phase === 'gameday' ? coachKit.chipDanger : phase === 'open' ? coachKit.chipGood : styles.chipNeutral;
  // Tournament admin redesign G1 (2026-09-29): the chip sits on the DATES line, and on a phone the
  // organization's name stays on the desk header only — so a phone header is two lines, dates + chip
  // over the name. Once a phone scrolls, the dates line folds away; the chip moves up beside the name
  // (a second copy, hidden from assistive tech) so the status never scrolls out of the header.
  const chip = (copy: 'dates' | 'collapsed') => phaseLabel && (
    <span
      className={`${coachKit.chip} ${styles.chip} ${tone} ${copy === 'dates' ? styles.chipOnDates : styles.chipCollapsed}`}
      data-phase={phase ?? undefined}
      aria-hidden={copy === 'collapsed' || undefined}
    >
      {phase === 'gameday' && <span className={styles.dot} aria-hidden />}
      {phaseLabel}
    </span>
  );
  const hasEyebrow = Boolean(eyebrow || sub || phaseLabel);
  return (
    <header ref={ref} role="banner" className={`${styles.header} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.row}>
        <div className={styles.identity}>
          {hasEyebrow && (
            <div className={styles.eyebrow}>
              {eyebrow && <span className={styles.eyebrowOrg}>{eyebrow}{sub ? ' · ' : ''}</span>}
              {sub && <span>{sub}</span>}
              {chip('dates')}
            </div>
          )}
          <div className={styles.titleRow}>
            {nameEl(styles.name)}
            {chip('collapsed')}
          </div>
        </div>
        <FlipPill resolution={flip} variant="inline" compact={collapsed} className={styles.pill} />
      </div>
    </header>
  );
}
