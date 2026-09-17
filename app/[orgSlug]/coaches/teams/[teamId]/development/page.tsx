'use client';
import { use, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { TrendingUp, Plus, HelpCircle, ArrowRight, ChevronRight } from 'lucide-react';
import { useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachTabBar from '@/components/coaches/CoachTabBar';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { formatShortDate, formatWeekdayDate, todayLocal } from '@/lib/measurable-format';
import { developmentReports } from '@/lib/development-report';
import { lastPlanMetricIds, lastPlannedCounts, lastRunDates, planCandidates, scopeSummary, sessionState, sessionTitle } from '@/lib/development-session-view';
import SessionSheet, { type SessionRosterRow, type SessionEventOption, type SessionFacts } from '@/components/coaches/SessionSheet';
import MetricDefinitionSheet from '@/components/coaches/MetricDefinitionSheet';
import { canManageSchedule, canViewMeasurables, canWriteDevelopment } from '@/lib/coach-capabilities';
import { playerName as rosterPlayerName } from '@/lib/coach-roster-name';
import { skillsAndGoalsHref, parseSkillsAndGoalsSection, parseMetricEdit, playerDevelopmentHref, insightsDevelopmentHref, COVERAGE_FOCUS, type SkillsAndGoalsSection } from '@/lib/development-address';
import { activeMeasuredTests, recordMeaning } from '@/lib/measurable-definition';
import Muted from '@/components/coaches/Muted';
import styles from '../../../coaches.module.css';
import ov from './overview.module.css';
import { CoachCard, CoachEyebrow, CoachFigure, CoachChip, CoachBar, CoachRail, CoachListToolbar, kit } from '@/components/coaches/kit';
import type { RepTeamEvaluationSession, RepTeamMeasurableType } from '@/lib/types';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** The Sessions list grows a search once it is long enough to need finding (round 2, owner 2026-09-15). */
const SEARCH_FROM = 9;

/** The board read, as the Overview's counts read it (the route is unchanged; Coverage in Insights reads the same rows). */
interface BoardRow {
  playerId: string;
  firstName: string;
  lastName: string | null;
  number: string | null;
  goals: { id: string; focusArea: string; status: string; reviewOn: string | null }[];
  /** The HEADLINE of the latest session per test (Phase 2) — never the last row typed. */
  latest: Record<string, { value: number; unit: string; recordedOn: string; attempts: number; inRange: number | null }>;
  latestObservation?: Record<string, { descriptor: string | null; note: string | null; observedOn: string }>;
}
interface BoardData { showGoals: boolean; showMeasurables: boolean; rows: BoardRow[] }

export default function DevelopmentHubPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  // Fresh instance per team — no cross-team fetch races or stale drafts (3A key= pattern).
  return <DevelopmentHub key={teamId} orgSlug={orgSlug} teamId={teamId} />;
}

/**
 * ═══ SKILLS & GOALS — three views on one screen ═══
 *
 * Overview · Sessions · Metrics. `?section=` addresses the view, the Money and Insights hubs'
 * convention (`CoachTabBar`), so a tab is a real, shareable address; the bare address is the
 * Overview.
 *
 * **Overview is the LANDING (re-evaluation stage 0, owner ruling 2026-09-14) — Money's shape in
 * full.** While the team has no measured test it is ONE card ("Start by deciding what this team
 * measures", the lime into the metric editor); with tests but no session, the same card says "Run
 * your first session"; once a session exists it is the season's dashboard — three counts, what
 * needs attention, the rooms behind the tabs with a status each. State, not analysis: every figure
 * is read by the readers the Insights reports use, and each tile is a door to the room that holds
 * the detail, never a fourth reading of Coverage.
 *
 * Sessions is the list — to the table standard since re-evaluation stage 2 (C5, 2026-09-15): a
 * Date column is the door, Session holds the note and the practice, Ran says the plan, State is derived, the
 * chevron last; Delete lives in the session's sheet, never on a row. Metrics is the library, with
 * its sheet over the tab.
 *
 * ⚠ THE PLAYERS TAB IS GONE (re-evaluation stage 4, owner ruling G1, 2026-09-16). It drew the same
 * cell from the same board read as Insights → Coverage — one table in two sets of chrome — and the
 * gate decided which copy stays: this hub is all-or-nothing behind the Development grant (D5),
 * while Insights is read by every coach with record access. A read must not move behind a write
 * grant, so Coverage is the home (it took the one thing Players had — Current focus as a Show
 * choice) and this tab left. The Overview's doors to the roster open Coverage; `?section=players`
 * lands on the Overview.
 *
 * ⚠ The header's lime action follows the stage: absent while nothing can start (a switched-off
 * primary was the first thing on the old landing), "+ Start session" once a test exists.
 * ⚠ `data-sandbox-tour="development-sessions"` on the sessions card is a contract with the demo
 * tour ("Find the two blanks" lands on it) — the tour's destination is the Sessions TAB now that
 * the landing is the Overview. It stays on the Sessions view's card.
 * ⚠ The four door tiles (Insights · Drills · Plan templates · Players) and the "practice plans live
 * in your Schedule" line are GONE (stage 0): Insights has its own door, and the practice
 * instruments belong to the practice-plans work. The drill library keeps no door here.
 * ⚠ A coach WITHOUT the Development grant has no door at all (D5): the nav hides Skills & Goals,
 * and this page — and the rooms inside it — render the shared not-granted block. "Either they can
 * see and update everything in here or they cannot."
 * ⚠ A metric's DEFINITION is a sheet over this page (re-evaluation stage 1, 2026-09-14), addressed
 * by `?edit=new|<id>` on whichever section is on screen — the Overview's card and the Metrics rows
 * open it here, and Save lands the coach back on the section they were on
 * with the data re-read. The old `/development/metrics/…` pages redirect into this address.
 */
function DevelopmentHub({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const router = useRouter();
  const { openHelp } = useHelpDrawer();
  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const page = useCoachSeasonPage(orgSlug, teamId);
  // Chunk F: THAT season's grants (governing rule 1), not the coach's current ones.
  const caps = page.capabilities;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development`;

  const searchParams = useSearchParams();
  const section = parseSkillsAndGoalsSection(searchParams.get('section'));
  // The definition sheet rides the address (stage 1): `new` defines, an id edits, over this section.
  const edit = parseMetricEdit(searchParams.get('edit'));

  const [sessions, setSessions] = useState<RepTeamEvaluationSession[] | null>(null);
  const [types, setTypes] = useState<RepTeamMeasurableType[] | null>(null);
  // The session sheet's lists (Phase 2) — the active roster and the season's events, from the same fetch.
  const [scopeRoster, setScopeRoster] = useState<SessionRosterRow[]>([]);
  const [scopeEvents, setScopeEvents] = useState<SessionEventOption[]>([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // ONE source for the write flag, resilient to the sessions GET 404'ing (no active program
  // year must not silently lock the library for a legit head coach).
  const canWrite = (caps ? canWriteDevelopment(caps) : false);

  // `label` is required here — this object also goes straight to openHelp() from the empty state,
  // where there is no HelpButton label to fall back to.
  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-development'],
    label: 'Skills & Goals',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-development`,
  };

  // ONE fetch: the sessions GET carries sessions + types + canWrite (board-route precedent —
  // two separate GETs doubled the auth/capability resolution per hub load).
  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/sessions`);
      const json = await res.json().catch(() => null);
      if (res.status === 404) {
        // No active program year — the hub still renders honestly empty.
        setSessions([]);
        setTypes([]);
        setError('');
        return;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load Development — try again.');
      setSessions(json.sessions);
      setTypes(json.types);
      setScopeRoster(Array.isArray(json.roster) ? json.roster : []);
      setScopeEvents(Array.isArray(json.events) ? json.events : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Development — try again.');
      setSessions(s => s ?? []);
      setTypes(t => t ?? []);
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  /**
   * The board read — the Overview's counts (players measured, goals working, reviews due). Off the
   * first-paint path on purpose: the hub renders at the speed of the sessions GET and the cards
   * fill in a moment later. Failure is quiet and safe — the cards say they couldn't load, which
   * never hides a door from a coach who has data. (The Players view that drew these rows is gone,
   * stage 4 — Insights → Coverage reads the same route.)
   */
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardError, setBoardError] = useState('');
  // Gated the way its own precedent gates it (/review): the board route requires record access,
  // so a coach without it must not fire a request that can only ever 403.
  const canSeeBoard = caps ? canViewMeasurables(caps) : false;
  useEffect(() => {
    if (!canSeeBoard) return;
    let cancelled = false;
    fetch(`${apiBase}/board`)
      .then(async res => (res.ok || res.status === 404 ? res.json().catch(() => null) : Promise.reject(new Error('Could not load the players — try again.'))))
      .then(data => {
        if (cancelled) return;
        setBoard(data && Array.isArray(data.rows) ? data : { showGoals: false, showMeasurables: false, rows: [] });
        setBoardError('');
      })
      .catch(e => { if (!cancelled) setBoardError(e instanceof Error ? e.message : 'Could not load the players — try again.'); });
    return () => { cancelled = true; };
  }, [apiBase, canSeeBoard]);

  /**
   * "+ Start session" asks for the session's facts first (Phase 2; the one sheet since stage 2, C4):
   * when — at a practice or on a date — a note, what we are running with a count per test, and who
   * is here. The session is created with its plan and opens on the grid.
   */
  async function startSession(v: SessionFacts) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDate: v.sessionDate, eventId: v.eventId, note: v.note || null, scope: v.scope }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not start a session — try again.');
      setScopeOpen(false);
      router.push(`${base}/development/sessions/${json.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a session — try again.');
    } finally {
      // Released in every outcome: a Back-navigation can hand this same instance back with its state
      // intact, and a lock left on after a successful push would stay on until a hard reload.
      setBusy(false);
    }
  }

  // The not-granted block is the subtree's layout (`development/layout.tsx`, D5): a coach without
  // the Development grant never reaches this component, so `canWrite` below is the head-coach /
  // granted-assistant answer and never false for a mounted hub.

  const loading = sessions === null || types === null;

  /* ── The season's STAGE — the one thing the Overview and the header both turn on ──────
     A session can only record a measured TEST, so a team with no ACTIVE test has exactly one
     thing to do — define one. Retired tests and observed skills are excluded on purpose: neither
     can take a reading, and the server guard counts the same way. With a test but no session,
     the next move is the first session; once one exists the team is running. */
  const hasSessions = (sessions ?? []).length > 0;
  const stage: OverviewStage = loading ? 'running'
    : activeMeasuredTests(types ?? []).length === 0 ? 'define'
    : hasSessions ? 'running' : 'record';
  const metricsHref = skillsAndGoalsHref(base, 'metrics');
  const openScope = () => { setError(''); setScopeOpen(true); };
  // The sheet closes onto the section it opened over — same address, minus `edit`.
  const closeSheet = () => router.replace(skillsAndGoalsHref(base, section));

  /* ── The header's one lime action: Start session (page-level actions rule, 2026-08-13) — it
        opens the scope step (Phase 2). ABSENT while nothing can start (stage 0, D2): the old
        landing led with a switched-off lime button whose reason sat in a box below the tabs; now
        the Overview card carries the first move, and the header earns its lime once a test exists. */
  const startAction = !canWrite || loading || stage === 'define' ? undefined : (
    <button type="button" className={styles.btnPrimary} disabled={busy} onClick={openScope}>
      <Plus size={15} aria-hidden /> Start session
    </button>
  );

  const tabs: { id: SkillsAndGoalsSection; label: string; href: string }[] = [
    { id: 'overview', label: 'Overview', href: skillsAndGoalsHref(base, 'overview') },
    { id: 'sessions', label: 'Sessions', href: skillsAndGoalsHref(base, 'sessions') },
    { id: 'metrics', label: 'Metrics', href: metricsHref },
  ];

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the team name is the masthead's job; the first-use
          guidance is the Overview's card (stage 0). */}
      <CoachPageHeader
        icon={TrendingUp}
        title="Skills & Goals"
        helpLabel="Skills & Goals"
        help={helpRequest}
        actions={startAction}
      />

      <CoachTabBar tabs={tabs} activeId={section} ariaLabel="Skills and Goals views" />

      {error && <p className={styles.errorText} role="alert">{error}</p>}
      {loading ? (
        <div className={styles.loadingState}>Loading development…</div>
      ) : (
        <div className={styles.devBands}>
          {section === 'overview' && (
            <OverviewView
              base={base}
              stage={stage}
              types={types ?? []}
              sessions={sessions ?? []}
              board={board}
              boardError={boardError}
              // Practice review is offered with the schedule grant — the rail's report count says what THIS coach can open.
              reportCount={developmentReports(caps ? canManageSchedule(caps) : false).length}
              onStart={openScope}
              onHelp={() => openHelp(helpRequest)}
            />
          )}
          {section === 'sessions' && (
            <SessionsView
              base={base}
              sessions={sessions ?? []}
              types={types ?? []}
              noTestYet={stage === 'define'}
              metricsHref={metricsHref}
              hasSessions={hasSessions}
              onHelp={() => openHelp(helpRequest)}
            />
          )}
          {section === 'metrics' && (
            <MetricsView base={base} types={types ?? []} canWrite={canWrite} />
          )}
        </div>
      )}
      {scopeOpen && (
        <SessionSheet
          mode="start"
          orgSlug={orgSlug}
          teamId={teamId}
          types={planCandidates(types ?? [])}
          roster={scopeRoster}
          events={scopeEvents}
          // The pre-fill per test (C1): last time's count, else the definition's, else one.
          defaultCounts={lastPlannedCounts(sessions ?? [], planCandidates(types ?? []))}
          // Tonight starts as last time (C11): the team's last plan (null → the whole library), and
          // when each metric last ran, for the add field's captions — both from the list already here.
          lastPlanIds={lastPlanMetricIds(sessions ?? [], planCandidates(types ?? []))}
          lastRun={lastRunDates(sessions ?? [], planCandidates(types ?? []))}
          busy={busy}
          error={error}
          onSubmit={startSession}
          onClose={() => { if (!busy) setScopeOpen(false); }}
          onTypeDefined={t => setTypes(list => [...(list ?? []), t])}
        />
      )}
      {/* Mounted per open (keyed by what it edits) so one definition's draft never leaks into the next. */}
      {edit && canWrite && !loading && (
        <MetricDefinitionSheet
          key={edit}
          orgSlug={orgSlug}
          teamId={teamId}
          typeId={edit === 'new' ? null : edit}
          initial={edit === 'new' ? null : (types?.find(t => t.id === edit) ?? null)}
          onClose={closeSheet}
          onSaved={() => { void load(); closeSheet(); }}
        />
      )}
    </div>
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────────────────────

/**
 * The Sessions list, to the table standard (stage 2, C5; revised on the owner's read of the build,
 * 2026-09-15): DATE is its own column and the door (the date is the link, never a row-level click),
 * SESSION holds the note and "at <practice> ›" on the same line — so a row is ONE line at the compact
 * height (the frame drew the note as a caption under the date, a comfortable two-line row; the owner
 * asked for the ledger's shape instead, a chronological list reads that way and the Ledger and
 * Schedule tables already do). RAN says the plan ("5 players · 3 tests · 1 skill" — a session from
 * before plans says what was recorded), STATE is derived by the Overview's rule (unfinished · N of M
 * to record · Complete · a dash with no plan), the chevron last. No × — Delete session lives in the
 * session's sheet. On a phone the card is the row: the date as its title, the note under it, one
 * line each for Ran and State, a corner chevron.
 */
function SessionsView({
  base, sessions, types, noTestYet, metricsHref, hasSessions, onHelp,
}: {
  base: string;
  sessions: RepTeamEvaluationSession[];
  types: RepTeamMeasurableType[];
  /** No active measured test — a session cannot start, and the empty state says where to go. */
  noTestYet: boolean;
  metricsHref: string;
  hasSessions: boolean;
  onHelp: () => void;
}) {
  const router = useRouter();
  // The search is this view's own state — a keystroke must not re-render the hub around it.
  const [query, setQuery] = useState('');
  // A session row is its date, its note and its practice; the search box finds any. The searchable
  // text is built once per list, not once per keystroke (date formatting is an Intl call).
  const searchable = useMemo(
    () => sessions.map(s => ({ s, text: `${sessionTitle(s)} ${s.sessionDate} ${s.eventName ?? ''}`.toLowerCase() })),
    [sessions],
  );
  const needle = query.trim().toLowerCase();
  const shown = needle ? searchable.filter(x => x.text.includes(needle)).map(x => x.s) : sessions;
  const href = (s: RepTeamEvaluationSession) => `${base}/development/sessions/${s.id}`;
  /** Ran — the plan, or what was recorded on a session from before plans existed. */
  const ran = (s: RepTeamEvaluationSession) =>
    scopeSummary(s, types) ?? ((s.playerCount ?? 0) > 0 ? `${plural(s.playerCount ?? 0, 'player')} · ${plural(s.typeCount ?? 0, 'test')}` : null);

  return (
    <>
      {/* data-sandbox-tour: the beat the demo's "Find the two blanks" step rings — a session where
          eleven of thirteen were tested and the other two read as a dash. Inert off a demo org.
          Money's list-tab grammar (2026-09-14): the toolbar on the paper, the table on white. */}
      <div data-sandbox-tour="development-sessions">
        {/* ONE line above the table (round 2, owner 2026-09-15): the count. The lesson ("run your
            tests for the whole roster in one go…") lives on the empty state and the Overview's
            first-run card, where a coach who has not run a session reads it; a list that has
            sessions has learned it. The search waits for a list long enough to need finding
            (nine sessions or more) and is a bare field when it comes — no label band. */}
        {hasSessions && (
          <CoachListToolbar
            lede={<><strong>{sessions.length}</strong> {sessions.length === 1 ? 'session' : 'sessions'} this season</>}
            actions={sessions.length >= SEARCH_FROM && (
              <label className={styles.field} style={{ flex: '0 1 240px' }}>
                <span className={styles.srOnly}>Find a session</span>
                <input type="search" className={`${styles.input} ${styles.devToolbarControl}`} value={query} placeholder="Find a session…"
                  onChange={e => setQuery(e.target.value)} />
              </label>
            )}
          />
        )}

        {hasSessions ? (
          shown.length === 0 ? (
            <p className={styles.detailPlaceholder}>No session matches “{query.trim()}”.</p>
          ) : (
            /* ONE table on the list recipe — the .tableAsCards primitive reflows rows to cards @640
               (the lead cell has no label: it renders as the card title; the chevron pins to the
               card's corner). ⚠ The shared card recipe tints an item card on a phone; the table
               standard says an item row is never tinted — flagged to the standard, not forked here. */
            <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
              <table className={styles.table} aria-label="Sessions">
                <thead>
                  <tr>
                    <th className={`${styles.th} ${styles.tdShrink}`}>Date</th>
                    <th className={styles.th}>Session</th>
                    <th className={`${styles.th} ${styles.tdShrink}`}>Ran</th>
                    <th className={`${styles.th} ${styles.tdShrink}`}>State</th>
                    <th className={styles.th} aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map(s => {
                    const state = sessionState(s);
                    return (
                      <tr key={s.id} className={`${styles.tr} ${styles.rowTappable}`} onClick={() => router.push(href(s))}>
                        {/* The DATE is the door and the card's title (a lead cell takes no `data-label`).
                            It READS as the row's name — semibold, no underline — and stays a real link
                            underneath (the standard's "name as the link"): the row's click is the pointer
                            shortcut on top, and cannot be tabbed to, announced, or opened in a new tab. */}
                        <td className={`${styles.td} ${styles.tdShrink} ${styles.cardStackCell}`}>
                          <Link href={href(s)} className={`${styles.devCellLink} ${styles.devSessionDate}`} onClick={e => e.stopPropagation()}>{formatWeekdayDate(s.sessionDate, 'short')}</Link>
                        </td>
                        {/* SESSION — the note and "at <practice> ›" on one line, in its own column, so the
                            row is one line (owner, 2026-09-15). No caption class: a caption would ask the
                            row for the comfortable height this column exists to give back. On a phone it
                            is the line under the date's title, with no label of its own; a session with
                            neither a note nor a practice leaves the cell empty, and the card hides it. */}
                        <td className={`${styles.td} ${styles.cardStackCell}`}>
                          {/* ONE span: the card stacks each child of this cell on its own line, and the
                              note, the practice link and its › are one sentence. */}
                          {(s.note || s.eventName) && (
                            <span>
                              {s.note}
                              {/* The practice door steps back to the secondary ink — a door you can find,
                                  not the row's loudest line (round 2). */}
                              {s.eventName && (
                                <span className={styles.devSessionAt}>
                                  {s.note ? ' · ' : ''}at <Link href={`${base}/practice/${s.eventId}`} onClick={e => e.stopPropagation()}>{s.eventName}</Link> ›
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        {/* The plan on one line, in the secondary ink — a figure about the session, not the session. */}
                        <td className={`${styles.td} ${styles.tdShrink} ${styles.devSessionRan}`} data-label="Ran">
                          {ran(s) ?? <Muted>nothing yet</Muted>}
                        </td>
                        {/* State says its state ONCE (round 2): the figure in amber IS "unfinished"; Complete
                            in the quiet green; a dash where there is no plan to measure. No chip here — the
                            Overview's chip counts sessions, a different fact. */}
                        <td className={`${styles.td} ${styles.tdShrink} ${styles.devSessionState}`} data-label="State">
                          {state === 'unfinished' ? (
                            <span className={styles.devSessionOpen}>{s.unrecordedCount} of {s.scopeCellCount} to record</span>
                          ) : state === 'complete' ? <span className={styles.devSessionDone}>Complete</span> : <Muted>—</Muted>}
                        </td>
                        <td className={`${styles.td} ${styles.cardActionCell} ${styles.cardActionCorner}`}>
                          <span className={styles.listRowActions}>
                            {/* A REAL BUTTON — the row's accessible door; one glyph on every row. */}
                            <button type="button" className={`${styles.linkBtn} ${styles.listRowToggle}`} aria-label={`Open ${sessionTitle(s)}`}
                              onClick={e => { e.stopPropagation(); router.push(href(s)); }}>
                              <ChevronRight size={16} className={styles.listRowChevron} aria-hidden />
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // The header owns the ONE lime action ("Start session") once a test exists, so this empty
          // teaches and links to the guide rather than repeating the button. With no test yet it
          // names the one thing to do — the Overview's card says the same, one tab over.
          <CoachEmptyState
            compact
            headline="No sessions yet"
            description="A session runs your tests across the whole roster in one go, usually at a practice."
            payoff="A few a season is what turns single results into a trend — and it's what fills the Coverage report in Insights."
            blocker={noTestYet ? 'A session needs a test to record. Define one in Metrics first.' : undefined}
            secondaryAction={noTestYet
              ? { label: 'Open Metrics', icon: <ArrowRight size={15} aria-hidden />, href: metricsHref }
              : { label: 'How development works', icon: <HelpCircle size={15} aria-hidden />, onClick: onHelp }}
          />
        )}
      </div>
    </>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────────────────────

type OverviewStage = 'define' | 'record' | 'running';

/** The arc, four words, the stage's word in bold — the one sentence that says what the room is for. */
function Arc({ stage }: { stage: OverviewStage }) {
  const words: [string, string][] = [['define', 'Define'], ['record', 'Record'], ['review', 'Review'], ['share', 'Share']];
  return (
    <p className={ov.arc} aria-label="How development works: define, record, review, share">
      {words.map(([k, w], i) => (
        <span key={k}>{i > 0 && <span aria-hidden> → </span>}{k === stage ? <b>{w}</b> : w}</span>
      ))}
    </p>
  );
}

/**
 * The landing (stage 0, 2026-09-14) — Money's Overview, for development. Two shapes the page
 * picks between by STAGE, both ending in the same tab bar: the getting-started card while there
 * is nothing to count, the dashboard once there is. Nothing here is a fourth reading of a report:
 * every figure is the same reader Insights → Coverage uses, and every tile is a door — the roster
 * doors open Coverage (stage 4, G1), the Goals card's on Current focus.
 */
function OverviewView({ base, stage, types, sessions, board, boardError, reportCount, onStart, onHelp }: {
  base: string;
  stage: OverviewStage;
  types: RepTeamMeasurableType[];
  sessions: RepTeamEvaluationSession[];
  board: BoardData | null;
  boardError: string;
  /** How many reports Insights → Development offers THIS coach — computed, never typed. */
  reportCount: number;
  onStart: () => void;
  onHelp: () => void;
}) {
  const active = types.filter(t => t.isActive);
  // The definition sheet opens OVER the Overview (stage 1): the card's lime lands in it and Save
  // lands back on the card, which has advanced by then.
  const metricsNewHref = skillsAndGoalsHref(base, 'overview', { edit: 'new' });

  if (stage === 'define') {
    return (
      <CoachCard accent className={`${styles.nowCard} ${styles.nowPreseason}`}>
        <p className={styles.nowEyebrow}>Skills &amp; Goals · Getting started</p>
        <p className={styles.nowHeadline}>Start by deciding what this team measures</p>
        <p className={styles.nowMeta}>
          A <strong>metric</strong> is a test you record the same way every time — a 60-yd sprint in seconds — or a skill
          you watch for. Define one, and a session records it for the whole roster in one go.
        </p>
        <Arc stage="define" />
        <div className={styles.nowActions}>
          <Link href={metricsNewHref} className="btn btn-lime btn-sm">Define your first metric <ArrowRight size={14} aria-hidden /></Link>
          <button type="button" className={`${styles.nowSecondary} ${ov.linkButton}`} onClick={onHelp}>How development works <ArrowRight size={13} aria-hidden /></button>
        </div>
      </CoachCard>
    );
  }

  if (stage === 'record') {
    // The metrics NAMED from the definitions — computed, never typed (the demo rule holds here too).
    const names = active.map(t => t.name);
    const named = names.length <= 3
      ? names.map((n, i) => <span key={i}>{i > 0 && (i === names.length - 1 ? ' and ' : ', ')}<strong>{n}</strong></span>)
      : <><strong>{names[0]}</strong>, <strong>{names[1]}</strong> and {names.length - 2} more</>;
    return (
      <CoachCard accent className={`${styles.nowCard} ${styles.nowPreseason}`}>
        <p className={styles.nowEyebrow}>Skills &amp; Goals · Ready to record</p>
        <p className={styles.nowHeadline}>Run your first session</p>
        <p className={styles.nowMeta}>
          You&apos;ll record {named} across the roster in one go — usually at a practice. A few sessions a season
          is what turns single results into a trend.
        </p>
        <Arc stage="record" />
        <div className={styles.nowActions}>
          <button type="button" className="btn btn-lime btn-sm" onClick={onStart}><Plus size={14} aria-hidden /> Start session</button>
          <Link href={metricsNewHref} className={styles.nowSecondary}>Add another metric <ArrowRight size={13} aria-hidden /></Link>
        </div>
      </CoachCard>
    );
  }

  // ── running: the dashboard — Money's grammar (owner, 2026-09-14): three story cards, then
  //    "Needs attention" beside the rail. Every figure is the same reader Insights → Coverage
  //    uses; nothing here is a fourth reading of Coverage. ──
  const latest = sessions[0] ?? null; // newest-first from the reader
  const coverageHref = insightsDevelopmentHref(base);
  // Coverage opened on its first Show choice — the goals as words (the Players view's "Current focus", moved there).
  const focusHref = insightsDevelopmentHref(base, { metricId: COVERAGE_FOCUS });
  const rows = board?.rows ?? [];
  const measured: BoardRow[] = [], unmeasured: BoardRow[] = [];
  for (const r of rows) (Object.keys(r.latest).length > 0 || Object.keys(r.latestObservation ?? {}).length > 0 ? measured : unmeasured).push(r);
  // ONE name rule (lib/coach-roster-name.ts) — the roster's, not a third inline join.
  const playerName = (r: BoardRow) => rosterPlayerName({ playerFirstName: r.firstName, playerLastName: r.lastName });
  const working = rows.flatMap(r => r.goals.filter(g => g.status === 'working').map(g => ({ ...g, playerId: r.playerId, playerName: playerName(r) })));
  // A review is "due" by the coach's local day, never the server's UTC today.
  const today = todayLocal();
  const byReviewOn = (a: { reviewOn: string | null }, b: { reviewOn: string | null }) => (a.reviewOn ?? '').localeCompare(b.reviewOn ?? '');
  const reviewsDue = working.filter(g => g.reviewOn && g.reviewOn <= today).sort(byReviewOn);
  const unfinished = sessions.filter(s => (s.unrecordedCount ?? 0) > 0);
  const boardReady = board !== null;
  const dash = <span className={styles.devBoardMuted}>—</span>;
  const coveragePct = rows.length > 0 ? Math.round((measured.length / rows.length) * 100) : 0;
  const nextReview = working.filter(g => g.reviewOn && g.reviewOn > today).sort(byReviewOn)[0] ?? null;
  const attentionCount = reviewsDue.length + (unmeasured.length > 0 ? 1 : 0) + unfinished.length;

  return (
    <>
      {/* The kit's card, eyebrow, chip, figure, bar and foot (components/coaches/kit — owner rulings
          A–H, 2026-09-16): the SAME parts Money's Overview renders, so the two dashboards cannot
          drift. This file keeps only what is Skills & Goals': the arc line, the attention list. */}
      <div className={kit.row3}>
        {/* Sessions — the count, the latest, and whether any were left half-recorded. */}
        <CoachCard alert={unfinished.length > 0}>
          <CoachEyebrow
            chip={unfinished.length > 0
              ? <CoachChip tone="danger">{plural(unfinished.length, 'unfinished session')}</CoachChip>
              : <CoachChip tone="good">all complete</CoachChip>}
          >
            Sessions
          </CoachEyebrow>
          <CoachFigure>{sessions.length} <small>this season</small></CoachFigure>
          <p className={kit.sub}>
            {latest ? <>Last <b>{formatShortDate(latest.sessionDate)}</b>{latest.note ? ` · ${latest.note}` : ''}</> : 'None yet'}
          </p>
          <div className={kit.foot}>
            <Link href={skillsAndGoalsHref(base, 'sessions')} className={kit.footLink}>Sessions →</Link>
          </div>
        </CoachCard>

        {/* Players measured — the one ratio on the screen, so it gets the bar. */}
        <CoachCard>
          <CoachEyebrow
            chip={boardReady && rows.length > 0 && (
              <CoachChip tone={measured.length === rows.length ? 'good' : 'warn'}>
                {measured.length === rows.length ? 'everyone' : `${unmeasured.length} without`}
              </CoachChip>
            )}
          >
            Players measured
          </CoachEyebrow>
          {boardReady ? (
            <>
              <CoachFigure tone={measured.length > 0 ? 'good' : undefined}>{measured.length} <small>of {rows.length} · {coveragePct}%</small></CoachFigure>
              <CoachBar
                segments={[{ pct: coveragePct }]}
                label={`${measured.length} of ${rows.length} players measured`}
                legend={[
                  { dot: 'fill', text: <><b>{measured.length}</b> with a result</> },
                  { dot: 'track', text: <><b>{unmeasured.length}</b> without</> },
                ]}
              />
            </>
          ) : (
            <>
              <CoachFigure>{dash}</CoachFigure>
              <p className={kit.sub}>{boardError || 'Loading…'}</p>
            </>
          )}
          <div className={kit.foot}>
            <Link href={coverageHref} className={kit.footLink}>Coverage →</Link>
          </div>
        </CoachCard>

        {/* Goals — working, with the reviews falling due. */}
        <CoachCard alert={reviewsDue.length > 0}>
          {/* ⚠ "no reviews due" — never "on track" (chart rule 6; stage 4, G7): the product states what
              the record holds and does not grade a child's progress against a schedule. */}
          <CoachEyebrow
            chip={boardReady && (reviewsDue.length > 0
              ? <CoachChip tone="danger">{plural(reviewsDue.length, 'review')} due</CoachChip>
              : working.length > 0
                ? <CoachChip tone="good">no reviews due</CoachChip>
                : null)}
          >
            Goals
          </CoachEyebrow>
          <CoachFigure>{boardReady ? <>{working.length} <small>working</small></> : dash}</CoachFigure>
          <p className={kit.sub}>
            {!boardReady ? (boardError || 'Loading…')
              : reviewsDue.length > 0 ? <>Overdue: <b>{reviewsDue[0].playerName}</b>{reviewsDue.length > 1 ? ` and ${reviewsDue.length - 1} more` : ''}</>
              : nextReview ? <>Next review <b>{formatShortDate(nextReview.reviewOn!)}</b> · {nextReview.playerName}</>
              : working.length > 0 ? 'No review dates set' : 'No goals set yet'}
          </p>
          <div className={kit.foot}>
            <Link href={focusHref} className={kit.footLink}>Coverage →</Link>
          </div>
        </CoachCard>
      </div>

      <div className={kit.row2}>
        {/* What needs attention — the "this week" the lifecycle had nowhere (Standing back, S4).
            A count and a name, each a door to where you act; never a chart. */}
        <CoachCard alert={reviewsDue.length > 0 || unfinished.length > 0}>
          <CoachEyebrow
            chip={boardReady && (attentionCount > 0
              ? <CoachChip tone={reviewsDue.length > 0 || unfinished.length > 0 ? 'danger' : 'warn'}>{attentionCount}</CoachChip>
              : <CoachChip tone="good">all clear</CoachChip>)}
          >
            Needs attention
          </CoachEyebrow>
          {boardError && <p className={styles.errorText} role="alert">{boardError}</p>}
          {boardReady && attentionCount === 0 ? (
            <p className={ov.allClear}>Nothing waiting — every goal is reviewed, every player has a result, every session is complete.</p>
          ) : (
            <ul className={ov.attn}>
              {reviewsDue.map(g => (
                <li key={g.id} className={ov.attnRow}>
                  <span className={`${ov.attnDot} ${ov.attnDue}`} aria-hidden />
                  <span className={ov.attnMain}>
                    <b>Goal review due</b> — {g.playerName}, “{g.focusArea}”
                    <small>{g.reviewOn! < today ? `was due ${formatShortDate(g.reviewOn!)}` : 'due today'}</small>
                  </span>
                  <Link href={playerDevelopmentHref(base, g.playerId, { view: 'goals', goalId: g.id, returnTo: skillsAndGoalsHref(base, 'overview') })} className={ov.attnLink}>Review →</Link>
                </li>
              ))}
              {unfinished.map(s => (
                <li key={s.id} className={ov.attnRow}>
                  <span className={`${ov.attnDot} ${ov.attnDue}`} aria-hidden />
                  <span className={ov.attnMain}>
                    <b>{formatShortDate(s.sessionDate)} session left unfinished</b>
                    <small>{s.unrecordedCount} of {s.scopeCellCount} in scope not recorded{s.note ? ` · ${s.note}` : ''}</small>
                  </span>
                  <Link href={`${base}/development/sessions/${s.id}`} className={ov.attnLink}>Open →</Link>
                </li>
              ))}
              {boardReady && unmeasured.length > 0 && (
                <li className={ov.attnRow}>
                  <span className={`${ov.attnDot} ${ov.attnWarn}`} aria-hidden />
                  <span className={ov.attnMain}>
                    <b>{unmeasured.length === 1 ? '1 player has' : `${unmeasured.length} players have`} no result this season</b>
                    <small>{unmeasured.slice(0, 4).map(playerName).join(', ')}{unmeasured.length > 4 ? ` and ${unmeasured.length - 4} more` : ''}</small>
                  </span>
                  <Link href={coverageHref} className={ov.attnLink}>Coverage →</Link>
                </li>
              )}
            </ul>
          )}
        </CoachCard>

        {/* Everything in Skills & Goals — the kit's rail (Money's, drawn once): the rooms in the arc's
            order, a figure each. (The Players row went with the tab, stage 4 — the roster is read in
            Insights.) */}
        <CoachRail
          title={<>Everything in Skills &amp; Goals</>}
          idPrefix="sg-rail"
          groups={[{
            rows: [
              { key: 'metrics', href: skillsAndGoalsHref(base, 'metrics'), dot: 'plum', name: 'Metrics', stat: <><b>{active.length}</b> active</> },
              { key: 'sessions', href: skillsAndGoalsHref(base, 'sessions'), dot: 'good', name: 'Sessions', stat: <><b>{sessions.length}</b> this season</> },
              { key: 'reports', href: coverageHref, dot: 'olive', name: 'Reports', note: 'in Insights', stat: <><b>{reportCount}</b> {reportCount === 1 ? 'report' : 'reports'}</> },
            ],
          }]}
        />
      </div>
    </>
  );
}

// ── Metrics ───────────────────────────────────────────────────────────────────────────────────

/**
 * The library (mockup screen 1, RESTYLED from "Your test list"; named "Metrics" by owner ruling
 * 2026-09-11 — everything on this screen is already the coach's own, so "your" said it twice).
 * Tests and skills together, each with what a record of it means. Defining and editing happen in
 * the definition SHEET over this tab (stage 1); retire and restore live in it.
 *
 * Two columns (stage 1, B3): the row carries the exception — a test reads name · unit, a skill
 * name · skill — and the unit is said once. The Kind column said "Test" on three rows in four.
 * The method is not on the row (B10): it is the coach's optional note, never a to-do — the
 * UNFINISHED chip and Finish → door B6 drew were reversed on the build (owner, 2026-09-14).
 * Retired metrics are the SAME rows under a fold (B11), a step quieter.
 */
function MetricsView({ base, types, canWrite }: { base: string; types: RepTeamMeasurableType[]; canWrite: boolean }) {
  const active = types.filter(t => t.isActive);
  const retired = types.filter(t => !t.isActive);
  const editorHref = (id: string) => skillsAndGoalsHref(base, 'metrics', { edit: id });

  // One row shape for a live and a retired metric — the name column says the unit or the kind
  // once (B3); the second column says what a record means, and for a retired metric, that it is
  // retired. The retired rows are the SAME table (owner, 2026-09-14: the fold used to open on a
  // pill list from an older idiom — a difference the table standard calls a bug).
  const row = (t: RepTeamMeasurableType) => {
    const meaning = t.isActive ? recordMeaning(t) : `retired · ${recordMeaning(t)}`;
    return (
      <tr key={t.id} className={t.isActive ? undefined : styles.devRetiredRow}>
        <td>
          <Link href={editorHref(t.id)} className={styles.devCellLink}>{t.name}</Link>
          {t.kind === 'skill' ? <Muted> · skill</Muted> : t.unit && <Muted> · {t.unit}</Muted>}
        </td>
        <td data-label="What a record means">{meaning}</td>
      </tr>
    );
  };
  const table = (rows: RepTeamMeasurableType[]) => (
    <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
      <table className={`${styles.devBoardTable} ${styles.devMetricsTable}`}>
        <thead>
          <tr>
            <th>Metric</th>
            <th>What a record means</th>
          </tr>
        </thead>
        <tbody>{rows.map(row)}</tbody>
      </table>
    </div>
  );

  return (
    <div>
      {/* Money's list-tab grammar (2026-09-14) — the kit's toolbar now: the lede on the paper, the
          action pinned right, the table on the card. */}
      <CoachListToolbar
        lede={<><strong>Tests record numbers. Skills describe behaviour.</strong> Goals explain what a player is working toward.</>}
        actions={canWrite && (
          <Link href={skillsAndGoalsHref(base, 'metrics', { edit: 'new' })} className={`${styles.btnSecondary} ${styles.devSectionAction}`}>
            <Plus size={14} aria-hidden /> Define a metric
          </Link>
        )}
      />

      {active.length === 0 ? (
        <CoachEmptyState
          compact
          headline="No metrics defined yet"
          description="A test is a number you record the same way every time — a 60-yd sprint in seconds. A skill is what you watch for, in your own words."
          payoff="Define your first test and a session can record it for the whole roster in one go."
        />
      ) : table(active)}

      {retired.length > 0 && (
        <details style={{ marginTop: '0.8rem' }}>
          <summary className={`${styles.devCardNote} ${styles.devDisclosureSummary}`}>Retired ({retired.length})</summary>
          <div style={{ marginTop: '0.4rem' }}>{table(retired)}</div>
          <p className={styles.devCardNote} style={{ marginTop: '0.4rem' }}>
            Retiring removes a definition from new sessions only. Its saved records stay visible in the session and player history they belong to.
          </p>
        </details>
      )}
    </div>
  );
}
