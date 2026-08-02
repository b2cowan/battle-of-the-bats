'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { resolveSeasonView } from '@/lib/coach-season-view';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The pinned TEAM MASTHEAD (desktop shell D2 — Option A, owner-picked 2026-08-02 after two
 * rejected shapes; mockup section 08 is the spec).
 *
 * Admin's event header is the recipe: identity with HIERARCHY (quiet eyebrow → one confident
 * name → a mono meta line), not a single line of same-weight fragments. The two rejected
 * shapes each failed one way: an identity strip stuttered a standalone team's name three
 * times; a mirrored page title read as a thin echo of the h1 below it. The masthead repeats
 * the sidebar's identity exactly as admin's repeats its switcher — hierarchy is what makes
 * that presence rather than noise.
 *
 * - Eyebrow: the club's name; a standalone team workspace shows "Coaches Portal" instead,
 *   so the team's name appears exactly once. Org name arrives as a SERVER prop (never from
 *   client org-context — the default-org gotcha mislabeled multi-org coaches).
 * - Meta line: the season YEAR ("2026 season") — never programYearName, which often embeds
 *   the team's name (a third of the original stutter). Archives show a year-only
 *   "2025 · Complete" chip — PRESENTATIONAL, deliberately not a second season switcher:
 *   the page-title chip (Chunk F D-F3/D-F4) is the one switcher, and two focusable
 *   controls for the same action on one screen was a /review-confirmed a11y defect.
 * - A2 (decided fast-follow, not built): record + game-day/next-event join the meta line
 *   from one cached feed.
 * - Sticky against the viewport below the fixed top strip (the document is the portal's one
 *   real scroll container); publishes --coach-header-h; desktop never collapses, phone
 *   collapses to the bare team name with admin's 64/12 hysteresis.
 * - Renders ONLY on /teams/{teamId} paths.
 */
function CoachTeamHeaderInner({
  orgName,
  isTeamWorkspace,
  publicHref,
}: {
  orgName: string;
  isTeamWorkspace: boolean;
  publicHref: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { assignments, closedAssignments, seasons } = useCoaches();
  const headerRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  const teamMatch = pathname?.match(/\/coaches\/teams\/([^/]+)/);
  const teamId = teamMatch?.[1] ?? null;

  // Publish the bar's real height for stacked sticky elements; clean up when the bar leaves
  // (team → hub navigation) so a stale value can't offset anything.
  useEffect(() => {
    const el = headerRef.current;
    const scroller = el?.closest('main');
    if (!el || !scroller) return;
    const publish = () => scroller.style.setProperty('--coach-header-h', `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      scroller.style.removeProperty('--coach-header-h');
    };
  }, [teamId]);

  // Phone-only collapse on DOCUMENT scroll — the portal's one real scroll container
  // (probe-verified 2026-08-01: the shell's inner elements never actually scroll; a
  // listener on them structurally never fires).
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 900px)');
    // One evaluator, run at ATTACH and on BREAKPOINT CHANGE as well as on scroll: a team
    // switch resets scroll without necessarily firing 'scroll' on this listener, and a
    // rotation into the phone breakpoint arrives mid-scroll with no scroll event at all —
    // both left a stale `collapsed` before (/review 2026-08-02).
    const evaluate = () => {
      if (!phone.matches) { setCollapsed(false); return; }
      const y = window.scrollY;
      // Hysteresis (collapse >64, expand <12) — a threshold pair, not a single line, because
      // collapsing changes the bar's height and a single line would flap around it.
      setCollapsed(prev => (prev ? y > 12 : y > 64));
    };
    evaluate();
    window.addEventListener('scroll', evaluate, { passive: true });
    phone.addEventListener('change', evaluate);
    return () => {
      window.removeEventListener('scroll', evaluate);
      phone.removeEventListener('change', evaluate);
    };
  }, [teamId]);

  if (!teamId) return null;

  const live = assignments.find(a => a.teamId === teamId) ?? null;
  const closed = closedAssignments.find(a => a.teamId === teamId) ?? null;
  const teamName = live?.teamName ?? closed?.teamName ?? null;
  if (!teamName) return null;

  const season = resolveSeasonView(seasons, teamId, searchParams.get('year'));
  const year = season.current?.programYearYear ?? null;

  return (
    // role="banner": a <header> nested in <main> gets NO implicit landmark; admin's event
    // header sets this explicitly for the identical mount position (AdminEventHeader:137).
    <header
      ref={headerRef}
      role="banner"
      className={`${styles.teamHeader}${collapsed ? ` ${styles.teamHeaderCollapsed}` : ''}`}
    >
      <div className={styles.teamHeaderLeft}>
        <span className={styles.teamHeaderEyebrow}>
          {isTeamWorkspace ? 'Coaches Portal' : orgName}
        </span>
        <span className={styles.teamHeaderName}>{teamName}</span>
        <div className={styles.teamHeaderMeta}>
          {season.isReadOnly ? (
            /* Presentational — the page-title chip is THE season switcher (see docblock).
               Year-only always: falling back to programYearName would resurrect the
               name-stutter this masthead exists to kill (/review 2026-08-02). */
            <span className={styles.seasonChip}>{year ? `${year} · Complete` : 'Complete'}</span>
          ) : year ? (
            <span>{year} season</span>
          ) : null}
        </div>
      </div>
      {publicHref && (
        <Link href={publicHref} className={styles.teamHeaderFlip}>
          <ArrowLeftRight size={13} aria-hidden />
          Public site
        </Link>
      )}
    </header>
  );
}

export default function CoachTeamHeader(props: {
  orgName: string;
  isTeamWorkspace: boolean;
  publicHref: string | null;
}) {
  // useSearchParams requires a Suspense boundary when rendered from a layout.
  return (
    <Suspense fallback={null}>
      <CoachTeamHeaderInner {...props} />
    </Suspense>
  );
}
