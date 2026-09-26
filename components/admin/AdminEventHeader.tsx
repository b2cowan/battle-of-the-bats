'use client';

/**
 * Shared admin header ("The Flip") — one persistent header across the whole admin shell (desktop +
 * mobile), so the flip door to the public side is always in the same top-right spot and never
 * disappears. Shows event identity (monogram + tournament name + live/open/draft state + a date-range
 * meta line) with the FlipPill anchored top-right; on non-tournament screens it shows the org instead
 * and the pill flips to the org's public site. Collapses to a slim name + state + pill strip on scroll
 * and expands back at the top — mirroring the public event header. Supersedes the old mobile top bar
 * and the floating desktop pill. Not rendered on focused shells (onboarding/help/preview).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FlipPill from '@/components/shared/FlipPill';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { useAdminFlip } from '@/lib/use-admin-flip';
import { resolvePhase, isWithinEventDates, PHASE_LABEL } from '@/lib/tournament-phase';
import { useAdminKit } from '@/components/admin/AdminKitProvider';
import { kit as coachKit } from '@/components/coaches/kit';
import styles from './AdminEventHeader.module.css';
import kitStyles from './kit/AdminKitEventHeader.module.css';

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

/** Compact date range for the meta line. Parses at noon to avoid a timezone day-shift on display. */
function dateRange(start?: string | null, end?: string | null): string | null {
  const parse = (d: string) => new Date(d.includes('T') ? d : `${d}T12:00:00`);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
  if (!start) return null;
  const s = parse(start);
  if (Number.isNaN(s.getTime())) return null;
  if (!end) return fmt(s, true);
  const e = parse(end);
  if (Number.isNaN(e.getTime())) return fmt(s, true);
  if (s.getTime() === e.getTime()) return fmt(s, true);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${fmt(s, !sameYear)} – ${fmt(e, true)}`;
}

export default function AdminEventHeader() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();
  const flip = useAdminFlip();
  const kit = useAdminKit();
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
    phase = resolvePhase({
      status: currentTournament.status,
      isGameDay: isWithinEventDates(currentTournament.startDate, currentTournament.endDate),
    });
    phaseLabel = PHASE_LABEL[phase as keyof typeof PHASE_LABEL] ?? null;
    sub = dateRange(currentTournament.startDate, currentTournament.endDate);
    titleHref = `/${currentOrg?.slug ?? ''}/admin/tournaments/dashboard`;
  } else {
    // Org-level screens: the org IS the identity, so it's the title (no redundant eyebrow/status).
    title = currentOrg?.name ?? 'Admin';
  }

  const nameEl = (cls: string) =>
    titleHref
      ? <Link href={titleHref} className={cls} title={`${title} — open dashboard`}>{title}</Link>
      : <span className={cls}>{title}</span>;

  // ── The kit form (Admin Design Continuity slice 1, switch on) — ADC specimen 2: "today's event
  // header, drawn as the kit's page header: an eyebrow, a title and one status chip. The same phase
  // rule and the same dates; only the skin changes." The org and the dates share the eyebrow; the
  // phase chip sits beside the name in the kit's chip (red for a live event, as drawn in specimen 4;
  // olive while open; quiet otherwise). Same element, same ref, same collapse — the effects above
  // serve both forms, so the sticky offset and the published height cannot drift between them.
  if (kit) {
    const tone = phase === 'gameday' ? coachKit.chipDanger : phase === 'open' ? coachKit.chipGood : kitStyles.chipNeutral;
    const eyebrowLine = [eyebrow, sub].filter(Boolean).join(' · ');
    return (
      <header ref={ref} role="banner" className={`${kitStyles.header} ${collapsed ? kitStyles.collapsed : ''}`}>
        <div className={kitStyles.row}>
          <div className={kitStyles.identity}>
            {eyebrowLine && <div className={kitStyles.eyebrow}>{eyebrowLine}</div>}
            <div className={kitStyles.titleRow}>
              {nameEl(kitStyles.name)}
              {phaseLabel && (
                <span className={`${coachKit.chip} ${kitStyles.chip} ${tone}`} data-phase={phase ?? undefined}>
                  {phase === 'gameday' && <span className={kitStyles.dot} aria-hidden />}
                  {phaseLabel}
                </span>
              )}
            </div>
          </div>
          <FlipPill resolution={flip} variant="inline" compact={collapsed} className={kitStyles.pill} />
        </div>
      </header>
    );
  }

  // ONE structure (no DOM swap on scroll — that caused the jitter). The eyebrow + meta rows fade via
  // CSS on collapse, the name shrinks 2→1 line, and the pill drops to its ⇄ glyph — all transitioned.
  return (
    <header ref={ref} role="banner" className={`${styles.header} ${collapsed ? styles.collapsed : ''}`}>
      {eyebrow && (
        <div className={styles.eyebrowRow}>
          <span className={styles.org}>{eyebrow}</span>
        </div>
      )}
      <div className={styles.mainRow}>
        {nameEl(styles.name)}
        <FlipPill resolution={flip} variant="inline" compact={collapsed} className={styles.pill} />
      </div>
      {(phaseLabel || sub) && (
        <div className={styles.meta}>
          {phaseLabel && (
            <span className={styles.status} data-phase={phase ?? undefined}>
              {phase === 'gameday' && <span className={styles.dot} aria-hidden />}
              {phaseLabel}
            </span>
          )}
          {sub && <span className={styles.date}>{sub}</span>}
        </div>
      )}
    </header>
  );
}
