'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ListOrdered, ArrowRight, CheckCircle2, TriangleAlert, CalendarPlus, HelpCircle, Play,
} from 'lucide-react';
import type { LineupBadge } from '@/lib/lineup-analysis';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { canManageSchedule } from '@/lib/coach-capabilities';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachEventListRow from '@/components/coaches/CoachEventListRow';
import { CoachRowList, CoachRowBand } from '@/components/coaches/CoachRowList';
import CoachOneThingCard from '@/components/coaches/CoachOneThingCard';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import styles from '../../../coaches.module.css';
import { gameDayEntryHref, gameHasStarted } from '@/lib/coach-game-day';
import { isMirroredEvent, splitUpcomingAndRecent } from '@/lib/coach-tournament-games';
import { parseLineupsSection } from '@/lib/lineups-address';
import { calendarDaysBetween, formatInOrgZone, relativeDayLabel } from '@/lib/timezone';
import { useMinuteClock } from '@/lib/use-minute-clock';
import LineupsTabs from './_LineupsTabs';
import LineupTemplatesView, { gameTitle } from './_LineupTemplatesView';
import type { RepTeamEvent } from '@/lib/types';

/**
 * ── The Lineups room (brought level with the Practice plans room, owner ask 2026-09-18) ────────
 *
 * The Practice plans hub was built as "the Lineups treatment applied to the more frequent tool"
 * (2026-08-15) and then moved on — a next-practice card on top, the portal's hub tab row, no lime
 * on a row, the "needs" count fixed to upcoming only — while this hub kept the older shape. This
 * is that room's shape applied back: the two most-used game and practice instruments now read as
 * one recipe.
 *
 * **The room is a HUB for two things** — the season's games and the template library — as tabs
 * (Games · Templates; Games the landing; `?section=`), and it opens on the NEXT GAME as one card
 * carrying the room's one lime by state: Build lineup · Open lineup · Open game day (inside the
 * game's live window). Below the line the past reads as a record — "No lineup · Open", never
 * "Build lineup" — and the rows carry no lime at all.
 *
 * ⚠ The League / Tournament / Scrimmage scope chips are GONE (owner ruling 2026-09-18). They
 * appeared only for a team with two game types, the list is short and chronological with the
 * opponent on every row, and the question they answered belongs to Insights' record scope. The
 * "Needs lineup" chip is the room's whole filter, and it appears only when something needs one.
 *
 * ⚠ NO new API. `lineupStatusByEvent` rides the events read (the Lineups Deep Dive, 2026-09-18),
 * so the card, the chips and the count are computed from the list this page already fetches.
 *
 * ⚠ Which SEASON is on screen — the team's LIVE one, always. A team with no live season lands on
 * its closed-season page, where "The games you played" is a shelf, so this page has nothing to say
 * about a finished season and does not render for one. No page here learns a year.
 */

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];

// Weekday + time only — the row's date tile already carries the day number and month directly
// beside this line, so repeating them spent the card's scarcest resource on something already on
// screen (and on a phone it pushed the time onto a second line).
//
// ⚠ Both format in the ORG's zone (corrected 2026-08-15). These were bare `toLocaleDateString` /
// `toLocaleTimeString` calls — the reader's clock, not the field's — which is precisely what
// `lib/timezone.ts` was written to stop. A coach reading this from another province was being told
// the wrong start time.
const clock = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit' });
function rowMeta(startsAt: string) {
  return `${formatInOrgZone(startsAt, { weekday: 'short' })} · ${clock(startsAt)}`;
}

