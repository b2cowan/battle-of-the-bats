'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronDown, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { resolveLiveSeason, resolveClosedSeason } from '@/lib/coach-season-view';
import { coachStripFacts, stripRecord } from '@/lib/coach-strip-facts';
import type { MastheadGameDayConsole, MastheadStatus, MastheadRecord, MastheadScoutingNudge } from '@/lib/coach-masthead-status';
import { coachTeamRoster } from '@/lib/coach-team-tile';
import { formatInOrgZone } from '@/lib/timezone';
import { useCoachNudgeDismiss } from '@/components/coaches/useCoachNudgeDismiss';
import { CoachPageHelpSlot } from '@/components/coaches/CoachPageHelpSlot';
import { useCoachDeskTitle } from '@/components/coaches/CoachDeskTitle';
import CoachTeamSwitchSheet from '@/components/coaches/CoachTeamSwitchSheet';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * THE PHONE'S BAR (900px and below; above 900 it draws nothing — the strip names the page there, the sidebar's cell names
 * the team, CSS at 900/901, never a width read in script).
 *
 * ⚖ THE BAR NAMES THE PAGE (navigation Phase 5, E8 + F1–F8, owner 2026-11-12; the tournament phone's grammar since Phase 3).
 *   - The first line is the page's name from the ONE rule the computer's strip reads (`useCoachDeskTitle` →
 *     `coachDeskTitleAt`): the sidebar's lit row, in the sidebar's words, as the page's `<h1>`; the closed season's page
 *     names its season ("2025 Season"). The page's paper title hides at every width (`data-desk-named`), so no screen
 *     names itself twice.
 *   - ONE LEVEL DOWN (F1) a 44px arrow leads back and the line names where it goes ("← Roster"), from `coachDrillBack` —
 *     the address alone, so the server's first paint is the last. The record keeps its own name, chips and switcher at
 *     the top of the page (the player's name is a button that opens the player switcher; a record that loads late would
 *     otherwise arrive late in the bar), and that title stays the page's `<h1>`.
 *   - THE SMALL LINE (F2) is the team, then ONE chip when the season is not everyday — Draft, Game day, Complete — then the
 *     record. Game day and Complete replace the record (E7, the computer's rule). The words come from `coachStripFacts`,
 *     the strip's own rule, so a phone and a computer never disagree about the season. On a tablet (641–900, F6) the
 *     line also carries the club and the season, and the status keeps the bar's right end (Next / Game day with the
 *     bench door / Complete with the final record) — nothing a tablet showed before is lost.
 *   - With two or more teams the name and the line together are ONE 44px target (the tournament phone's R4) that opens
 *     `CoachTeamSwitchSheet`; the chevron sits at the identity column's right end on the line's own row. One team: plain
 *     text, nothing to tap (E8).
 *   - THE "?" STAYS AT THE BAR'S RIGHT END (F3 A, owner 2026-11-12 — replacing the 4b record's "moves into the More
 *     sheet's Help row" on purpose): the page's panel is one tap away in the fixed chrome, as the strip's "?" is on a
 *     computer, and More → Help stays the full guide, as the account menu's Help is. One rule at both widths.
 *
 * ⚖ THE 2026-09-21 RULE THAT SURVIVES: THE BAR NEVER CHANGES SHAPE UNDER SCROLL, at any width. Its reason (phone
 *   re-evaluation stage 1 · B2): the old two-line bar SNAPPED 59→36 under the thumb — a 23px jump, twice per pass — and the
 *   collapsed form hid the "?". This bar is two lines from the first frame and stays two lines. ⚠ Do not re-propose a
 *   scroll collapse as a space saving (desktop 2026-08-19, phone 2026-09-21: rejected on sight both times). The one-line
 *   name · record form B2 chose is retired by E8 on purpose (the bar names the page now; the team is on its small line).
 *
 * - Sticky against the viewport (the document is the portal's one scroll container); publishes `--coach-header-h` (a
 *   ResizeObserver on the bar, onto `<main>`). The pinned rows under it — the register's toolbar, the band rooms' tab row,
 *   the player's tabs, the lineup builder's stepper — read that one value, so a taller bar moves none of them by hand.
 * - The club's name and the team's facts arrive as SERVER props from the team layout's one feed (`loadCoachTeamMasthead`);
 *   never from client org-context (the default-org gotcha mislabelled multi-org coaches). A standalone team names no club.
 * - The Overview's club · season strip stays (F5): an UNPINNED line directly under the bar on a phone, the one place a phone
 *   names the club (`teamHeaderPageLine`). The game-week scouting reminder stays an attached row under the bar.
 * - Over an open chat room (≤640) the bar does not render: the room header is the identity there.
 * - ⚠ NO "PUBLIC SITE" DOOR (owner ruling 2026-10-06): it opened the CLUB's home page, an exit wearing the ⇄ glyph.
 * - Mounted by the TEAM layout, so it exists only under /teams/{teamId}.
 */
function CoachTeamHeaderInner({
  teamId,
  orgName,
  isTeamWorkspace,
  records,
  status: rawStatus,
  statusYearId,
  scoutingNudge,
  gameDayConsole,
}: {
  teamId: string;
  orgName: string;
  isTeamWorkspace: boolean;
  records: Record<string, MastheadRecord>;
  status: MastheadStatus;
  /** The season `status` was computed for — see the layout's note. Null when there is none. */
  statusYearId: string | null;
  /** Game-week book nudge (Scouting book P2) — computed only for the status's own season. */
  scoutingNudge: MastheadScoutingNudge | null;
  /** Game-Day Mode (P1): the console link, present only inside the game's live window. */
  gameDayConsole: MastheadGameDayConsole | null;
}) {
  const { assignments, closedAssignments } = useCoaches();
  const { title: desk } = useCoachDeskTitle();
  const headerRef = useRef<HTMLElement>(null);
  // Two facts about the page under the bar, read from the address: the team's Overview (which keeps the unpinned club ·
  // season strip under the bar) and an open chat room (no bar at ≤640). Both are CSS classes gated in the stylesheet,
  // never a JS media query, so the server and the first client frame agree.
  const pathname = usePathname() ?? '';
  const onOverview = /\/coaches\/teams\/[^/]+\/?$/.test(pathname);
  const onChat = /\/coaches\/teams\/[^/]+\/chat(?:\/|$)/.test(pathname);
  // The switcher: offered only when there is somewhere to switch TO. `useIsPhoneNav` defaults to true so the server renders
  // the button; the whole bar is display:none above 900, so a computer's swap to plain text moves nothing. The sheet frame
  // answers the sheet's keys (a tap outside, its dim, Escape, the phone's Back), and focus goes home to the line. The sheet
  // remembers the ADDRESS it was opened on rather than a boolean: a switch is a navigation, and the sheet closes with it.
  const isPhoneNav = useIsPhoneNav();
  const [switchOpenAt, setSwitchOpenAt] = useState<string | null>(null);
  const switchOpen = switchOpenAt === pathname;
  const switchButtonRef = useRef<HTMLButtonElement>(null);
  const closeSwitch = () => setSwitchOpenAt(null);
  // Once per GAME, on-device (the portal's one dismiss idiom). Called unconditionally (rules of hooks).
  const nudgeDismiss = useCoachNudgeDismiss(teamId, `scouting_book:${scoutingNudge?.eventId ?? 'none'}`);

  // Publish the bar's real height for the pinned rows under it; clean up when the bar leaves (team → hub navigation) so a
  // stale value can't offset anything.
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

  const live = assignments.find(a => a.teamId === teamId) ?? null;
  const closed = closedAssignments.find(a => a.teamId === teamId) ?? null;
  const teamName = live?.teamName ?? closed?.teamName ?? null;
  if (!teamName) return null;
  // A switch needs a second TEAM, counted as the sidebar's team cell counts them (`coachTeamRoster`: a team mid-rollover is
  // one team, and offers no switcher of one). Phone only — the computer's switcher is the sidebar's team cell.
  const canSwitch = isPhoneNav && coachTeamRoster(assignments, closedAssignments).teamCount > 1;
  // A viewport crossing 900 unmounts the sheet with the door; forget it was open, so turning the tablet back does not reopen
  // it unasked (/review 2026-11-12). Set during render, the portal's idiom for state that follows a prop.
  if (!canSwitch && switchOpenAt !== null) setSwitchOpenAt(null);
  // The org's slug — read off the address, not off client org-context (the default-org gotcha above).
  const orgSlug = pathname.split('/')[1] ?? '';

  // The season the bar describes: the LIVE one, or the newest closed one when the team has none — the shared resolvers, so
  // the bar cannot name a different season from the page under it. ⚠ No live season = the portal is ONE page (CLAUDE.md).
  const liveSeason = resolveLiveSeason(assignments, teamId);
  const closedSeason = resolveClosedSeason(assignments, closedAssignments, teamId);
  const season = liveSeason ?? closedSeason;
  const seasonFinished = !liveSeason && !!closedSeason;
  // ONE rule for the team's words at both widths: the strip's (F2).
  const facts = coachStripFacts({
    teamName, orgName, isTeamWorkspace, season, seasonFinished, records, status: rawStatus, statusYearId, gameDayConsole,
  });
  const s = facts.status;
  const gameDay = s?.kind === 'game_day';
  // The live record, in the strip's words (none for 0-0). The strip drops it on game day (E7) and the phone does too (the
  // word's width flag below), but the tablet keeps it beside its status, as it always did — so on game day it is read again.
  const record = facts.record ?? (gameDay && season ? stripRecord(records[season.programYearId]) : null);

  // Game-Day Mode (P1): on a tablet the game-day status is the door to the bench console inside the live window (the facts
  // rule gates `benchHref` on the very event the status names). ONE copy of the line; only the wrapper changes.
  const gameDayLine = s?.kind === 'game_day' ? (
    <>
      <span className={styles.teamHeaderToday}>Game day</span>
      <span className={styles.teamHeaderStack}>
        <span className={styles.teamHeaderStackKey}>{s.who ?? 'Game day'}</span>
        <span className={styles.teamHeaderStackValue}>
          {s.time}
          {s.benchHref ? ' · Open the bench ›' : ''}
        </span>
      </span>
    </>
  ) : null;
  // The scouting reminder speaks only for the season the status was computed for (the facts rule's own gate).
  const status = season?.programYearId === statusYearId ? rawStatus : null;

  // ── The two lines ──
  // The name: the page's (an <h1>), the way back's (one level down), or — on an address no row lights, which today is only
  // a redirect on its way — the team's own name, with the line then starting at the club.
  const back = desk?.kind === 'back' ? desk : null;
  const named = desk?.kind === 'name' ? desk.name : null;
  const name = named !== null
    ? <h1 className={styles.teamBarName}>{named}</h1>
    : <span className={styles.teamBarName}>{back ? back.label : teamName}</span>;
  // The small line's words. Every word shows on a tablet; the club and the season (and the record on game day) are a
  // tablet's only. The dot is drawn before every word but the first one a width shows — the first word on a tablet (CSS
  // `:first-child`), the first phone word on a phone (`data-lead-phone`) — so a hidden word never strands a dot.
  type Word = { key: string; text: string; tabletOnly?: boolean; strong?: boolean };
  const words: Word[] = [
    ...(desk ? [{ key: 'team', text: teamName }] : []),
    ...(facts.club ? [{ key: 'club', text: facts.club, tabletOnly: true }] : []),
    ...(facts.season && !seasonFinished ? [{ key: 'season', text: facts.season, tabletOnly: true }] : []),
    ...(record ? [{ key: 'record', text: record, tabletOnly: gameDay, strong: true }] : []),
  ];
  const phoneLead = words.find(w => !w.tabletOnly)?.key;
  // The chips: Draft at both widths; Game day and Complete on a phone only — on a tablet the status at the bar's right end
  // already says them (with the bench door and the final record).
  const chip = (cls: string) => `${styles.teamBarChip} ${cls}`;
  const chips = (
    <>
      {facts.state && <span className={chip(styles.seasonChip)}>{facts.state}</span>}
      {gameDay && <span className={chip(styles.teamHeaderToday)} data-phone-only>Game day</span>}
      {seasonFinished && <span className={chip(styles.seasonChip)} data-phone-only>Complete</span>}
    </>
  );
  const lineWords = words.map(w => (
    <span
      key={w.key}
      className={`${styles.teamBarWord}${w.strong ? ` ${styles.teamHeaderRecord}` : ''}`}
      data-lead-phone={w.key === phoneLead || undefined}
      data-tablet-only={w.tabletOnly || undefined}
    >
      {w.text}
    </span>
  ));
  // Words first, then the chips (a chip never carries a dot): "14U AA · 3-2-1", "14U AA [GAME DAY]", "16U AA [COMPLETE]".
  const line = <>{lineWords}{chips}</>;

  return (
    <>
    {/* role="banner": a <header> nested in <main> gets NO implicit landmark; admin's event header sets it the same way. */}
    <header
      ref={headerRef}
      role="banner"
      tabIndex={-1}
      className={`${styles.teamHeader}${onChat ? ` ${styles.teamHeaderPhoneChat}` : ''}`}
    >
      <div className={styles.teamHeaderRow}>
        {back && (
          <>
            <Link href={back.href} className={styles.teamBarBack} aria-label={`Back to ${back.label}`}>
              <ArrowLeft size={18} aria-hidden />
            </Link>
            <span className={styles.teamBarBackRule} aria-hidden />
          </>
        )}
        <div className={`${styles.teamBarIdentity}${canSwitch ? ` ${styles.teamBarIdentityDoor}` : ''}`}>
          {name}
          {canSwitch ? (
            /* ONE 44px target over the name and this line (R4): the button's own box reaches up over the name (a top
               padding the size of the name's line, given back by a negative margin) and 4px below the line, so the bar
               keeps its height and a tap anywhere on the two lines opens Your teams. Positioned, so it lies over the name;
               the <h1> stays outside the button. */
            <button
              ref={switchButtonRef}
              type="button"
              className={`${styles.teamBarLine} ${styles.teamHeaderSwitch}`}
              aria-haspopup="menu"
              aria-expanded={switchOpen}
              aria-controls={switchOpen ? 'coach-team-sheet' : undefined}
              onClick={() => setSwitchOpenAt(o => (o === pathname ? null : pathname))}
            >
              {/* The button is named by what it shows — the team, its chip and its record — then what it does, so a screen
                  reader hears the season's facts and voice control can say the visible words (WCAG 2.5.3; /review
                  2026-11-12: an aria-label had replaced them). */}
              {line}
              <span className="sr-only">, switch team</span>
              <ChevronDown size={14} aria-hidden className={styles.teamHeaderSwitchChevron} />
            </button>
          ) : (
            <div className={styles.teamBarLine}>{line}</div>
          )}
        </div>

        {/* The tablet's status (641–900): game day, next up, or Complete with the final record. ⚠ NOT ON A PHONE (owner
            ruling 2026-08-24, game day included): its game-day door cut to "6:30 p.m. · O…" at 390, and a door that ends in
            an ellipsis is not a door. The phone's small line carries the Game day / Complete CHIP instead (F2, 2026-11-12),
            which is a fact, not a door; the bench keeps its two phone doors (the Schedule's game row, the Overview's card). */}
        <span className={styles.teamHeaderStatus}>
          {s?.kind === 'complete' ? (
            <>
              <span className={styles.seasonChip}>Complete</span>
              {s.finalRecord && <span className={styles.teamHeaderStat}>Final {s.finalRecord}</span>}
            </>
          ) : s?.kind === 'game_day' ? (
            s.benchHref
              ? <Link href={s.benchHref} className={styles.teamHeaderConsoleLink}>{gameDayLine}</Link>
              : gameDayLine
          ) : s?.kind === 'next' ? (
            <span className={styles.teamHeaderStack}>
              <span className={styles.teamHeaderStackKey}>Next</span>
              <span className={styles.teamHeaderStackValue}>{s.when}</span>
            </span>
          ) : null}
        </span>

        {/* The page's "?" — LAST, at the bar's right end, through scroll (F3 A). Its width is held while nothing is
            published, so the line does not re-cut when a page's help arrives after hydration. */}
        <CoachPageHelpSlot reserve />
      </div>

      {/* Game-week book nudge (Scouting book P2): an attached row of the pinned bar, gated on the SAME status the bar renders
          from and only for the very game the status names. */}
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
    {/* THE TEAM SHEET — a SIBLING of the header, never inside it: the header is a stacking context (z-index 40), and a fixed
        sheet inside it would sit under anything the page paints above 40 (the autosave pill at 250). Gated on `canSwitch`
        too: a viewport crossing 900 while the sheet is open swaps the button away, and the sheet goes with it. */}
    {canSwitch && switchOpen && (
      <CoachTeamSwitchSheet
        orgSlug={orgSlug}
        currentTeamId={teamId}
        assignments={assignments}
        closedAssignments={closedAssignments}
        onClose={closeSwitch}
        opener={switchButtonRef}
      />
    )}
    {/* THE OVERVIEW'S CLUB · SEASON STRIP (stage 1 · B2, kept by F5): on a phone the one place the club is named — an
        UNPINNED line directly under the bar, scrolling away with the page. Overview only, `display: none` above 640 (the
        tablet's small line carries both). ⚠ A SIBLING of the sticky header, never inside it: the ResizeObserver measures
        the header for `--coach-header-h`, and this line must not count as pinned chrome. */}
    {onOverview && (facts.season || !isTeamWorkspace) && (
      <div className={styles.teamHeaderPageLine} data-team-page-line>
        {!isTeamWorkspace && <span>{orgName}</span>}
        {facts.season && <span>{facts.season}</span>}
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

export default CoachTeamHeaderInner;
