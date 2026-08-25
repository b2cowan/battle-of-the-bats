'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { resolveLiveSeason, resolveClosedSeason } from '@/lib/coach-season-view';
import { mastheadSeasonLabel } from '@/lib/coach-season-label';
import { formatRecord } from '@/lib/coach-season-record';
import {
  mastheadWhen,
  type MastheadGameDayConsole, type MastheadStatus, type MastheadRecord, type MastheadScoutingNudge,
} from '@/lib/coach-masthead-status';
import { EVENT_WORD } from '@/lib/coach-schedule-vocab';
import { formatInOrgZone } from '@/lib/timezone';
import { useCoachNudgeDismiss } from '@/components/coaches/useCoachNudgeDismiss';
import { CoachPageHelpSlot } from '@/components/coaches/CoachPageHelpSlot';
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
 * - ⚠ TWO LINES, NOT THREE, since 2026-08-18 (header vertical-space pass, direction B). The
 *   club's name was its own eyebrow ABOVE the team name; it is now the first segment of the
 *   meta line BELOW it. Nothing left the bar — the club is still named on every team page,
 *   which is the promise made when it left the sidebar in the 2026-08-17 slimdown — but the
 *   hierarchy is two levels now (one confident name over one quiet line) rather than three.
 *   This is what fixed the 98px finished-season phone bar, where "Complete" and the final
 *   record were being pushed onto a third line. Org name arrives as a SERVER prop (never from
 *   client org-context — the default-org gotcha mislabeled multi-org coaches), and a standalone
 *   team workspace renders no club segment at all, so its name still appears exactly once.
 * - Meta line: club · season · record. The season is the YEAR ("2026 season") — never
 *   programYearName, which often embeds the team's name (a third of the original stutter). A
 *   team whose working season has FINISHED shows a "Complete" chip here — PRESENTATIONAL, and
 *   since 2026-08-16 the ONLY place the portal says so: the page-title chip that used to repeat
 *   it was the season switcher wearing a label, and it died with the archive as a place
 *   (P2, Design A).
 * - A2 (2026-08-02): the record and the one status that matters today join that line —
 *   "2026 season · 12–4–1 · Game day — Lions, 6:30 p.m." A quiet week adds nothing, and a
 *   finished season shows its own final record instead of a status. Both arrive as PROPS from
 *   the team layout's single SSR feed; this component never fetches.
 * - Sticky against the viewport below the fixed top strip (the document is the portal's one
 *   real scroll container); publishes --coach-header-h; DESKTOP NEVER COLLAPSES, phone collapses
 *   to the bare team name with admin's 64/12 hysteresis. ⚠ A desktop collapse was built on
 *   2026-08-18 and reverted by the owner on sight the next day — see the effect's own note.
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
  scoutingNudge,
  gameDayConsole,
}: {
  teamId: string;
  orgName: string;
  isTeamWorkspace: boolean;
  publicHref: string | null;
  records: Record<string, MastheadRecord>;
  status: MastheadStatus;
  /** The season `status` was computed for — see the layout's note. Null when there is none. */
  statusYearId: string | null;
  /** Game-week book nudge (Scouting Book P2) — computed only for the status's own season. */
  scoutingNudge: MastheadScoutingNudge | null;
  /** Game-Day Mode (P1): the console link, present only inside the game's live window. */
  gameDayConsole: MastheadGameDayConsole | null;
}) {
  const { assignments, closedAssignments } = useCoaches();
  const headerRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Once per GAME, on-device (the portal's one dismiss idiom) — a new game week mints a new
  // event id, so the nudge returns for the next opponent without any expiry bookkeeping.
  // Called unconditionally (rules of hooks); the placeholder key is never written.
  const nudgeDismiss = useCoachNudgeDismiss(teamId, `scouting_book:${scoutingNudge?.eventId ?? 'none'}`);

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
  //
  // ⚠⚠ DESKTOP COLLAPSE WAS BUILT AND REVERTED ON 2026-08-19 — DO NOT RE-PROPOSE IT AS A SPACE
  // SAVING. The header vertical-space pass (direction A) removed this width gate so the bar
  // slimmed to ~40px while scrolling at every width; it worked, it was measured (−34px of pinned
  // chrome), it passed review, and the owner rejected it ON SIGHT: *"I like the size changes we
  // made but you can leave this header as is when scrolling."* The identity bar staying put is
  // worth more than the pixels it costs. The pixels that SURVIVED that pass are the ones taken
  // from the bar's own height (three lines to two) and from the page-title band — space reclaimed
  // by making things smaller, not by making them disappear and come back.
  //
  // One evaluator, run at ATTACH and on BREAKPOINT CHANGE as well as on scroll: a team
  // switch resets scroll without necessarily firing 'scroll' on this listener, and a
  // rotation into the phone breakpoint arrives mid-scroll with no scroll event at all —
  // both left a stale `collapsed` before (/review 2026-08-02).
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 900px)');
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

  /**
   * ⚠ COLLAPSING CAN PULL THE FLOOR OUT FROM UNDER KEYBOARD FOCUS (/review 2026-08-19).
   *
   * Two controls live inside the parts a collapse hides — the "Public site" flip and the book
   * nudge's dismiss button. A keyboard user can be ON one of them and still scroll the page
   * (space, PageDown, arrows, a screen reader's own scrolling). The moment `collapsed` flips, that
   * control is `display:none`, which drops it out of the accessibility tree AND out of focus —
   * the browser silently resets focus to <body>, so the next Tab restarts from the top of the
   * document with nothing to say where focus went.
   *
   * The bar itself becomes the landing spot: it is still on screen, it is the nearest thing that
   * survived, and `preventScroll` stops the focus move from fighting the scroll that caused it.
   * `offsetParent === null` is the cheap "did this element actually get hidden" test — it is null
   * exactly when an ancestor is display:none, which is the case being repaired.
   *
   * ⚠ THIS STAYS EVEN THOUGH THE DESKTOP COLLAPSE WAS REVERTED (2026-08-19). The bug is a PHONE
   * bug and always was — live since 2026-08-02, found only because a review looked at the desktop
   * version. Reverting the thing that exposed it does not unfix it.
   */
  useEffect(() => {
    if (!collapsed) return;
    const el = headerRef.current;
    const active = document.activeElement as HTMLElement | null;
    if (!el || !active || !el.contains(active)) return;
    if (active.offsetParent !== null) return; // still visible — the collapse did not hide it
    el.focus({ preventScroll: true });
  }, [collapsed]);

  const live = assignments.find(a => a.teamId === teamId) ?? null;
  const closed = closedAssignments.find(a => a.teamId === teamId) ?? null;
  const teamName = live?.teamName ?? closed?.teamName ?? null;
  if (!teamName) return null;

  // The season the masthead is describing: the LIVE one, or the newest closed one when the team
  // has none. Both come from the shared resolvers so the header cannot name a different season
  // from the page under it.
  const liveSeason = resolveLiveSeason(assignments, teamId);
  const closedSeason = resolveClosedSeason(assignments, closedAssignments, teamId);
  const season = liveSeason ?? closedSeason;
  /**
   * ⚠ The team has NO LIVE SEASON, which since 2026-08-18 means its portal is one page. The chip
   * below is the masthead's half of saying so — the only place a finished season is named — and it
   * is keyed on the RESOLVERS rather than on a flag the season carries, because the flag
   * (`isReadOnly`) is gone with the twenty-nine read-only branches it existed to drive.
   */
  const seasonFinished = !liveSeason && !!closedSeason;
  const year = season?.programYearYear ?? null;
  // Page-header ruling 2026-08-11: the masthead owns the season AND the role, so no page
  // subtitle ever restates either. Both resolve HERE, client-side, for the season on screen.
  //  · Season text: an org's NAMED season ("Fall Ball 2026", "2026 Season") renders verbatim
  //    (team-name prefix stripped — the stutter the old year-only rule guarded against); a
  //    bare-year name keeps the classic "{year} season". This supersedes the "never
  //    programYearName" half of the meta-line rule in the docblock above.
  //  · Role: read off the RESOLVED season (CoachSeasonOption carries coachRole beside
  //    capabilities, for the same per-season reason) — never a second search of the
  //    assignment arrays, which is how a mid-rollover team gets described wrong. Falls back
  //    to the team's assignment only while the season is still resolving.
  const seasonRole = season?.coachRole ?? (live ?? closed)?.coachRole ?? null;
  const roleLabel = seasonRole
    ? (seasonRole === 'head_coach' ? 'Head Coach' : 'Assistant Coach')
    : null;
  const seasonText = mastheadSeasonLabel(season?.programYearName, teamName, year);
  // The record OF THE SEASON ON SCREEN — an archive gets its own frozen final tally, never the
  // live season's. Absent from the map means no decided game yet, which renders as nothing: a
  // record of 0–0 is not a record, it is a season that hasn't started.
  const record = season ? records[season.programYearId] ?? null : null;
  // Only speak for the season this status was actually computed for. A team mid-rollover can hold
  // two live seasons, and the server (which cannot see `?year=`) always builds the feed for the
  // default one — saying nothing beats describing the wrong season's game day (/review 2026-08-02).
  const status = season?.programYearId === statusYearId ? rawStatus : null;

  // Game-Day Mode (P1): inside the live window the status line becomes the door to the bench
  // console — gated on the SAME status it decorates, and on the very event it names, so it can
  // never link a different game than the words describe. Outside the window it is plain text
  // again, absent rather than disabled. ONE copy of the line; only the wrapper changes.
  const consoleHref = status?.kind === 'game_day' && gameDayConsole?.eventId === status.event.id
    ? gameDayConsole.href
    : null;
  const gameDayLine = status?.kind === 'game_day' ? (
    <>
      <span className={styles.teamHeaderToday}>Game day</span>
      <span className={styles.teamHeaderStack}>
        <span className={styles.teamHeaderStackKey}>{gameDayWho(status.event)}</span>
        <span className={styles.teamHeaderStackValue}>
          {mastheadWhen(status.event.startsAt, status.daysAway).time}
          {consoleHref ? ' · Open the bench ›' : ''}
        </span>
      </span>
    </>
  ) : null;

  return (
    /* role="banner": a <header> nested in <main> gets NO implicit landmark; admin's event
       header sets this explicitly for the identical mount position (AdminEventHeader:137). */
    <header
      ref={headerRef}
      role="banner"
      /* -1: never in the tab order, but focusable as the landing spot when a collapse hides the
         control that had focus (see the effect above). */
      tabIndex={-1}
      className={`${styles.teamHeader}${collapsed ? ` ${styles.teamHeaderCollapsed}` : ''}`}
    >
      <div className={styles.teamHeaderRow}>
        <div className={styles.teamHeaderLeft}>
          <span className={styles.teamHeaderNameRow}>
            <span className={styles.teamHeaderName}>{teamName}</span>
            {/* Who you are here — identity, so it rides the identity bar on every page
                (2026-08-11; previously the Overview subtitle). Folds on the collapsed bar. */}
            {roleLabel && <span className={styles.teamHeaderRole}>{roleLabel}</span>}
          </span>
          <div className={styles.teamHeaderMeta}>
            {/* The club, FIRST segment of the meta line (2026-08-18, direction B — it used to be
                its own eyebrow line above the name). Still absent on a standalone team workspace:
                its only possible value there is "Coaches Portal", which the top strip already says
                beside the wordmark, so the bar would be a carbon copy of its own chrome. A club's
                name IS information, and since the 2026-08-17 slimdown this is the ONLY place the
                club is named — which is why B MOVED it rather than dropping it.
                ⚠ It joins the same sibling list as the season and the record, so the dot separator
                (drawn between siblings, never punctuated into a string) still cannot orphan a dot
                when this segment is absent. */}
            {!isTeamWorkspace && <span>{orgName}</span>}
            {seasonText && <span>{seasonText}</span>}
            {/* An archive's record is stated on the right, beside its Complete chip. */}
            {!seasonFinished && record && (
              <span className={styles.teamHeaderRecord}>{formatRecord(record)}</span>
            )}
          </div>
        </div>

        {/* The right slot — identity left, live status right, admin's event-header pattern. It holds
            the one thing that changes day to day, which is also what stops a standalone team's bar
            being 70% empty space. Same slot in every season state: game day, next up, or Complete. */}
        <div className={styles.teamHeaderRight}>
          {/* ⚠ THE STATUS DOES NOT RENDER AT PHONE WIDTH — owner ruling 2026-08-24, game day
              included. This wrapper is `display: contents` above 640 (so the chip/stack stay
              direct flex children of the row and desktop is byte-identical) and `display: none`
              below it. It exists for ONE reason: the public-site flip beneath is a DOOR, not a
              fact, and hiding `.teamHeaderRight` wholesale would have taken it too — the kind of
              thing a width rule removes silently. See `.teamHeaderStatus` for why the slot is
              removed rather than shrunk, and where the bench console's other phone doors are. */}
          <span className={styles.teamHeaderStatus}>
            {seasonFinished ? (
              <>
                {/* Presentational, and the ONE place a finished season is named (see docblock). No
                    status on a season that has ended: it has no next thing, and nothing live may be
                    read for it. */}
                <span className={styles.seasonChip}>Complete</span>
                {record && <span className={styles.teamHeaderStat}>Final {formatRecord(record)}</span>}
              </>
            ) : gameDayLine ? (
              consoleHref
                ? <Link href={consoleHref} className={styles.teamHeaderConsoleLink}>{gameDayLine}</Link>
                : gameDayLine
            ) : status ? (
              <span className={styles.teamHeaderStack}>
                <span className={styles.teamHeaderStackKey}>Next</span>
                <span className={styles.teamHeaderStackValue}>{nextLabel(status)}</span>
              </span>
            ) : null}
          </span>

          {publicHref && (
            <Link href={publicHref} className={styles.teamHeaderFlip}>
              <ArrowLeftRight size={13} aria-hidden />
              Public site
            </Link>
          )}

          {/* The page's help "?" — moved out of the page-title band 2026-08-25 (owner ruling;
              `COACH_PAGE_TITLE_BAND_PLAN.md` §5). It is drawn LAST, after the status stack and
              after the flip, so the 2026-08-11 clause — "its own slot, always LAST, top-right at
              every width" — reads literally rather than approximately.

              ⚠ OUTSIDE `.teamHeaderStatus` on purpose. That wrapper is `display: none` at ≤640
              (the 2026-08-24 status ruling); the "?" is not a status and must survive there.
              ⚠ It DOES fold with `.teamHeaderCollapsed` at ≤900, like the flip beside it — ruled,
              and the 2026-08-02 bare-name collapse is deliberately not reopened.
              ⚠ Renders nothing until a page publishes: a screen with no help topic leaves this
              corner empty rather than offering a door onto nothing. */}
          <CoachPageHelpSlot />
        </div>
      </div>

      {/* Game-week book nudge (Scouting Book P2, mockup Stage 6; re-anchored into the sticky bar
          2026-08-11): an attached row, not a floating card in page flow beneath it. Gated on the
          SAME `status` the bar renders from, so it can never speak for an archive or a mismatched
          ?year= season — and only for the very game the status names. When the status is already
          the Game-day line, that line has named the opponent and "today" already, so the row
          leads with the one new fact instead of repeating them. */}
      {status && scoutingNudge && scoutingNudge.eventId === status.event.id && !nudgeDismiss.dismissed && (
        <div className={styles.teamHeaderNudge}>
          <Link href={scoutingNudge.href} className={styles.teamHeaderNudgeLink}>
            {status.kind === 'game_day' ? (
              <>
                <b>{scoutingNudge.observationCount}</b> observation{scoutingNudge.observationCount === 1 ? '' : 's'} in the book ›
              </>
            ) : (
              <>
                You play {scoutingNudge.opponentName} {nudgeDay(status.event.startsAt, status.daysAway)} —{' '}
                {scoutingNudge.observationCount} observation{scoutingNudge.observationCount === 1 ? '' : 's'} in the book ›
              </>
            )}
          </Link>
          <button
            type="button"
            className={styles.teamHeaderNudgeDismiss}
            aria-label="Dismiss book reminder"
            title="Dismiss"
            onClick={nudgeDismiss.dismiss}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </header>
  );
}

/** "today" / "tomorrow" / "Saturday" — the nudge is a sentence, so the day is a word in it. */
function nudgeDay(startsAt: string, daysAway: number): string {
  if (daysAway === 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return formatInOrgZone(startsAt, { weekday: 'long' });
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

/**
 * ⚠ The Suspense boundary that wrapped this is GONE with the `?year=` read (P2, 2026-08-16).
 * `useSearchParams()` forces one on any component rendered from a layout, and this component's
 * only reason to call it was resolving which season the coach had dialled to. There is no dial.
 */
export default CoachTeamHeaderInner;
