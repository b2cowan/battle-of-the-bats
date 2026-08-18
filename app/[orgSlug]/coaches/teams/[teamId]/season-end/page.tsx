'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight, Trophy } from 'lucide-react';
import { useCoaches, resolveClosedSeason, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachCollapseSection from '@/components/coaches/CoachCollapseSection';
import { useOrg } from '@/lib/org-context';
import type { SeasonWrappedPayload } from '@/lib/rep-season-wrapped';
import SeasonWrappedCard from '@/components/coaches/SeasonWrappedCard';
import CoachSeasonFinishedNotice from '@/components/coaches/CoachSeasonFinishedNotice';
import { canReadPastPracticePlans, canViewMoney, canViewSchedule, hasRecordAccess } from '@/lib/coach-capabilities';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import { formatInOrgZone, orgDayKey } from '@/lib/timezone';
import { formatRecord, tallyResults, WLT_CATEGORIES, type WltTally } from '@/lib/coach-season-record';
import { EventTypeMark } from '@/components/coaches/eventTypeMark';
import type { RepEventType } from '@/lib/types';
import styles from '../../../coaches.module.css';

/**
 * The closed money book (P4) — one statement section, flattened.
 *
 * ⚠ These are the ONLY fields the shelf reads out of the budget-vs-actual payload, and the narrow
 * type is the point: that payload also carries the month grid, the by-activity lens, the unbudgeted
 * list and every drill-in the live panel needs. A record must not become an entrance to a live
 * editor, so what is not typed here is not rendered here.
 */
type SeasonStatementCategory = {
  categoryId: string | null;
  categoryName: string;
  budgeted: number;
  actual: number;
  variance: number;
};
type SeasonStatement = {
  expenses: { categories: SeasonStatementCategory[]; budgeted: number; actual: number; variance: number };
  revenue: { categories: SeasonStatementCategory[]; actual: number };
};

/** ⚠ Two decimal places, matching the live statement — the same season must not read as two
 *  different figures depending on which screen a coach opened. Sign is printed by the caller. */
const fmtMoney = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One row of "The practices you ran" — the season-scoped list C3 added (P3). */
type SeasonPractice = {
  eventId: string;
  name: string;
  startsAt: string;
  hasPlan: boolean;
  planSummary: string | null;
  hasRecap: boolean;
  tags: { id: string; name: string }[];
};

/** One row of "Results" — a game that was played and decided. */
type SeasonGame = {
  eventId: string;
  startsAt: string;
  eventType: string;
  name: string;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  teamScore: number | null;
  opponentScore: number | null;
  result: 'win' | 'loss' | 'tie' | null;
};

/** The answer at the top of the Results shelf — computed over EVERY decided game, never the page. */
type ResultsSummary = {
  overall: WltTally;
  byType: { type: RepEventType; tally: WltTally }[];
  home: WltTally;
  away: WltTally;
  /** How many games the home/away pair covers — a neutral site falls into neither. */
  homeAwayKnown: number;
  scored: number;
  allowed: number;
  scoresKnown: number;
  /** ⚠ The season's TRUE game count. The row list is capped; this is not, and every "of N" on the
   *  page must be drawn from here rather than from the rows that happened to arrive. */
  totalGames: number;
};

/** The answer at the top of the practices shelf. ⚠ `total` is nights WRITTEN UP, not practices. */
type PracticesSummary = {
  total: number;
  withPlan: number;
  withRecap: number;
  tags: { name: string; count: number }[];
};

/**
 * ⚠⚠ **A LONG SEASON IS THE ORDINARY CASE, AND A FLAT LIST IS HOW IT BREAKS THIS PAGE** (owner
 * design gate 2026-08-18, mockup artifact `bed11050`). The seeded fixture has four games and two
 * practices; a real season is twenty-six and forty-four, and practice rows are two lines each — so
 * the two shelves that grow with the season were between them the longest thing on a page whose
 * whole promise is that it is quiet.
 *
 * The answer is three layers, each one a place a coach can stop: the shut face (the headline), the
 * SUMMARY (so opening the shelf is rewarded rather than met with a wall), and then the season BY
 * MONTH — four to six rows, each carrying a real fact, each opening to its own nights.
 *
 * ⚠ Months are not an arbitrary bucket. A coach remembers a season as "that run in July", and a
 * month row carries something a date-sorted list cannot: that month's record, and what the team
 * spent it working on.
 *
 * ⚠ **NOTHING IS HIDDEN.** Months organise the list; they never shorten it. The truncation notice
 * the routes carry is unchanged and still shown.
 */
const MONTH_GROUPING_MIN = 3;

/** Rows grouped into the org's own months, newest first. */
function byMonth<T>(rows: T[], instantOf: (row: T) => string): { key: string; label: string; rows: T[] }[] {
  const groups = new Map<string, { key: string; label: string; rows: T[] }>();
  for (const row of rows) {
    /**
     * ⚠ The ORG's month, never the reader's and never the raw string's. A Saturday-evening game in
     * Toronto is already the next day in UTC, so slicing the stored instant would file the last
     * night of July under August — and the month a game belongs to is the one it was played in.
     * `orgDayKey` is the shared answer to that; the sortable `YYYY-MM` falls straight out of it.
     */
    const key = orgDayKey(instantOf(row)).slice(0, 7);
    let g = groups.get(key);
    if (!g) {
      /** ⚠ Formatted only when the group is CREATED. Building the label per row and keeping it
       *  only for the first threw away one `Intl` format per row of the season. */
      g = { key, label: formatInOrgZone(instantOf(row), { month: 'long', year: 'numeric' }), rows: [] };
      groups.set(key, g);
    }
    g.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * The season, by month — the middle layer of both long shelves.
 *
 * ⚠ **ONE COMPONENT, NOT TWO COPIES.** Results and practices ask the same question of a season and
 * must not answer it two slightly different ways: a month header that expands on one shelf and
 * navigates on the other, or a count that says "9 games" here and "12" there while meaning
 * different things, is the drift this repo keeps paying for. What differs between them is one line
 * of copy (`factFor`) and the row itself.
 *
 * ⚠ **A SHORT SEASON SKIPS THE MONTH LAYER ENTIRELY.** Two rows that each need a click to reveal
 * four nights is worse than a list of nine — the layer exists to shorten a long season, and below
 * three months it only adds a step.
 *
 * ⚠ Native `<details>` deliberately, matching `CoachCollapseSection`: keyboard and screen-reader
 * behaviour for free, and the rows stay in the DOM so a browser's find-in-page can still reach a
 * night a coach half-remembers.
 */
function SeasonMonths<T>({
  groups,
  openMonths,
  setOpenMonths,
  factFor,
  renderRow,
}: {
  groups: { key: string; label: string; rows: T[] }[];
  /** This shelf's own open set — see the note where the two are declared. */
  openMonths: ReadonlySet<string>;
  setOpenMonths: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** The one line that makes a month row worth reading: its record, or what it was about. */
  factFor: (rows: T[]) => string;
  renderRow: (row: T) => React.ReactNode;
}) {
  if (groups.length < MONTH_GROUPING_MIN) {
    return <div className={styles.lineupFrontList}>{groups.flatMap(g => g.rows).map(renderRow)}</div>;
  }
  const toggle = (key: string) => setOpenMonths(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return (
    <div className={styles.seasonMonths}>
      {groups.map(g => (
        <details key={g.key} className={styles.seasonMonth} open={openMonths.has(g.key)}>
          <summary
            className={styles.seasonMonthHead}
            onClick={e => { e.preventDefault(); toggle(g.key); }}
          >
            <span className={styles.seasonMonthName}>{g.label}</span>
            <span className={styles.seasonMonthFact}>{factFor(g.rows)}</span>
            <ChevronRight size={15} className={styles.seasonMonthChevron} aria-hidden />
          </summary>
          <div className={styles.seasonMonthRows}>{g.rows.map(renderRow)}</div>
        </details>
      ))}
    </div>
  );
}

/**
 * "League" / "Tournament" / "Scrimmage" — the words beside the marks.
 *
 * ⚠ Read from `WLT_CATEGORIES`, the same list that decides what counts toward a record, so the
 * split can never name a competition the record does not count (or miss one it does).
 */
function competitionLabel(type: RepEventType): string {
  return WLT_CATEGORIES.find(c => c.key === type)?.label ?? 'Other';
}

/** One row of "The roster" — who was on the team that season. */
type SeasonPlayer = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  number: string | null;
  primaryPosition: string | null;
  status: string;
};

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE CLOSED-SEASON PAGE** — everything a finished season is (owner ruling 2026-08-18,
 * COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN §3.3; the mockups are the spec).
 *
 * The season's story, four collapsed shelves, and the door to the compare list. Nothing else — no
 * nav for this season, no read-only copies of the live tools. The menu belongs to the TEAM and
 * always shows the season the team is on now.
 *
 * ⚠⚠ **THIS IS NOW THE WHOLE OF A FINISHED SEASON.** It used to be the landing screen of a portal
 * that had turned itself into a read-only copy of itself — seventeen screens with a finished-season
 * branch, twelve explaining they would be back next year. All twenty-nine are deleted;
 * `CoachTeamSeasonGate` sends a coach whose team has no live season here before any of them mount.
 * If this page is missing something a coach needs, the answer is to add a shelf, never to reopen a
 * live screen against a closed year.
 *
 * ⚠ **IT NAMES THE SEASON IN ITS OWN TITLE**, and that is load-bearing rather than decorative. The
 * page-title season chip was deleted with the season dial (it was a switcher wearing a label), so
 * this title is the whole answer to "which year am I reading?" — the question every shelf's third
 * justification defers to. A roster in particular looks identical from year to year.
 *
 * ⚠ **THE LAST PAGE IN THE PORTAL THAT READS A YEAR.** `?year=` survives here and on the routes it
 * calls, and nowhere else, because the compare list's per-year links are the look-back layer's only
 * route to a season that is not the team's own current one. Without the parameter this page is the
 * team's newest closed season — which is how a coach lands here when their season ends.
 *
 * ⚠ **FOUR GATES LIVE ON THIS PAGE**, and a fifth shelf must state which it belongs to rather than
 * inheriting whichever it is pasted beside: the page itself (`hasRecordAccess`), practices
 * (`canReadPastPracticePlans` — the plan door's narrower pair), money (`canViewMoney`), results
 * (record access AND schedule). The roster shelf rides the page's own gate, because player names
 * are baseline (owner, 2026-08-03) — and that ruling covers names and stops there, which is why the
 * route behind it emits no guardian or medical field at all.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export default function SeasonEndPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, closedAssignments, loading } = useCoaches();
  const { currentOrg } = useOrg();
  const searchParams = useSearchParams();
  const yearParam = searchParams.get('year');
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const active = assignments.find(a => a.teamId === teamId) ?? null;
  // Shared closed-season predicate (lib/coach-season-view.ts) — the same rule the navs and the
  // season gate run, so no surface can disagree about whether this team has a live season.
  const closed = resolveClosedSeason(assignments, closedAssignments, teamId);
  const page = useCoachSeasonPage(orgSlug, teamId);
  /**
   * ⚠ WHICH season this page is describing. Without a year it is the team's own newest closed
   * season; with one it is whichever the compare list named — which can be an older year while the
   * team is mid-season. Everything below therefore reads the year from the URL when it is there.
   */
  const showingOwnClosedSeason = !yearParam;
  /** The team is mid-season and no year was named ⇒ there is no end to look at. */
  const seasonStillUnderWay = showingOwnClosedSeason && !!page.season;

  const [wrapped, setWrapped] = useState<SeasonWrappedPayload | null>(null);
  /** Counts only — the route omits this entirely for a coach without guardian-contact access. */
  const [recapEngagement, setRecapEngagement] = useState<{ viewers: number; eligible: number } | null>(null);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(true);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');
  /**
   * "The practices you ran" (P3 C3). `null` until answered, so an empty season renders the section
   * saying so rather than a permanent spinner.
   *
   * ⚠ Fetched separately from Wrapped, and deliberately: it carries a NARROWER gate (see
   * `mayReadPractices`), so folding it into the Wrapped payload would have widened it to everyone
   * who may read a season's story — including the money-only assistant that route's own note
   * describes.
   */
  const [practices, setPractices] = useState<SeasonPractice[] | null>(null);
  const [practicesTruncated, setPracticesTruncated] = useState(false);
  /**
   * ⚠ The season id comes back FROM THE ROUTE, never from `yearParam` or the nav. This page renders
   * with no year at all in the everyday case, and every row's link has to name the season it
   * belongs to — taking it from the answer is the only source that is right in both cases and
   * cannot drift from the rows beside it.
   */
  const [practiceSeasonId, setPracticeSeasonId] = useState<string | null>(null);
  /** The closed money book (P4). `null` until answered; the section is absent either way. */
  const [statement, setStatement] = useState<SeasonStatement | null>(null);
  /** Results (2026-08-18). */
  const [games, setGames] = useState<SeasonGame[] | null>(null);
  const [gamesTruncated, setGamesTruncated] = useState(false);
  const [resultsSummary, setResultsSummary] = useState<ResultsSummary | null>(null);
  const [practicesSummary, setPracticesSummary] = useState<PracticesSummary | null>(null);
  /**
   * Which months are open, ONE SET PER SHELF.
   *
   * ⚠ Two sets rather than one namespaced by shelf (`/simplify`, 2026-08-18). Both shelves span the
   * same calendar months, so a single flat set had July on Results toggling July on practices — and
   * the fix for that was an `idPrefix` prop threaded through the shared component plus string
   * concatenation on every row. A second `useState` line avoids the collision for free, and the
   * component stops needing to know which shelf it is.
   *
   * ⚠ Independent toggles rather than one-at-a-time: a coach comparing June to July should not have
   * to close one to read the other, and an accordion that shuts the thing you just read is the
   * fussiest possible answer to a list being long.
   */
  const [openResultMonths, setOpenResultMonths] = useState<Set<string>>(new Set());
  const [openPracticeMonths, setOpenPracticeMonths] = useState<Set<string>>(new Set());
  /**
   * ⚠ Memoised on the ROWS, not on the open set. Without this, opening one month on one shelf
   * re-groups BOTH shelves — the cost is small at a season's size, but it is work done for a reason
   * that does not exist, and the dependency makes it obvious that grouping is about the data.
   */
  const resultMonths = useMemo(() => byMonth(games ?? [], g => g.startsAt), [games]);
  const practiceMonths = useMemo(() => byMonth(practices ?? [], p => p.startsAt), [practices]);
  /** The roster (2026-08-18). */
  const [roster, setRoster] = useState<SeasonPlayer[] | null>(null);

  /**
   * ⚠ The guards below run at RENDER time, and effects fire regardless of which branch renders —
   * so without this line a helper's visit still issues a `/wrapped` request that the route is
   * guaranteed to refuse, after it has done the season and assignment lookups to find that out.
   * Worse, the 403 lands in the `.catch` and sets the generic "couldn't be loaded" error, which is
   * the broken-page outcome the honest screen exists to replace.
   */
  const mayReadWrapped = page.hasAccess || !!closed
    ? (!page.capabilities || hasRecordAccess(page.capabilities))
    : false;
  /**
   * ⚠ **THE PRACTICES SECTION IS NARROWER THAN THE PAGE IT SITS ON.** This page gates on
   * `hasRecordAccess`; the read route behind every one of these rows has always ALSO required
   * `canViewSchedule`, precisely so a helper who runs one station cannot type the URL. So this
   * second entry point calls the SAME named predicate both routes behind it call — the door and the
   * lock cannot drift, because they are one symbol.
   */
  const mayReadPractices = mayReadWrapped
    && (!page.capabilities || canReadPastPracticePlans(page.capabilities));
  /**
   * ⚠ **THE MONEY SHELF'S GATE IS A DIFFERENT ONE AGAIN** (P4). The practices shelf asks "is the
   * team's record yours, and do you belong at practice?"; the money book asks the one question
   * money has always asked. An assistant trusted with attendance and lineups but not with the books
   * reads the practices and never sees the statement.
   */
  const mayReadMoney = mayReadWrapped
    && (!page.capabilities || canViewMoney(page.capabilities));
  /**
   * ⚠ **RESULTS RIDE THE SCHEDULE GRANT TOO.** Who the team played and what happened is the fact
   * the schedule read has always gated, and a helper holds neither half of this pair — the same
   * conjunction the practices shelf carries, for the same reason.
   */
  const mayReadResults = mayReadWrapped
    && (!page.capabilities || canViewSchedule(page.capabilities));

  useEffect(() => {
    if (loading || !mayReadWrapped || seasonStillUnderWay) return;
    let cancelled = false;
    setFetching(true);
    setError('');
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/wrapped${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(json => {
        if (cancelled) return;
        setWrapped(json.wrapped as SeasonWrappedPayload);
        setRecapEngagement(json.recapEngagement ?? null);
      })
      .catch(() => { if (!cancelled) setError('This season’s wrap-up couldn’t be loaded — refresh to try again.'); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [loading, mayReadWrapped, seasonStillUnderWay, orgSlug, teamId, yearParam]);

  /**
   * The practices this season, for the collapsed section below (P3 C3).
   *
   * ⚠ It fails QUIETLY — a failure leaves `practices` null and the section absent. This is a quiet
   * shelf below the season's story, not the story itself: a red error line under the Wrapped card
   * because a secondary list did not load would make a working page read as a broken one.
   *
   * ⚠⚠ **CLEARED BEFORE THE FETCH, NOT ONLY AFTER IT** (`/review` 2026-08-16). The `cancelled` flag
   * stops an OLD answer overwriting a NEW one; it does nothing about the old answer already on
   * screen. The Wrapped effect hides itself with `setFetching(true)` and the whole content block
   * waits on that — so when the coach picks a different year from the compare list, Wrapped's answer
   * can land first and render the new season's card with THIS state still holding the previous
   * season's practices, every row linking with the previous season's id.
   */
  useEffect(() => {
    if (loading || !mayReadPractices || seasonStillUnderWay) return;
    let cancelled = false;
    setPractices(null);
    setPracticeSeasonId(null);
    setPracticesTruncated(false);
    setPracticesSummary(null);
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-practices${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { practices?: SeasonPractice[]; truncated?: boolean; summary?: PracticesSummary; season?: { programYearId?: string } }) => {
        if (cancelled) return;
        setPractices(json.practices ?? []);
        setPracticesTruncated(!!json.truncated);
        setPracticesSummary(json.summary ?? null);
        setPracticeSeasonId(json.season?.programYearId ?? null);
      })
      .catch(() => { /* quiet by design — see above */ });
    return () => { cancelled = true; };
  }, [loading, mayReadPractices, seasonStillUnderWay, orgSlug, teamId, yearParam]);

  /**
   * The closed money book (P4) — this season's statement.
   *
   * ⚠ Clears before fetching and fails quiet, for the reasons the practices shelf above states.
   *
   * ⚠ It asks the LIVE Budget vs Actual route with a year — deliberately not a second endpoint.
   * One arithmetic; a season's figures must not depend on which screen asked (the defect fixed in
   * `14af00f0`, where three walks of the same records disagreed).
   */
  useEffect(() => {
    if (loading || !mayReadMoney || seasonStillUnderWay) return;
    let cancelled = false;
    setStatement(null);
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-vs-actual${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { report?: SeasonStatement }) => {
        if (cancelled || !json.report) return;
        setStatement(json.report);
      })
      .catch(() => { /* quiet by design — see above */ });
    return () => { cancelled = true; };
  }, [loading, mayReadMoney, seasonStillUnderWay, orgSlug, teamId, yearParam]);

  /**
   * Results — the games this season played (2026-08-18).
   *
   * ⚠ Clears before fetching, same rule as every shelf beside it: a page describing two years at
   * once is the failure this page's own note warns about, and results is the shelf where it would
   * be hardest to spot — one season's scores look exactly like another's.
   */
  useEffect(() => {
    if (loading || !mayReadResults || seasonStillUnderWay) return;
    let cancelled = false;
    setGames(null);
    setGamesTruncated(false);
    setResultsSummary(null);
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-results${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { games?: SeasonGame[]; truncated?: boolean; summary?: ResultsSummary }) => {
        if (cancelled) return;
        setGames(json.games ?? []);
        setGamesTruncated(!!json.truncated);
        setResultsSummary(json.summary ?? null);
      })
      .catch(() => { /* quiet by design */ });
    return () => { cancelled = true; };
  }, [loading, mayReadResults, seasonStillUnderWay, orgSlug, teamId, yearParam]);

  /** The roster — who was on the team that season (2026-08-18). Same clearing rule. */
  useEffect(() => {
    if (loading || !mayReadWrapped || seasonStillUnderWay) return;
    let cancelled = false;
    setRoster(null);
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-roster${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { players?: SeasonPlayer[] }) => {
        if (cancelled) return;
        setRoster(json.players ?? []);
      })
      .catch(() => { /* quiet by design */ });
    return () => { cancelled = true; };
  }, [loading, mayReadWrapped, seasonStillUnderWay, orgSlug, teamId, yearParam]);

  async function handleReopen() {
    setReopening(true);
    setReopenError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/seasons`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReopenError(data.error ?? 'Could not reopen the season.');
        return;
      }
      /**
       * ⚠ A FULL navigation, exactly as the rollover's call sites use. Reopening changes which
       * season the team is on, and only a hard load re-seeds the coaches context — a client-side
       * hop would land on an Overview built from a context that still says the team has no live
       * season, which is the stale-guard lesson from the practices shelf one level up.
       */
      window.location.assign(base);
    } catch {
      setReopenError('Could not reopen the season. Please try again.');
    } finally {
      setReopening(false);
    }
  }

  if (loading) return <p className={styles.muted}>Loading...</p>;

  if (!page.hasAccess && !closed) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  /**
   * ⚠ **WHERE A HELPER ACTUALLY LANDS** (owner ruling 2026-08-03). Signing in sends them to the
   * portal root, which redirects a team with no live season straight here; so does the nav, and so
   * does the team switcher. This is the screen they see.
   *
   * Not a gate: the Wrapped route refuses them on its own and the nav hides the door. This is the
   * altitude choice that stops the refusal rendering as a broken page.
   */
  if (page.capabilities && !hasRecordAccess(page.capabilities)) {
    return <CoachSeasonFinishedNotice />;
  }

  /**
   * ⚠ THE SEASON IS STILL RUNNING. Reachable by typing the URL, or from a bookmark. It must not
   * quietly show the NEWEST FINISHED season's story instead — that is a hidden season choice, and
   * with the page-title chip gone nothing on screen would say which year it was. So it says so, and
   * points at the list that does hold the finished ones.
   */
  if (seasonStillUnderWay) {
    return (
      <div className={styles.page}>
        <CoachPageHeader
          icon={Trophy}
          title="Season's End"
          helpLabel="Season's End"
          help={{ module: 'coaches', sectionIds: ['premium-season-end'], fullGuideHref: `/${orgSlug}/coaches/help#premium-season-end` }}
        />
        <section className={styles.setupPanel}>
          <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
            <strong>{page.programYearName}</strong> is still under way — a season stays live until
            you close it. When it does, this is where it gets kept: the season&apos;s story, the
            results, the roster, the practices you ran and how it added up.
          </p>
          <Link href={`${base}/history/results`} className={styles.seasonDoorRow}>
            <span>
              Compare every season
              <small>Records, roster size and money summaries, season by season</small>
            </span>
            <ChevronRight size={16} className={styles.seasonDoorArrow} aria-hidden />
          </Link>
        </section>
      </div>
    );
  }

  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  const orgName = currentOrg?.name ?? 'your club';
  // The forward path only renders in the CLOSED-ONLY state; a coach browsing a past season of a
  // rolled-forward team already has their active season.
  const coachRole = active?.coachRole ?? closed?.coachRole ?? 'assistant_coach';
  const showStartNext = !active && !!closed && isTeamWorkspace && coachRole === 'head_coach';
  /**
   * ⚠ **REOPEN IS THE SAFE HALF ONLY** (plan §3.4). Offered on exactly the same condition as
   * "Start next season" — the team has no live season — because with a newer season started, giving
   * the old one back would mean DELETING the new one. That undo is logged and deliberately not
   * built; the "this closes {season}" sentence on the rollover dialog is what keeps the gap small.
   *
   * ⚠ And only on the team's OWN closed season. A coach reading an older year from the compare list
   * must never be offered a button that would reopen a different season from the one on screen.
   */
  const showReopen = showStartNext && showingOwnClosedSeason;

  /**
   * ⚠ **THE PAGE NAMES ITS SEASON.** From the Wrapped payload once it lands (it is the only source
   * that is right for a year the compare list named), falling back to the team's own closed season
   * so the title does not flicker through a generic label on the everyday path.
   */
  const seasonTitle = wrapped?.seasonName ?? closed?.programYearName ?? "Season's End";

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the page names ITSELF, not the team. Here that IS the
          season's name — the one thing on screen that says which year is being read, now that the
          season chip is gone. Chunk B (P1 #17): a coach reaching this months later has the least
          context of anyone, so the help icon earns its place. */}
      <CoachPageHeader
        icon={Trophy}
        title={seasonTitle}
        helpLabel="Season's End"
        help={{ module: 'coaches', sectionIds: ['premium-season-end'], fullGuideHref: `/${orgSlug}/coaches/help#premium-season-end` }}
      />

      {fetching ? (
        <div className={styles.loadingState}>Wrapping up the season…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : wrapped ? (
        /* Desktop shell D3 (2026-08-01): the Wrapped card and the shelves sit side by side on
           desktop instead of a 560px strip floating in empty space; stacks ≤900. */
        <div className={styles.seasonSpread}>
          <SeasonWrappedCard wrapped={wrapped} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* ── "Ready for next year?" — the ONLY difference between a closed season with a newer
              one and a closed season without (mockup: one card at the top, otherwise the same
              page, not a second design). ─────────────────────────────────────────────────────── */}
          {showStartNext && closed && (
            <section className={styles.setupPanel}>
              <p className={styles.setupKicker}>Ready for next year?</p>
              <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
                Your roster and staff carry forward. This season stays right here.
              </p>
              <button type="button" className={`btn btn-lime ${styles.setupNextCta}`} onClick={() => setRolloverOpen(true)}>
                Start next season
              </button>
              {/* ⚠ Quiet, and worded as what it IS — an undo for a mistake, not a way of working.
                  It disappears the moment a new season exists, because from then on there is
                  nothing safe to offer. */}
              {showReopen && (
                <button
                  type="button"
                  className={styles.seasonReopenLink}
                  onClick={handleReopen}
                  disabled={reopening}
                >
                  {reopening ? 'Reopening…' : `Closed this by mistake? Reopen ${closed.programYearName}`}
                </button>
              )}
              {reopenError && <p className={styles.errorText}>{reopenError}</p>}
            </section>
          )}

          {/* Chunk D 3.5 — did the families read the recaps? COUNTS ONLY: the product does not
              record, and this page cannot show, WHICH family opened one. Absent entirely when
              no guardian was connected to this season — a "0 of 0" is not a fact worth
              printing, and it would read as a failure rather than as "nobody signed up". */}
          {recapEngagement && recapEngagement.eligible > 0 && (
            /* data-sandbox-tour: the beat the demo's closing step rings — the recap the families
               actually opened. Inert off a demo org. */
            <section className={styles.setupPanel} aria-labelledby="season-end-recaps"
              data-sandbox-tour="season-recaps">
              <p className={styles.setupKicker} id="season-end-recaps">Family season recaps</p>
              <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
                <b>{recapEngagement.viewers} of {recapEngagement.eligible}</b> connected
                {recapEngagement.eligible === 1 ? ' family has' : ' families have'} opened their
                player&apos;s recap for this season.
              </p>
            </section>
          )}

          {/* ── "Results" (2026-08-18) ───────────────────────────────────────────────────────
              ⚠ **COLLAPSED, and its shut face carries the answer** — "26 games" is usually the
              whole enquiry. Same binding constraint as every shelf here: the season's story is what
              a coach opens this page for, and a shelf that pushes it below the fold is a failed
              design however useful the history is.

              ⚠ **FLAT — NO ROW IS A LINK.** On the live schedule these same games are doors: into
              the event, the lineup, the attendance sheet and the scouting book. A record must not
              be an entrance to a live instrument, and there is deliberately no level down here. */}
          {games && games.length > 0 && (
            <CoachCollapseSection
              sectionId="season-results"
              title="Results"
              meta={`${games.length}${gamesTruncated ? '+' : ''} game${games.length === 1 ? '' : 's'}${resultsSummary ? ` · ${formatRecord(resultsSummary.overall)}` : ''}`}
              defaultOpen={false}
            >
              {/* ── The answer, before the evidence ────────────────────────────────────────
                  ⚠ **BY COMPETITION, because that is what "how did we do?" means.** A league record
                  and a tournament record are different claims about a team, and the flat list this
                  replaced mixed them into one number.

                  ⚠ The mark is the SCHEDULE's own (shield / trophy / swords) — the vocabulary a
                  coach reads every week — and the WORD stays beside it, because league-green and
                  tournament-amber are close to a coin-flip for a red-green colour-blind coach. */}
              {resultsSummary && (
                <div className={styles.seasonAnswer}>
                  <p className={styles.seasonAnswerKey}>The season</p>
                  <div className={styles.seasonSplits}>
                    {resultsSummary.byType.map(r => (
                      <span key={r.type} className={styles.seasonSplit}>
                        <EventTypeMark type={r.type} />
                        <span className={styles.seasonSplitName}>{competitionLabel(r.type)}</span>
                        <strong>{formatRecord(r.tally)}</strong>
                      </span>
                    ))}
                  </div>
                  {/* ⚠⚠ **EVERY "OF N" ON THIS LINE COUNTS THE SEASON, NOT THE ROWS THAT ARRIVED**
                      (`/review`, 2026-08-18). The denominator was `games.length` — the CAPPED list
                      the client received — so on a season past the cap the caveat could suppress
                      itself entirely (330 known is not < 300 shown) and, when it did render, name
                      the cap instead of the season. `totalGames` is the uncapped count and is the
                      only honest denominator here. */}
                  <p className={styles.seasonAnswerSub}>
                    Home {formatRecord(resultsSummary.home)} · Away {formatRecord(resultsSummary.away)}
                    {/* ⚠ A game at a NEUTRAL site, or one with no side recorded, is in neither
                        bucket — so the pair can quietly describe fewer games than the season held.
                        It discloses that the same way the scoring clause below does; an earlier
                        version let this one line imply a completeness it did not have. */}
                    {resultsSummary.homeAwayKnown < resultsSummary.totalGames
                      ? ` (from ${resultsSummary.homeAwayKnown} of ${resultsSummary.totalGames} with a side recorded)`
                      : ''}
                    {/* ⚠ Says what the totals are DRAWN FROM. A result can be recorded with no
                        score, so "scored 148" over 26 games when only 22 carry numbers would be a
                        confident wrong answer about the other four. */}
                    {resultsSummary.scoresKnown > 0 && (
                      <> · Scored {resultsSummary.scored}, allowed {resultsSummary.allowed}
                        {resultsSummary.scoresKnown < resultsSummary.totalGames
                          ? ` (from ${resultsSummary.scoresKnown} of ${resultsSummary.totalGames} with a score)`
                          : ''}
                      </>
                    )}
                  </p>
                </div>
              )}
              {/* ⚠ THE TRUNCATION IS STATED, never silent — a list that quietly stops short tells a
                  coach their season held fewer games than it did. */}
              {gamesTruncated && (
                <p className={styles.formHint}>
                  Showing the {games.length} most recent — this season held more than that.
                </p>
              )}
              <SeasonMonths
                groups={resultMonths}
                openMonths={openResultMonths}
                setOpenMonths={setOpenResultMonths}
                /* Each month carries THAT month's record — the fact a date-sorted list never told
                   anybody, and the reason the month layer earns its place rather than merely
                   shortening the shelf. */
                factFor={rows => `${rows.length} game${rows.length === 1 ? '' : 's'} · ${formatRecord(tallyResults(rows))}`}
                renderRow={g => (
                  <div key={g.eventId} className={styles.seasonRecordRow}>
                    <span className={styles.seasonRecordDate}>
                      {formatInOrgZone(g.startsAt, { month: 'short', day: 'numeric' })}
                    </span>
                    <EventTypeMark type={g.eventType as RepEventType} />
                    <span className={styles.seasonRecordMain}>
                      {g.opponent ?? g.name}
                      {g.homeAway === 'away' ? ' (away)' : g.homeAway === 'home' ? ' (home)' : ''}
                    </span>
                    <span className={styles.seasonRecordScore}>
                      {g.teamScore != null && g.opponentScore != null
                        ? `${g.teamScore}–${g.opponentScore}`
                        : '—'}
                    </span>
                    {/* ⚠ The WORD carries the outcome, never a colour alone — the olive and danger
                        tones sit ~1.0 ΔE apart for a deuteranope. */}
                    <span className={styles.seasonRecordOutcome}>
                      {g.result === 'win' ? 'Win' : g.result === 'loss' ? 'Loss' : 'Tie'}
                    </span>
                  </div>
                )}
              />
            </CoachCollapseSection>
          )}

          {/* ── "The roster" (2026-08-18) ────────────────────────────────────────────────────
              ⚠ **FLAT, and this one matters most.** No row opens a player profile: the profile is
              the busiest instrument in the portal — dues, documents, development, guardians,
              medical — and a record must never be a door into one.

              ⚠ Names and numbers only. Player names are baseline (owner, 2026-08-03); that ruling
              covers NAMES and stops there, and the route behind this emits no guardian, medical or
              emergency-contact field at all. */}
          {roster && roster.length > 0 && (
            <CoachCollapseSection
              sectionId="season-roster"
              title="The roster"
              meta={`${roster.length} player${roster.length === 1 ? '' : 's'}`}
              defaultOpen={false}
            >
              <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
                Who was on the team that season.
              </p>
              <div className={styles.lineupFrontList}>
                {roster.map(p => (
                  <div key={p.playerId} className={styles.seasonDoorRow} style={{ cursor: 'default' }}>
                    <span>
                      {p.number ? `#${p.number} · ` : ''}{p.firstName} {p.lastName ?? ''}
                      {/* ⚠ A player who LEFT part-way through still played for this team, so they
                          stay on the record and the row says which — quietly dropping them would
                          rewrite the season, the one thing an archive must never do. */}
                      {(p.primaryPosition || p.status !== 'active') && (
                        <small>
                          {[
                            p.primaryPosition,
                            p.status === 'released' ? 'Left during the season'
                              : p.status !== 'active' ? 'Not active' : null,
                          ].filter(Boolean).join(' · ')}
                        </small>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </CoachCollapseSection>
          )}

          {/* ── "The practices you ran" (P3 C3) ──────────────────────────────────────────────
              ⚠ **COLLAPSED BY DEFAULT, and that is a binding design constraint rather than a
              taste** (CLAUDE.md ruling §1.6: a history shelf that makes the live screen noisier is
              a failed design). It costs a live season nothing at all — no live season renders this
              page — and it stays below the season's story, because Season Wrapped is what a coach
              opens this page for.

              ⚠ It is on this page and nowhere else. The obvious home, a drawer on the Practice
              plans hub, was rejected in the mockup session: it was the only proposal that put
              weight on a screen a coach opens on a Tuesday, and it would have sat directly above
              the Plan templates door as a second entrance to one library. */}
          {practices && practices.length > 0 && (
            <CoachCollapseSection
              sectionId="season-practices"
              title="The practices you ran"
              meta={`${practices.length}${practicesTruncated ? '+' : ''}`}
              defaultOpen={false}
            >
              {/* ── What the season was actually spent on ─────────────────────────────────
                  ⚠ **THE BEST THING ON THIS SHELF, AND IT COMES FREE.** The focus tags are already
                  on every row; counting them turns a list nobody reads to the end into a fact about
                  a season a coach could not get any other way.

                  ⚠ A night tagged twice counts once for each tag — the question is "how many nights
                  touched hitting", not "how do these divide up" — so this is NOT presented as a
                  breakdown and the numbers are not meant to sum to the practice count.

                  ⚠ A team that never tagged a practice gets no tag line at all rather than an empty
                  one. It degrades to the counts, which are still true. */}
              {practicesSummary && (
                <div className={styles.seasonAnswer}>
                  <p className={styles.seasonAnswerKey}>What you worked on</p>
                  {/* ⚠ The tag counts come from the SAME capped read as the line below, so they
                      carry the same `+` (`/review`, 2026-08-18 — they were left bare while their
                      neighbours were fixed, which is the worse version of the bug: two numbers one
                      line apart, one of them flagged as a floor and one not). */}
                  {practicesSummary.tags.length > 0 && (
                    <p className={styles.seasonAnswerValue}>
                      {practicesSummary.tags.slice(0, 4)
                        .map(t => `${t.name} ${t.count}${practicesTruncated ? '+' : ''}`).join(' · ')}
                      {practicesSummary.tags.length > 4 ? ` · +${practicesSummary.tags.length - 4} more` : ''}
                    </p>
                  )}
                  {/* ⚠⚠ **"WRITTEN UP", NOT "RAN".** This shelf holds nights a coach wrote something
                      about; a practice nobody wrote up never reaches it. A team that ran sixty and
                      planned forty-four must not be told by this page that they ran forty-four. */}
                  {/* ⚠ The `+` is not decoration. The practices read is capped in the query itself
                      (unlike the results read, which is not), so once the season overflows it every
                      figure on this line is a FLOOR. A bare "201 nights written up" on a season of
                      250 is the same class of small lie as the bare count this line already exists
                      to correct — found by `/review`, 2026-08-18. */}
                  <p className={styles.seasonAnswerSub}>
                    {practicesSummary.total}{practicesTruncated ? '+' : ''} night{practicesSummary.total === 1 ? '' : 's'} written up
                    {' · '}{practicesSummary.withPlan}{practicesTruncated ? '+' : ''} with a plan
                    {' · '}{practicesSummary.withRecap}{practicesTruncated ? '+' : ''} with a note afterwards
                  </p>
                </div>
              )}
              <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
                Read-only — open one and it reads exactly as you wrote it.
              </p>
              {/* ⚠ THE TRUNCATION IS STATED, never silent (plan §5 risk 1). A list headed "the
                  practices you ran" that quietly stops short tells a coach they ran fewer than
                  they did — the one way this section can lie about a season. */}
              {practicesTruncated && (
                <p className={styles.formHint}>
                  Showing the {practices.length} most recent — this season held more than that.
                </p>
              )}
              <SeasonMonths
                groups={practiceMonths}
                openMonths={openPracticeMonths}
                setOpenMonths={setOpenPracticeMonths}
                /* What that month was about, in the team's own words — the practices equivalent of
                   the results shelf's per-month record. */
                factFor={rows => {
                  const names = [...new Set(rows.flatMap(r => r.tags.map(t => t.name)))].slice(0, 2);
                  const count = `${rows.length} night${rows.length === 1 ? '' : 's'}`;
                  return names.length ? `${count} · ${names.join(', ')}` : count;
                }}
                renderRow={p => (
                  <Link
                    key={p.eventId}
                    /* ⚠ The season AND where the coach came from, both explicit. The year is what
                       lets the plan page resolve a season the team may no longer be on; `from` is
                       what sends the back link here instead of to the Development report, which
                       answers for a different year.

                       ⚠ THE ONE LINK ON THIS PAGE THAT GOES ANYWHERE, and it goes to a read-only
                       plan page, not to a live tool. */
                    href={`${base}/history/development/practices/${p.eventId}`
                      + `?from=season-end${practiceSeasonId ? `&year=${encodeURIComponent(practiceSeasonId)}` : ''}`}
                    className={styles.seasonDoorRow}
                  >
                    <span>
                      {formatInOrgZone(p.startsAt, { month: 'short', day: 'numeric' })} · {p.name}
                      {/* ⚠ A practice with a recap and NO plan is a legitimate row — the shared
                          read is "either, not both" on purpose, because a coach who wrote nothing
                          beforehand and everything afterwards produced exactly the record this
                          section exists to show. It must never be offered under a label promising
                          a plan, so the row says which it is.

                          ⚠ The planless label READS `hasRecap` rather than assuming it (`/review`
                          2026-08-16). The route drops rows that carry neither, so this branch
                          should always be a recap — but the flag was already on the payload and
                          unused, and a label that asserts a note exists must be the one thing that
                          checked. The fallback is deliberately quiet: it claims nothing. */}
                      <small>
                        {p.hasPlan
                          ? p.planSummary ?? 'Plan'
                          : p.hasRecap
                            ? 'No plan written — your note about how it went'
                            : 'No plan written'}
                        {p.tags.length > 0 ? ` · ${p.tags.map(t => t.name).join(' · ')}` : ''}
                      </small>
                    </span>
                    <ChevronRight size={16} className={styles.seasonDoorArrow} aria-hidden />
                  </Link>
                )}
              />
            </CoachCollapseSection>
          )}

          {/* ── "How the season added up" — the closed money book (P4) ────────────────────────
              ⚠ **COLLAPSED, and its SHUT FACE already answers the question.** Most of the time
              "did we come in under?" is the whole enquiry, so the summary chip carries it and the
              coach never opens the section.

              ⚠ **FLAT — NO CELL IS A LINK.** On the LIVE Budget vs Actual screen these same figures
              are doors: rows expand, month cells open the budget editor, the undated figure opens a
              chooser. A record must not be an entrance to a live instrument — and two of those
              doors were quietly broken for two days, which is how little anyone would notice if
              this one led somewhere wrong.

              ⚠ Gated on MONEY access, not record access — a different key from the shelves above
              it. See `mayReadMoney`. */}
          {statement && statement.expenses.categories.length > 0 && (
            <CoachCollapseSection
              sectionId="season-statement"
              title="How the season added up"
              meta={statement.expenses.variance === 0
                ? 'On plan'
                : `${fmtMoney(statement.expenses.variance)} ${statement.expenses.variance > 0 ? 'under' : 'over'}`}
              defaultOpen={false}
            >
              <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
                What this season planned to spend, and what it actually spent. Read-only — the
                season is closed.
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.devBoardTable}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Planned</th>
                      <th style={{ textAlign: 'right' }}>Actual</th>
                      <th style={{ textAlign: 'right' }}>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.expenses.categories.map(cat => (
                      <tr key={cat.categoryId ?? cat.categoryName}>
                        <td>{cat.categoryName}</td>
                        <td data-label="Planned" style={{ textAlign: 'right' }}>{fmtMoney(cat.budgeted)}</td>
                        <td data-label="Actual" style={{ textAlign: 'right' }}>{fmtMoney(cat.actual)}</td>
                        {/* ⚠ The word carries the meaning, never the colour alone — olive and the
                            danger tone sit ~1.0 ΔE apart for a deuteranope, so "under"/"over" is
                            what a coach reads, and the tint only reinforces it. */}
                        <td data-label="Difference" style={{ textAlign: 'right' }}>
                          {cat.variance === 0
                            ? '—'
                            : `${fmtMoney(cat.variance)} ${cat.variance > 0 ? 'under' : 'over'}`}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong>Total</strong></td>
                      <td data-label="Planned" style={{ textAlign: 'right' }}>
                        <strong>{fmtMoney(statement.expenses.budgeted)}</strong>
                      </td>
                      <td data-label="Actual" style={{ textAlign: 'right' }}>
                        <strong>{fmtMoney(statement.expenses.actual)}</strong>
                      </td>
                      <td data-label="Difference" style={{ textAlign: 'right' }}>
                        <strong>
                          {statement.expenses.variance === 0
                            ? '—'
                            : `${fmtMoney(statement.expenses.variance)} ${statement.expenses.variance > 0 ? 'under' : 'over'}`}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* What came IN that season — one quiet line, so the statement is not read as the
                  whole story. Absent when the team recorded no money coming in at all: a "$0.00"
                  here would read as a failure rather than as "nothing was recorded". */}
              {statement.revenue.actual > 0 && (
                <p className={styles.formHint}>
                  Money in: {fmtMoney(statement.revenue.actual)}
                  {statement.revenue.categories.length > 0
                    ? ` — ${statement.revenue.categories.map(c => c.categoryName).join(', ')}`
                    : ''}
                </p>
              )}
            </CoachCollapseSection>
          )}

          {/* ── ⚠⚠ THE "COMPARE EVERY SEASON" DOOR IS GONE FROM THIS PAGE (owner, 2026-08-18,
              from the first walk) — and it is worth recording WHY, because the door had been here
              since the archive era and looked load-bearing.

              It pointed at the compare list under Insights. Once a closed season became one page,
              Insights stopped being reachable for a team with no live season — so for the coach
              most likely to press it, this door redirected straight back to the page they pressed
              it on. A link that loops is worse than no link: it reads as a broken page rather than
              as a closed door.

              ⚠ **THE CONSEQUENCE, STATED RATHER THAN DISCOVERED LATER:** a coach between seasons
              can now reach their NEWEST closed season and no earlier one. Every year is still there
              and still reachable the moment a new season starts (Insights → "How are we doing?" →
              per-year link, which lands back on this page with that year). If that gap turns out to
              matter, the fix is a quiet list of the team's other seasons ON this page — never a
              second page, and never re-opening a live screen. Logged, not built. */}

          {/* ⚠ **NO "GO TO <LIVE SEASON>" BUTTON** — removed 2026-08-17 (owner, from the §53 walk),
              and it is worth saying why so it does not come back. It was a leftover from the archive
              era, when this page was a PLACE the portal could be steered into and a coach needed an
              exit. The nav is always the team's own; every door in it already goes where that
              button went. */}

          {/* ⚠ **CORRECTED 2026-08-18 (owner, from the first walk): STAFF IS A FACT ABOUT THE TEAM,
              NOT ABOUT A SEASON.** This said "when you're on next season's coaching staff, the team
              reappears here automatically" — vocabulary left over from the per-season access model
              that M1 deleted on 2026-08-16. A coach is on the team or they are not: lose the team
              and you lose its whole portal, not one year of it. The old sentence quietly implied a
              coach might be dropped between seasons and have to be re-added, which is neither how
              it works nor a comfortable thing to imply to someone whose season has just ended. */}
          {!active && !isTeamWorkspace && (
            <section className={styles.setupPanel}>
              <p className={styles.seasonEndNote}>
                Seasons are managed by <strong>{orgName}</strong>. When they start the next one, this
                team&apos;s portal opens up again — you don&apos;t need to do anything.
              </p>
            </section>
          )}
          </div>
        </div>
      ) : null}

      {rolloverOpen && closed && (
        <StartNextSeasonModal
          orgSlug={orgSlug}
          teamId={teamId}
          currentSeasonName={closed.programYearName}
          defaultNextYear={(closed.programYearYear ?? new Date().getFullYear()) + 1}
          onClose={() => setRolloverOpen(false)}
          /* ⚠ A FULL navigation, not a router push: the rollover just changed which season is
             active, and only a hard load re-seeds the coaches context. */
          onDone={() => { window.location.assign(base); }}
        />
      )}
    </div>
  );
}
