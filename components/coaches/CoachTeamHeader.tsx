'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, ChevronDown, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { resolveLiveSeason, resolveClosedSeason } from '@/lib/coach-season-view';
import { mastheadSeasonLabel } from '@/lib/coach-season-label';
import { formatRecord } from '@/lib/coach-season-record';
import {
  mastheadWhen,
  type MastheadGameDayConsole, type MastheadStatus, type MastheadRecord, type MastheadScoutingNudge,
} from '@/lib/coach-masthead-status';
import { eventWord } from '@/lib/coach-schedule-vocab';
import { formatInOrgZone } from '@/lib/timezone';
import { useCoachNudgeDismiss } from '@/components/coaches/useCoachNudgeDismiss';
import { CoachPageHelpSlot } from '@/components/coaches/CoachPageHelpSlot';
import CoachTeamSwitchSheet from '@/components/coaches/CoachTeamSwitchSheet';
import { useDismissable } from '@/lib/overlay-hooks';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
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
 *   real scroll container); publishes --coach-header-h; THE BAR NEVER CHANGES SHAPE UNDER SCROLL,
 *   at any width (desktop: owner ruling 2026-08-19; phone and tablet: phone re-evaluation stage 1
 *   · B2, owner ruling 2026-09-21 — see the note where the collapse effect used to be).
 * - ON A PHONE (≤640) IT IS ONE 36px LINE ON EVERY SCREEN — name · record · "?" — the Overview
 *   included (stage 1 · B2 = "B, one line everywhere"). The Overview's club · season line is not
 *   lost: it renders as an UNPINNED page line directly under the bar, same words, same place at
 *   rest, and scrolls away with the page instead of snapping. See `teamHeaderPageLine`.
 * - THE TEAM NAME IS THE SWITCHER'S DOOR ON A PHONE (stage 1 · B1): with two or more teams it
 *   renders as a button with a chevron and opens `CoachTeamSwitchSheet` — the More sheet's own
 *   rows, moved. One team: plain text. Desktop: the sidebar's select, untouched.
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
  // ONE IDENTITY LINE ON A PHONE (stage 0 · A2, 2026-09-20; extended to the Overview by stage 1 · B2,
  // 2026-09-21). Two facts about the page under the bar, read from the address: is this the team's
  // Overview (which gets the unpinned club · season page line under the bar), and is this an open
  // chat room (no masthead at ≤640 — the room header is the identity there). Both are CSS classes
  // gated at ≤640 in the stylesheet, never a JS media query, so the server and the first client
  // frame agree.
  const pathname = usePathname() ?? '';
  const onOverview = /\/coaches\/teams\/[^/]+\/?$/.test(pathname);
  const onChat = /\/coaches\/teams\/[^/]+\/chat(?:\/|$)/.test(pathname);
  // The switcher (stage 1 · B1): a phone-only door on the team name, offered only when there is
  // somewhere to switch TO. `useIsPhoneNav` defaults to true so the server renders the button and a
  // desktop swaps it for plain text after mount — the chevron is display:none above 900, so the
  // swap moves nothing. The sheet lives inside `switchRef` so one dismiss boundary covers the
  // button, and `switchSheetRef` the scrim and the panel (the sheet's scrim is a tap INSIDE the
  // boundary that closes it, exactly as the More sheet's does).
  // The sheet remembers the ADDRESS it was opened on rather than a boolean: a switch is a
  // navigation, and the sheet closes with the address (as More does) with no effect to write —
  // the derived `switchOpen` is simply false on the next page.
  const isPhoneNav = useIsPhoneNav();
  const [switchOpenAt, setSwitchOpenAt] = useState<string | null>(null);
  const switchOpen = switchOpenAt === pathname;
  const switchRef = useRef<HTMLSpanElement>(null);
  const switchSheetRef = useRef<HTMLDivElement>(null);
  const switchButtonRef = useRef<HTMLButtonElement>(null);
  const closeSwitch = () => setSwitchOpenAt(null);
  // Two boundaries, not one: the button sits inside the sticky header and the sheet is rendered
  // OUTSIDE it (see the fragment below), so "outside" means outside both.
  useDismissable(switchOpen, [switchRef, switchSheetRef], closeSwitch, () => {
    setSwitchOpenAt(null);
    switchButtonRef.current?.focus({ preventScroll: true });
  });
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

  // ⚠⚠ THE SCROLL COLLAPSE IS GONE AT EVERY WIDTH — DO NOT RE-PROPOSE IT AS A SPACE SAVING.
  // Two rulings, one reason. DESKTOP (2026-08-19): a collapse was built, measured (−34px of pinned
  // chrome), passed review, and the owner rejected it on sight — "you can leave this header as is
  // when scrolling"; the identity bar staying put is worth more than the pixels. PHONE + TABLET
  // (2026-09-21, phone re-evaluation stage 1 · B2 — the owner asked for the Overview's thinning
  // two-line bar on every screen and chose the opposite once both were drawn at true size): what
  // lived here was a threshold toggle with hysteresis (collapse past 64px of scroll, expand under
  // 12), so the bar did not shrink, it SNAPPED 59→36 — a 23px content jump under the thumb, twice
  // per pass — and the collapsed form hid the whole right slot including the "?". The space that
  // survives came from making the bar smaller (one line, stage 0 · A2), not from chrome that
  // vanishes and returns. The focus-repair effect that lived beside it (a collapse could hide the
  // control that had focus) went with it: nothing hides on scroll any more.
  const live = assignments.find(a => a.teamId === teamId) ?? null;
  const closed = closedAssignments.find(a => a.teamId === teamId) ?? null;
  const teamName = live?.teamName ?? closed?.teamName ?? null;
  if (!teamName) return null;
  // The More sheet's own condition for showing the switcher (a switch needs a second team). Phone
  // only — the desktop's switcher is the sidebar's select.
  const canSwitch = isPhoneNav && assignments.length + closedAssignments.length > 1;
  // `/{orgSlug}/coaches` — read off the address, not off client org-context (the default-org
  // gotcha in the docblock: a multi-org coach's context org is not always the one on screen).
  const coachesBase = pathname.slice(0, pathname.indexOf('/coaches') + '/coaches'.length);

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
  // Page-header ruling 2026-08-11: the masthead owns the season, so no page subtitle ever
  // restates it. Resolves HERE, client-side, for the season on screen. An org's NAMED season
  // ("Fall Ball 2026", "2026 Season") renders verbatim (team-name prefix stripped — the stutter
  // the old year-only rule guarded against); a bare-year name keeps the classic "{year} season".
  // This supersedes the "never programYearName" half of the meta-line rule in the docblock above.
  //
  // Role badge removed 2026-09-11 (owner ruling): it only ever showed the binary permission
  // tier (Head Coach / Assistant Coach), never the staff title (Treasurer, Manager, Helper) a
  // coach is actually invited as, which read as flatly wrong for anyone but a plain assistant.
  // A person already knows what they were invited as on a given team; what they need on screen
  // is what they can DO here, which the nav and page controls already show by simply not
  // rendering what a role can't reach.
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
    <>
    {/* role="banner": a <header> nested in <main> gets NO implicit landmark; admin's event
        header sets this explicitly for the identical mount position (AdminEventHeader:137). */}
    <header
      ref={headerRef}
      role="banner"
      /* -1: never in the tab order; focusable so a script (or a future control) can land here. It was
         the landing spot for keyboard focus when the collapse hid a control — the collapse is gone. */
      tabIndex={-1}
      className={`${styles.teamHeader} ${styles.teamHeaderPhoneRest}${onChat ? ` ${styles.teamHeaderPhoneChat}` : ''}`}
    >
      <div className={styles.teamHeaderRow}>
        <div className={styles.teamHeaderLeft}>
          {/* The name — and, on a phone with somewhere to switch to, the switcher's door (stage 1 · B1).
              The chevron sits OUTSIDE the truncating span so a long name loses its tail, never its
              chevron; the button keeps the "?"'s 44px tap trick (a 4px overhang above and below the
              36px line — the bar does not grow). */}
          <span ref={switchRef} className={styles.teamHeaderNameRow}>
            {canSwitch ? (
              <button
                ref={switchButtonRef}
                type="button"
                className={styles.teamHeaderSwitch}
                aria-haspopup="menu"
                aria-expanded={switchOpen}
                aria-controls={switchOpen ? 'coach-team-sheet' : undefined}
                title="Switch team"
                onClick={() => setSwitchOpenAt(o => (o === pathname ? null : pathname))}
              >
                <span className={styles.teamHeaderName}>{teamName}</span>
                <ChevronDown size={16} aria-hidden className={styles.teamHeaderSwitchChevron} />
              </button>
            ) : (
              <span className={styles.teamHeaderName}>{teamName}</span>
            )}
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
              ⚠ It STAYS through scroll at every width since stage 1 · B2 (2026-09-21) — the phone
              collapse that used to fold it is gone, so "help stops scrolling away" is true on a
              phone now as well as on a desktop.
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
    {/* THE TEAM SHEET (stage 1 · B1) — rendered as a SIBLING of the header, never inside it. The
        header is a stacking context (`z-index: 40`), and a fixed sheet inside it would sit under
        anything the page paints above 40 — the autosave pill (250), the console's own sheet — so
        the scrim could not cover them and an error pill could intercept a tap on the sheet's corner
        (/review 2026-09-21). Out here the anchor's own z-index (260: over the pill, under the bar)
        decides. `display: contents` so the host adds no box to `.coachesMain` (the header's
        margins and the page line's still meet). Gated on `canSwitch` as well as `switchOpen`: a
        viewport crossing 900 while the sheet is open swaps the button for plain text, and the sheet
        must go with it rather than stay open with no trigger. */}
    {canSwitch && switchOpen && (
      <div ref={switchSheetRef} style={{ display: 'contents' }}>
        <CoachTeamSwitchSheet
          base={coachesBase}
          currentTeamId={teamId}
          assignments={assignments}
          closedAssignments={closedAssignments}
          onClose={closeSwitch}
        />
      </div>
    )}
    {/* THE OVERVIEW'S PAGE LINE (stage 1 · B2 = B, owner ruling 2026-09-21). On a phone the bar
        above is one line on every screen, so the club and the season — the Overview's own second
        line since 2026-08-18, and the ONLY place a phone names the club since the 2026-08-17
        slimdown — move here: an UNPINNED line directly under the bar, same words, same place at
        rest, scrolling away with the page. Rendered on the Overview only and `display: none`
        above 640, where the bar's own meta line still carries both (so no width shows them twice).
        ⚠ A SIBLING of the sticky header, never inside it: the layout's ResizeObserver measures
        `headerRef` for `--coach-header-h`, and this line must not count as pinned chrome. The
        fragment keeps the header a DIRECT child of `.coachesMain` (its sticky pin and its
        padding-cancelling margins depend on that — see the team layout's note). The dot separator
        is drawn between siblings, as the meta line draws it, so a standalone team (no club) reads
        "2026 Season" with no orphan dot. */}
    {onOverview && (seasonText || !isTeamWorkspace) && (
      <div className={styles.teamHeaderPageLine} data-team-page-line>
        {!isTeamWorkspace && <span>{orgName}</span>}
        {seasonText && <span>{seasonText}</span>}
      </div>
    )}
    </>
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
  const word = eventWord({ eventType: status.event.eventType as RepEventType, isScrimmage: status.event.isScrimmage });
  return `${day} ${time} ${word}`;
}

/**
 * ⚠ The Suspense boundary that wrapped this is GONE with the `?year=` read (P2, 2026-08-16).
 * `useSearchParams()` forces one on any component rendered from a layout, and this component's
 * only reason to call it was resolving which season the coach had dialled to. There is no dial.
 */
export default CoachTeamHeaderInner;