export default function CoachesLineupsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const searchParams = useSearchParams();
  const section = parseLineupsSection(searchParams.get('section'));
  const { assignments, loading: ctxLoading } = useCoaches();
  const { openHelp } = useHelpDrawer();
  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const page = useCoachSeasonPage(orgSlug, teamId);
  // The card's lime and the rows' game-day doors are decided by the live window, so the clock is
  // re-read once a minute — a tab left open through an afternoon must not keep offering the
  // console for a game that ended, or miss it for one that started. (It was a once-per-mount
  // snapshot while only the row pill read it; the card makes the drift visible.)
  const nowMs = useMinuteClock();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  // Fail-open like the nav — the server still enforces on every lineup route.
  const canLineups = assignment ? page.capabilities?.lineups : true;
  // Viewing a lineup is a READ; building one is a write, so it folds in read-only (Chunk F).
  const canBuildLineups = canLineups;
  // Adding a game is a SCHEDULE grant, not a lineup one — so a coach with lineups but no schedule
  // must never be handed an "Add a game" button they can't use. Fails CLOSED.
  const canAddGames = (page.capabilities ? canManageSchedule(page.capabilities) : false);
  const periodWord = sportPack.periodLabel.toLowerCase();
  // `label` is required here (unlike the HelpButton-only pages, which fall back to the button's own
  // label): this object also goes straight to openHelp() from the empty states, where there is no
  // button to fall back to. Don't "de-duplicate" it away.
  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-lineups'],
    label: 'Lineups',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-lineups`,
  };

  const [upcoming, setUpcoming] = useState<RepTeamEvent[]>([]);
  const [recent, setRecent] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Per-game lineup readiness (Not started / Draft / Ready / Needs review) from the events read's
  // bulk lineupStatusByEvent — definitive for every listed game, no per-game probing.
  const [lineupStatus, setLineupStatus] = useState<Record<string, LineupBadge>>({});
  // D11: how many innings each lineup still leaves for the field — a Ready lineup may carry
  // open innings on purpose, and its chip says so ("Ready · 3 open") rather than a bare Ready.
  const [lineupOpen, setLineupOpen] = useState<Record<string, number>>({});
  const [needsOnly, setNeedsOnly] = useState(false);

  /**
   * ⚠ Guarded against a stale response landing on the wrong TEAM (added 2026-08-15). This page does
   * not unmount when only the team segment changes — App Router re-renders the same leaf in place —
   * so a slow response for the team the coach has just left would otherwise repopulate the games
   * list and the readiness chips while the header names the new one.
   *
   * ⚠ It was written for a season switch, which could rewrite this page's own URL the same way.
   * That control is deleted (P2, 2026-08-16); the guard is not, because the team race is real and
   * was always the more likely of the two.
   */
  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) throw new Error('Games could not be loaded');
      const data: { events?: RepTeamEvent[]; lineupStatusByEvent?: Record<string, LineupBadge>; lineupOpenInningsByEvent?: Record<string, number> } = await res.json();
      // ⚠ Keeps its own `cancelled` filter even though the split helper drops them too: `games` is
      // also what builds the readiness map below, and widening that set here would be a silent
      // second change riding along with the extraction.
      const games = (data.events ?? []).filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.status !== 'cancelled');
      // Compute the split here (not during render) so we never call Date.now() in the render body.
      // Shared with the Practice plans hub, so the cap and the "upcoming" rule have one definition.
      const split = splitUpcomingAndRecent(games, { now: Date.now() });
      if (isStale()) return;
      setUpcoming(split.upcoming);
      setRecent(split.recent);
      if (data.lineupStatusByEvent) {
        // Field present ⇒ the server let us see lineups; a missing entry means "not started".
        const byEvent = data.lineupStatusByEvent;
        setLineupStatus(Object.fromEntries(games.map(g => [g.id, byEvent[g.id] ?? 'not_started'])));
        setLineupOpen(data.lineupOpenInningsByEvent ?? {});
      } else {
        // Field omitted ⇒ lineup visibility denied server-side (stale client capabilities) —
        // show no readiness badges rather than asserting a false "Not started" on every game.
        setLineupStatus({});
        setLineupOpen({});
      }
    } catch (e) {
      if (!isStale()) setError(e instanceof Error ? e.message : 'Games could not be loaded');
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [orgSlug, teamId]);

  // Wait for the assignments context to resolve before deciding whether to fetch — otherwise the
  // fail-open `canLineups` default would fire the fetch for an assistant whose access is revoked.
  // ONCE per team, whichever tab the coach lands on (the Practice plans room's idiom): the
  // Templates tab's apply picker lists these same games, so it never fetches the season again.
  useEffect(() => {
    if (ctxLoading || !canLineups) return;
    let cancelled = false;
    void Promise.resolve().then(() => load(() => cancelled));
    return () => { cancelled = true; };
  }, [ctxLoading, canLineups, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // Page-header ruling 2026-08-11: nothing under the title. The old blurb ("Build game lineups
  // and reusable templates for your team") is carried, in fuller form, by BOTH empty states below.
  const header = (
    <CoachPageHeader
      icon={ListOrdered}
      title="Lineups"
      helpLabel="Lineups"
      help={helpRequest}
    />
  );

  if (!canLineups) {
    return (
      <div className={styles.page}>
        {header}
        {/* No-action empty → the quiet variant. Still teaches what lineups do, so a coach knows
            what they'd be asking for rather than just being told "no". */}
        <CoachEmptyState
          quiet
          icon={<ListOrdered size={20} aria-hidden />}
          headline="Lineups aren't turned on for you"
          description={`A lineup sets your playing order and field positions for one game, ${periodWord} by ${periodWord}.`}
          payoff="Whoever builds them here feeds the game sheet, attendance, and the playing-time report in Insights — so the team's numbers stay in one place."
          blocker="Ask your head coach to turn on lineup access for you."
        />
      </div>
    );
  }

  const allGames = [...upcoming, ...recent];

  // The template library — the pane moved whole into its own view. It draws the room's header
  // with its own action ("New template") and the tab row under it.
  if (section === 'templates') {
    return (
      <LineupTemplatesView
        orgSlug={orgSlug}
        teamId={teamId}
        sportPack={sportPack}
        canBuildLineups={!!canBuildLineups}
        games={allGames}
        lineupStatus={lineupStatus}
        // Before game time the server resets a written lineup to Draft (readiness is a deliberate
        // coach act); at or after it the write is the game and Ready stands (D11d) — mirror the
        // same clock here so the row never flips to a word the server did not write.
        onApplied={gameId => {
          const game = allGames.find(g => g.id === gameId);
          if (game && gameHasStarted(game, nowMs)) return;
          setLineupStatus(prev => ({ ...prev, [gameId]: 'draft' }));
        }}
      />
    );
  }

  /**
   * THE CARD's game: today's, if a game is inside its live window — even one that started an hour
   * ago and so sits in `recent` — otherwise the nearest upcoming one. The card is that row
   * promoted; it is left out of the lists below so nothing appears twice.
   */
  const cardEvent = allGames.find(e => gameDayEntryHref(orgSlug, teamId, e, nowMs) !== null) ?? upcoming[0] ?? null;
  // "Needs lineup" = Not started or Draft (F02 §5.1) — Needs review already has content and its
  // own proven-issue marker, so it doesn't count as "still needs a lineup built".
  const needsLineup = (e: RepTeamEvent) => {
    const s = lineupStatus[e.id];
    return s === 'not_started' || s === 'draft';
  };
  // needsTotal decides whether the filter exists at all; the chip shows the same count. UPCOMING
  // only (the Practice plans room's D2): a coach in September was being told a game in May still
  // needed a lineup. A past game with no lineup is a record, not work.
  const needsTotal = upcoming.filter(needsLineup).length;
  // The card's game never repeats in a list. The filter is the COUNT's filter — upcoming only:
  // with it on, the past half goes, so the rows shown plus the card, if it needs one, are exactly
  // the number on the chip.
  const notCard = (list: RepTeamEvent[]) => list.filter(e => e.id !== cardEvent?.id);
  const upcomingShown = notCard(needsOnly ? upcoming.filter(needsLineup) : upcoming);
  const recentShown = needsOnly ? [] : notCard(recent);

  const badgeChip: Record<LineupBadge, { tone: 'ok' | 'warn' | 'mute'; label: string; icon?: React.ReactNode }> = {
    not_started: { tone: 'mute', label: 'Not started' },
    draft: { tone: 'mute', label: 'Draft' },
    needs_review: { tone: 'warn', label: 'Needs review', icon: <TriangleAlert size={13} aria-hidden /> },
    ready: { tone: 'ok', label: 'Ready', icon: <CheckCircle2 size={13} aria-hidden /> },
  };
  // A Ready lineup with innings still open says so — "Ready · 3 open" — on a game still to be
  // played (D11b); once the game is over the count was a to-do and the to-do is done, so a past
  // game reads a bare Ready (D11d).
  const chipFor = (e: RepTeamEvent, past: boolean) => {
    const status = lineupStatus[e.id];
    if (!status) return null;
    if (past && status === 'not_started') return { tone: 'mute' as const, label: 'No lineup' };
    const open = lineupOpen[e.id] ?? 0;
    if (status === 'ready' && !past && open > 0) return { ...badgeChip.ready, label: `Ready · ${open} open` };
    return badgeChip[status];
  };

  const renderRow = (e: RepTeamEvent, past: boolean) => {
    const status = lineupStatus[e.id];
    const needs = needsLineup(e);
    // Two halves, two vocabularies (the Practice plans room's D3): above the band the room is a
    // builder, below it a record. "Open" is the record's door — a past game that never had a
    // lineup — and it is the quiet one; the working doors keep their weight.
    const action = past
      ? (status === 'not_started' ? 'Open' : 'Open lineup')
      : (needs && canBuildLineups ? 'Build lineup' : 'Open lineup');
    // Game-Day Mode entry (P1): inside a game's live window the row gains a sibling `Game day`
    // link (the row itself keeps one destination — the builder). The card carries the live game's
    // console door, so this reaches a row only for a SECOND game live at the same time — a
    // tournament doubleheader — never as a column of pills.
    const gameDayHref = gameDayEntryHref(orgSlug, teamId, e, nowMs);
    return (
      <CoachEventListRow
        key={e.id}
        href={`${base}/lineups/${e.id}`}
        startsAt={e.startsAt}
        title={gameTitle(e)}
        meta={rowMeta(e.startsAt)}
        // A past game that never had a lineup is a record: "No lineup", never "Not started".
        chip={chipFor(e, past)}
        action={action}
        quietAction={action === 'Open'}
        // The room's one lime lives on the card — no row carries it.
        primaryLabel={null}
        beside={gameDayHref ? <Link href={gameDayHref} className={styles.gdEntryBtn}>Game day</Link> : undefined}
      />
    );
  };

  /** The next-game card — the Practice plans room's next-practice card, on this hub. */
  const renderCard = (e: RepTeamEvent) => {
    const gameDayHref = gameDayEntryHref(orgSlug, teamId, e, nowMs);
    const days = Math.max(0, calendarDaysBetween(new Date(nowMs), new Date(e.startsAt)));
    const headline = days === 0
      ? `Today · ${clock(e.startsAt)}`
      : `${formatInOrgZone(e.startsAt, { weekday: 'short', month: 'short', day: 'numeric' })} · ${clock(e.startsAt)}`;
    // On a mirrored tournament game the event's NAME is the tournament, and the title has already
    // taken the opponent — so name it here or it disappears entirely.
    const meta = [
      gameTitle(e),
      isMirroredEvent(e) ? e.name : null,
      e.location,
    ].filter(Boolean).join(' · ');
    const lineupHref = `${base}/lineups/${e.id}`;
    // The state decides the WEIGHT, never whether the door exists. Nothing built yet → Build
    // lineup; built → Open lineup; inside the live window → Open game day, with the lineup as the
    // quiet link. A coach who cannot build is never shown a lime they cannot earn.
    const primary = gameDayHref
      ? { href: gameDayHref, label: 'Open game day', icon: <Play size={15} aria-hidden /> }
      : needsLineup(e) && !canBuildLineups
        ? null
        : { href: lineupHref, label: needsLineup(e) ? 'Build lineup' : 'Open lineup', icon: null };
    const answers = gameDayHref
      ? [{ href: lineupHref, label: 'Open lineup' }]
      : primary ? [] : [{ href: lineupHref, label: 'Open' }];
    // The state chip rides the answers slot: the meta row's right side, beside the quiet links.
    // Absent when the server withheld readiness — never a guessed "Not started".
    const chip = chipFor(e, false);
    return (
      <CoachOneThingCard
        kind={gameDayHref ? 'game_day' : 'next_game'}
        tone={gameDayHref ? 'live' : 'work'}
        kicker={gameDayHref ? <><span className={styles.oneLiveDot} aria-hidden>●</span> Game day</> : 'Next game'}
        when={relativeDayLabel(days)}
        headline={headline}
        primary={primary && (
          <Link href={primary.href} className={`btn btn-lime ${styles.onePrimary}`}>
            {primary.icon}{primary.label} <ArrowRight size={15} aria-hidden />
          </Link>
        )}
        meta={meta}
        answers={(
          <>
            {chip && (
              <span className={styles.lineupFrontChip} data-tone={chip.tone}>
                {chip.icon}{chip.label}
              </span>
            )}
            {answers.map(a => (
              <Link key={a.label} href={a.href} className={styles.oneAnswer}>
                {a.label} <ArrowRight size={13} aria-hidden />
              </Link>
            ))}
          </>
        )}
      />
    );
  };

  const noGames = !loading && !error && allGames.length === 0;
  // "All caught up" only when the filter finds nothing AND the card is not itself the match.
  const cardNeedsLineup = !!cardEvent && needsLineup(cardEvent);
  const noMatches = !loading && !error && !noGames && needsOnly
    && upcomingShown.length === 0 && !cardNeedsLineup;

  return (
    <div className={styles.page}>
      {header}
      <LineupsTabs base={base} active="games" />

      {loading ? (
        <div className={styles.loadingState}>Loading games…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : noGames ? (
        <CoachEmptyState
          icon={<CalendarPlus size={22} aria-hidden />}
          eyebrow="Lineups"
          headline="Set who plays where, once"
          description={`A lineup is your playing order and field positions for a single game, ${periodWord} by ${periodWord} — build it in advance, then reuse it as a template all season.`}
          payoff="Your game sheet and attendance fill in from it instead of asking you again, and Insights uses it to show where playing time has gone across the season."
          blocker={canAddGames
            ? 'A lineup attaches to a real game, so add one to your schedule first.'
            : 'A lineup attaches to a real game, and none are on the schedule yet. Adding games needs schedule access — ask your head coach.'}
          primaryAction={canAddGames
            ? { label: 'Add a game', icon: <CalendarPlus size={15} aria-hidden />, href: `${base}/schedule` }
            : undefined}
          secondaryAction={{ label: 'How lineups work', icon: <HelpCircle size={15} aria-hidden />, onClick: () => openHelp(helpRequest) }}
        />
      ) : (
        <>
          {cardEvent && renderCard(cardEvent)}

          {/* Stays mounted while toggled on even at zero — otherwise saving the last missing
              lineup would unmount the only control that can turn the filter back off. */}
          {(needsTotal > 0 || needsOnly) && (
            <div className={styles.lineupFilterBar} role="group" aria-label="Filter games">
              <button
                type="button"
                aria-pressed={needsOnly}
                className={`${styles.lineupFilterChip} ${styles.lineupFilterNeeds} ${needsOnly ? styles.lineupFilterNeedsActive : ''}`}
                onClick={() => setNeedsOnly(v => !v)}
              >
                <TriangleAlert size={12} aria-hidden /> Needs lineup <b className={styles.lineupFilterCount}>{needsTotal}</b>
              </button>
            </div>
          )}

          {/* ONE frame for both halves (standard §3.10, F-27): "Upcoming games" and "Recent
              games" are band rows inside it. data-sandbox-tour: the beat the demo's "count the
              lineups" step rings — the games still waiting behind the one lineup already saved —
              anchors on the whole list. Inert off a demo org. */}
          {(upcomingShown.length > 0 || recentShown.length > 0) && (
            <CoachRowList label="Games" className={styles.hubRowList} data-sandbox-tour="lineups-upcoming">
              {upcomingShown.length > 0 && (
                <>
                  <CoachRowBand id="lineups-upcoming">Upcoming games</CoachRowBand>
                  {upcomingShown.map(e => renderRow(e, false))}
                </>
              )}
              {recentShown.length > 0 && (
                <>
                  <CoachRowBand id="lineups-recent">Recent games</CoachRowBand>
                  {recentShown.map(e => renderRow(e, true))}
                </>
              )}
            </CoachRowList>
          )}
          {noMatches && (
            <p className={styles.lineupFilterNoMatch}>All caught up — every game here has a lineup.</p>
          )}

          {/* Season read-outs live in the Insights hub (2026-07-08 consolidation). */}
          <p className={styles.lineupInsightsLink}>
            <Link href={`${base}/history`}>Season insights <ArrowRight size={13} aria-hidden /></Link>
          </p>
        </>
      )}
    </div>
  );
}
