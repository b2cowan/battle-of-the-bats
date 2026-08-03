'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { resolveSeasonView } from '@/lib/coach-season-view';
import { formatRecord } from '@/lib/coach-season-record';
import { mastheadWhen, type MastheadStatus, type MastheadRecord } from '@/lib/coach-masthead-status';
import { EVENT_WORD } from '@/lib/coach-schedule-vocab';
import type { RepEventType } from '@/lib/types';
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
 * - A2 (2026-08-02): the record and the one status that matters today join that line —
 *   "2026 season · 12–4–1 · Game day — Lions, 6:30 p.m." A quiet week adds nothing, and an
 *   archive shows its own frozen final record instead of a status. Both arrive as PROPS from
 *   the team layout's single SSR feed; this component never fetches.
 * - Sticky against the viewport below the fixed top strip (the document is the portal's one
 *   real scroll container); publishes --coach-header-h; desktop never collapses, phone
 *   collapses to the bare team name with admin's 64/12 hysteresis.
 * - Mounted by the TEAM layout, so it exists only under /teams/{teamId}.
 */
function CoachTeamHeaderInner({
  teamId,
  orgName,
  isTeamWorkspace,
  publicHref,
  records,
  status: rawStatus,
  statusYearId,
}: {
  teamId: string;
  orgName: string;
  isTeamWorkspace: boolean;
  publicHref: string | null;
  records: Record<string, MastheadRecord>;
  status: MastheadStatus;
  /** The season `status` was computed for — see the layout's note. Null when there is none. */
  statusYearId: string | null;
}) {
  const searchParams = useSearchParams();
  const { assignments, closedAssignments, seasons } = useCoaches();
  const headerRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

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

  const live = assignments.find(a => a.teamId === teamId) ?? null;
  const closed = closedAssignments.find(a => a.teamId === teamId) ?? null;
  const teamName = live?.teamName ?? closed?.teamName ?? null;
  if (!teamName) return null;

  const season = resolveSeasonView(seasons, teamId, searchParams.get('year'));
  const year = season.current?.programYearYear ?? null;
  // The record OF THE SEASON ON SCREEN — an archive gets its own frozen final tally, never the
  // live season's. Absent from the map means no decided game yet, which renders as nothing: a
  // record of 0–0 is not a record, it is a season that hasn't started.
  const record = season.current ? records[season.current.programYearId] ?? null : null;
  // Only speak for the season this status was actually computed for. A team mid-rollover can hold
  // two live seasons, and the server (which cannot see `?year=`) always builds the feed for the
  // default one — saying nothing beats describing the wrong season's game day (/review 2026-08-02).
  const status = season.current?.programYearId === statusYearId ? rawStatus : null;

  return (
    // role="banner": a <header> nested in <main> gets NO implicit landmark; admin's event
    // header sets this explicitly for the identical mount position (AdminEventHeader:137).
    <header
      ref={headerRef}
      role="banner"
      className={`${styles.teamHeader}${collapsed ? ` ${styles.teamHeaderCollapsed}` : ''}`}
    >
      <div className={styles.teamHeaderLeft}>
        {/* Option B (owner-picked 2026-08-02): NO eyebrow on a standalone team. Its eyebrow could
            only ever read "Coaches Portal" — which is verbatim what the sidebar immediately to its
            left already says, above the same team name, so the masthead was a carbon copy of its
            own neighbour. A club's name IS information, so a club org keeps its eyebrow. */}
        {!isTeamWorkspace && <span className={styles.teamHeaderEyebrow}>{orgName}</span>}
        <span className={styles.teamHeaderName}>{teamName}</span>
        <div className={styles.teamHeaderMeta}>
          {year && <span>{year} season</span>}
          {/* An archive's record is stated on the right, beside its Complete chip. */}
          {!season.isReadOnly && record && (
            <span className={styles.teamHeaderRecord}>{formatRecord(record)}</span>
          )}
        </div>
      </div>

      {/* The right slot — identity left, live status right, admin's event-header pattern. It holds
          the one thing that changes day to day, which is also what stops a standalone team's bar
          being 70% empty space. Same slot in every season state: game day, next up, or Complete. */}
      <div className={styles.teamHeaderRight}>
        {season.isReadOnly ? (
          <>
            {/* Presentational — the page-title chip is THE season switcher (see docblock). No
                status on an archive, ever: a finished season has no next thing, and the archive is
                opt-in — nothing live may be read for or shown on one. */}
            <span className={styles.seasonChip}>Complete</span>
            {record && <span className={styles.teamHeaderStat}>Final {formatRecord(record)}</span>}
          </>
        ) : status?.kind === 'game_day' ? (
          <>
            <span className={styles.teamHeaderToday}>Game day</span>
            <span className={styles.teamHeaderStack}>
              <span className={styles.teamHeaderStackKey}>{gameDayWho(status.event)}</span>
              <span className={styles.teamHeaderStackValue}>
                {mastheadWhen(status.event.startsAt, status.daysAway).time}
              </span>
            </span>
          </>
        ) : status ? (
          <span className={styles.teamHeaderStack}>
            <span className={styles.teamHeaderStackKey}>Next</span>
            <span className={styles.teamHeaderStackValue}>{nextLabel(status)}</span>
          </span>
        ) : null}

        {publicHref && (
          <Link href={publicHref} className={styles.teamHeaderFlip}>
            <ArrowLeftRight size={13} aria-hidden />
            Public site
          </Link>
        )}
      </div>
    </header>
  );
}

/**
 * The status copy (A2). Copy lives HERE and selection lives in `coach-masthead-status` — the
 * Chunk I split, so the tested part stays the part that can be wrong.
 *
 * Sport-neutral by rule: "Game day", never "first pitch"; a league game and a tournament game are
 * both a "game". A game names its opponent when it has one and falls back to the event's own name
 * (which is how a mirrored tournament game reads), so the slot never renders an empty label.
 */
function gameDayWho(event: NonNullable<MastheadStatus>['event']): string {
  return event.opponent?.trim() || event.name?.trim() || 'Game day';
}

function nextLabel(status: NonNullable<MastheadStatus>): string {
  const { day, time } = mastheadWhen(status.event.startsAt, status.daysAway);
  const word = EVENT_WORD[status.event.eventType as RepEventType] ?? 'event';
  return `${day} ${time} ${word}`;
}

export default function CoachTeamHeader(props: {
  teamId: string;
  orgName: string;
  isTeamWorkspace: boolean;
  publicHref: string | null;
  records: Record<string, MastheadRecord>;
  status: MastheadStatus;
  /** The season `status` was computed for — see the layout's note. Null when there is none. */
  statusYearId: string | null;
}) {
  // useSearchParams requires a Suspense boundary when rendered from a layout.
  return (
    <Suspense fallback={null}>
      <CoachTeamHeaderInner {...props} />
    </Suspense>
  );
}
