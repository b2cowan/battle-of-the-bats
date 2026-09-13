'use client';
import { use, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { TrendingUp, Plus, X, HelpCircle } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachTabBar from '@/components/coaches/CoachTabBar';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachNotGranted from '@/components/coaches/CoachNotGranted';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { todayLocal, formatValue, formatShortDate } from '@/lib/measurable-format';
import { canManageSchedule, canViewDevelopmentGoals, canViewMeasurables, canWriteDevelopment } from '@/lib/coach-capabilities';
import { insightsSectionHref } from '@/lib/coach-insights-links';
import { skillsAndGoalsHref, parseSkillsAndGoalsSection, playerDevelopmentHref, type SkillsAndGoalsSection } from '@/lib/development-address';
import { activeMeasuredTests, measuredTestsWithHistory, recordMeaning, KIND_LABELS } from '@/lib/measurable-definition';
import styles from '../../../coaches.module.css';
import type { RepTeamEvaluationSession, RepTeamMeasurableType } from '@/lib/types';

function formatSessionDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** The quiet cell — a dash, "none yet", "not recorded". */
const Muted = ({ children }: { children: React.ReactNode }) => <span className={styles.devBoardMuted}>{children}</span>;

/** The board read, as the Players tab and the door softening read it (the route is unchanged). */
interface BoardRow {
  playerId: string;
  firstName: string;
  lastName: string | null;
  number: string | null;
  goals: { focusArea: string; status: string }[];
  latest: Record<string, { value: number; unit: string; recordedOn: string }>;
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
 * ═══ SKILLS & GOALS — three views on one screen (Phase 1, mockup screen 1; owner-approved
 * 2026-09-11, amending the 31 July band stack) ═══
 *
 * Sessions (the everyday work — a list of "date — note", a search box, one primary Start session),
 * Players (the team board's job, IN PLACE: roster order with a metric selector, the board's own
 * page redirects here) and Metrics (the library — was "Your test list" — out of the everyday
 * screen, with its editor on a page of its own). `?section=` addresses the view, the Money and
 * Insights hubs' convention (`CoachTabBar`), so a tab is a real, shareable address.
 *
 * ⚠ `data-sandbox-tour="development-sessions"` on the sessions card is a contract with the demo
 * tour ("Find the two blanks" lands on it). It stays on the Sessions view's card.
 * ⚠ The drills / templates / practice-plan doors stay as the quiet links they were, gated exactly
 * as before — a door that dead-ends is the same bug wearing a politer face.
 */
function DevelopmentHub({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { openHelp } = useHelpDrawer();
  const { assignments, loading: assignmentsLoading } = useCoaches();
  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);
  // Chunk F: THAT season's grants (governing rule 1), not the coach's current ones.
  const caps = page.capabilities;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development`;

  const searchParams = useSearchParams();
  const section = parseSkillsAndGoalsSection(searchParams.get('section'));
  const metricParam = searchParams.get('metric');

  const [sessions, setSessions] = useState<RepTeamEvaluationSession[] | null>(null);
  const [types, setTypes] = useState<RepTeamMeasurableType[] | null>(null);
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
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Development — try again.');
      setSessions(s => s ?? []);
      setTypes(t => t ?? []);
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  /**
   * The board read — ONE dataset, two jobs: the Players view draws it, and the two doors on the
   * Sessions view soften when there is genuinely nothing behind them (the treatment the Insights
   * hub already applies to the same doors). Off the first-paint path on purpose: the hub renders
   * at the speed of the sessions GET and the Players view / door labels fill in a moment later.
   * Failure is quiet and safe — the doors render unsoftened and the Players view says it couldn't
   * load, which never hides a door from a coach who has data.
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

  async function startSession() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDate: todayLocal() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not start a session — try again.');
      router.push(`${base}/development/sessions/${json.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a session — try again.');
    } finally {
      // Released in every outcome: a Back-navigation can hand this same instance back with its state
      // intact, and a lock left on after a successful push would stay on until a hard reload.
      setBusy(false);
    }
  }

  async function deleteSession(session: RepTeamEvaluationSession) {
    if (busy) return;
    const ok = await confirm({
      title: 'Delete this session?',
      message: 'Every reading collected in it stays on the players — they just lose the session grouping.',
      confirmText: 'Delete session',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/sessions/${session.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setSessions(list => (list ?? []).filter(s => s.id !== session.id));
    } catch {
      setError("Couldn't delete the session — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!assignmentsLoading && assignment && caps && !canViewDevelopmentGoals(caps) && !canViewMeasurables(caps)) {
    /**
     * The ONE not-granted block (staff access pass 1, 2026-09-10) — the board's page carried it
     * until it became a redirect here (Phase 1). The blocker names the duties that actually open
     * this section, which is what `canViewMeasurables` resolves to (A1: the Roster control is gone).
     */
    return (
      <div className={styles.page}>
        <CoachPageHeader icon={TrendingUp} title="Skills & Goals" helpLabel="Skills & Goals" help={helpRequest} />
        <CoachNotGranted
          icon={<TrendingUp size={20} aria-hidden />}
          section="Skills & Goals"
          what="What each player is working on and the results of the tests you run through the season — one row per player, so nobody quietly gets overlooked."
          blocker="This section opens for anyone with a team duty — the Development grant, notes, attendance, lineups, documents, money or tryouts. Ask your head coach to grant one."
        />
      </div>
    );
  }

  const loading = sessions === null || types === null;

  /* ── The one branch this page turns on ────────────────────────────────────────────
     A session can only record a measured TEST, so a team with no ACTIVE test has exactly one
     thing to do — define one — and the page says so inside the Sessions view (the first-use
     invitation lives in the selected view; the page is never rearranged around it). Retired
     tests and observed skills are excluded on purpose: neither can take a reading, and the
     server guard counts the same way. */
  const firstRun = !loading && activeMeasuredTests(types ?? []).length === 0;
  // "Every test is retired" is only true when a measured TEST exists at all — a team whose one
  // definition is an observed skill has simply not defined a test yet.
  const listExists = (types ?? []).some(t => t.kind === 'test');
  const heldBackReason = listExists
    ? (canWrite
        ? 'Every test on your list is retired — restore one, or define a new one, in Metrics and this turns on.'
        : 'Every test on the list is retired, so there’s nothing for a session to record right now.')
    : (canWrite
        ? 'Define your first test in Metrics and this turns on. A session runs your tests across the roster in one go, usually at a practice.'
        : 'Your head coach hasn’t defined a test yet, so there’s nothing to record.');

  const hasSessions = (sessions ?? []).length > 0;
  const metricsHref = skillsAndGoalsHref(base, 'metrics');

  /* ── The header's one lime action: Start session (page-level actions rule, 2026-08-13).
        Phase 1 keeps today's create-then-open behaviour; the scope step is Phase 2. aria-disabled,
        NOT `disabled`, while held back: a disabled button leaves the tab order, so a keyboard or
        screen-reader user never lands on it and never hears WHY it is off (/review a11y). */
  const startAction = !canWrite || loading ? undefined : firstRun ? (
    <button type="button" className={styles.devBtnHeld} aria-disabled="true" aria-describedby="dev-sessions-held">
      <Plus size={13} aria-hidden /> Start session
    </button>
  ) : (
    <button type="button" className={styles.btnPrimary} disabled={busy} onClick={startSession}>
      <Plus size={15} aria-hidden /> Start session
    </button>
  );

  const tabs: { id: SkillsAndGoalsSection; label: string; href: string }[] = [
    { id: 'sessions', label: 'Sessions', href: skillsAndGoalsHref(base, 'sessions') },
    { id: 'players', label: 'Players', href: skillsAndGoalsHref(base, 'players', { metric: metricParam }) },
    { id: 'metrics', label: 'Metrics', href: metricsHref },
  ];

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the team name is the masthead's job, and the first-run
          guidance lives in the Sessions view's held-back note beside the action it explains. */}
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
          {section === 'sessions' && (
            <SessionsView
              base={base}
              sessions={sessions ?? []}
              canWrite={canWrite}
              busy={busy}
              firstRun={firstRun}
              heldBackReason={heldBackReason}
              metricsHref={metricsHref}
              hasSessions={hasSessions}
              board={board}
              practiceRoomsOpen={!!caps && canManageSchedule(caps)}
              onDelete={deleteSession}
              onHelp={() => openHelp(helpRequest)}
            />
          )}
          {section === 'players' && (
            <PlayersView base={base} board={board} boardError={boardError} types={types ?? []} metricParam={metricParam} />
          )}
          {section === 'metrics' && (
            <MetricsView base={base} types={types ?? []} canWrite={canWrite} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────────────────────

function SessionsView({
  base, sessions, canWrite, busy, firstRun, heldBackReason, metricsHref, hasSessions, board,
  practiceRoomsOpen, onDelete, onHelp,
}: {
  base: string;
  sessions: RepTeamEvaluationSession[];
  canWrite: boolean;
  busy: boolean;
  firstRun: boolean;
  heldBackReason: string;
  metricsHref: string;
  hasSessions: boolean;
  board: BoardData | null;
  practiceRoomsOpen: boolean;
  onDelete: (s: RepTeamEvaluationSession) => void;
  onHelp: () => void;
}) {
  // The search is this view's own state — a keystroke must not re-render the hub around it.
  const [query, setQuery] = useState('');
  // A session row is its date and note (as today); the search box finds either. The searchable
  // text is built once per list, not once per keystroke (date formatting is an Intl call).
  const searchable = useMemo(
    () => sessions.map(s => ({ s, text: `${formatSessionDate(s.sessionDate)} ${s.sessionDate} ${s.note ?? ''}`.toLowerCase() })),
    [sessions],
  );
  const needle = query.trim().toLowerCase();
  const shown = needle ? searchable.filter(x => x.text.includes(needle)).map(x => x.s) : sessions;

  const { boardEmpty, reportEmpty } = useMemo(() => ({
    boardEmpty: board !== null && !board.rows.some(r => r.goals.some(g => g.status === 'working') || Object.keys(r.latest).length > 0),
    reportEmpty: board !== null && !board.rows.some(r => Object.keys(r.latest).length > 0),
  }), [board]);

  return (
    <>
      {/* data-sandbox-tour: the beat the demo's "Find the two blanks" step rings — a session where
          eleven of thirteen were tested and the other two read as a dash. Inert off a demo org. */}
      <div data-sandbox-tour="development-sessions"
        className={`${styles.detailSection} ${firstRun && !hasSessions ? styles.devHeldBack : ''}`}>
        <div className={styles.devCardHeadRow}>
          <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Evaluation sessions</p>
          {hasSessions && (
            <label className={styles.field} style={{ minWidth: 200, flex: '0 1 260px' }}>
              <span className={styles.label}>Find a session</span>
              <input type="search" className={`${styles.input} ${styles.devToolbarControl}`} value={query} placeholder="Date or session note"
                onChange={e => setQuery(e.target.value)} />
            </label>
          )}
        </div>

        {firstRun ? (
          <p className={styles.devCardNote} id="dev-sessions-held" style={{ margin: hasSessions ? '0 0 0.5rem' : 0 }}>
            {heldBackReason}{canWrite && <> <Link href={metricsHref} className={styles.devTailLink}>Open Metrics →</Link></>}
          </p>
        ) : hasSessions ? (
          <p className={styles.devCardNote} style={{ marginBottom: '0.5rem' }}>
            Run your tests for the whole roster in one go — a few sessions a season is what makes the trend lines real.
            Old sessions open every metric and player that has a saved record in them, retired or not.
          </p>
        ) : null}

        {hasSessions ? (
          shown.length === 0 ? (
            <p className={styles.detailPlaceholder}>No session matches “{query.trim()}”.</p>
          ) : (
            /* ONE table — the .tableAsCards primitive reflows rows to cards @640 (the session cell has
               no label: it renders as the card title). Rows go inert while a delete is in flight —
               tapping into a session that's mid-delete would land on a jarring 404. */
            <div className={`${styles.tableWrap} ${styles.tableAsCards}`} style={busy ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>
              <table className={styles.devBoardTable}>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Records</th>
                    {canWrite && <th><span className={styles.srOnly}>Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {shown.map(s => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`${base}/development/sessions/${s.id}`} className={styles.devCellLink}>
                          {formatSessionDate(s.sessionDate)}{s.note ? ` — ${s.note}` : ''}
                        </Link>
                      </td>
                      <td data-label="Records" className={styles.devBoardVal}>
                        {(s.playerCount ?? 0) > 0
                          ? `${plural(s.playerCount ?? 0, 'player')} · ${plural(s.typeCount ?? 0, 'test')}`
                          : <Muted>no readings yet</Muted>}
                      </td>
                      {canWrite && (
                        <td data-label="Actions" className={styles.devBoardVal}>
                          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', minHeight: 'var(--tap-min, 44px)', minWidth: 'var(--tap-min, 44px)' }}
                            aria-label="Delete this session" onClick={() => onDelete(s)}>
                            <X size={11} aria-hidden />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : firstRun ? null : (
          // The header already owns the ONE lime action ("Start session"), so this empty teaches
          // and links to the guide rather than repeating the button.
          <CoachEmptyState
            compact
            headline={canWrite ? 'No sessions yet' : 'No sessions have been run yet'}
            description="An evaluation session runs your tests across the whole roster in one go, usually at a practice."
            payoff="A few a season is what turns single readings into a trend — and it's what fills the Players view and the “Is everyone getting attention?” report in Insights."
            blocker={canWrite ? undefined : 'Starting a session and recording results needs the Development grant — ask your head coach.'}
            secondaryAction={{ label: 'How development works', icon: <HelpCircle size={15} aria-hidden />, onClick: onHelp }}
          />
        )}
      </div>

      {/* ── The doors out, as quiet links (mockup screen 1: UNCHANGED destinations) ──
          The Insights report door softens when there is nothing to report — the treatment the
          Insights hub already applies. The drill and template rooms are INSTRUMENTS: hidden in a
          completed season (owner ruling 2026-08-01) and gated on schedule editing, because their
          routes answer "no access to the schedule" to a notes-only assistant — a link that
          dead-ends is the same bug wearing a politer face. */}
      <div className={styles.insightsDoors}>
        <Link href={insightsSectionHref(base, 'development')} className={`${styles.insightsDoor} ${reportEmpty ? styles.insightsDoorSoft : ''}`}>
          <span className={styles.insightsDoorQ}>Review development in Insights<span aria-hidden>→</span></span>
          <span className={styles.insightsDoorSum}>
            {reportEmpty
              ? 'Nothing to report until your first session.'
              : 'The coverage report — one row per player: active focus, last result, practice review.'}
          </span>
        </Link>
        {practiceRoomsOpen && (
          <Link href={`${base}/development/drills`} className={styles.insightsDoor}>
            <span className={styles.insightsDoorQ}>Drills<span aria-hidden>→</span></span>
            <span className={styles.insightsDoorSum}>
              Write a drill once — the setup, what you&apos;re watching for, the coaching points — and
              adding it to a practice becomes four taps.
            </span>
          </Link>
        )}
        {practiceRoomsOpen && (
          <Link href={`${base}/development/templates`} className={styles.insightsDoor}>
            <span className={styles.insightsDoorQ}>Plan templates<span aria-hidden>→</span></span>
            <span className={styles.insightsDoorSum}>
              Save a practice you&apos;d run again. Start from it next Tuesday instead of rebuilding it.
            </span>
          </Link>
        )}
        {boardEmpty && (
          <Link href={skillsAndGoalsHref(base, 'players')} className={`${styles.insightsDoor} ${styles.insightsDoorSoft}`}>
            <span className={styles.insightsDoorQ}>Players<span aria-hidden>→</span></span>
            <span className={styles.insightsDoorSum}>Nothing set yet — the Players view fills in as you give players focus areas and results.</span>
          </Link>
        )}
      </div>

      {/* D9 — a POINTER, not a room. Practice plans live on the practice itself (D1), because a
          practice is a date and Development owns no calendar. Unchanged by the 31 July ruling. */}
      <p className={styles.devTail}>
        Practice plans live on each practice in your{' '}
        <Link href={`${base}/schedule`} className={styles.devTailLink}>Schedule →</Link>
      </p>
    </>
  );
}

// ── Players ───────────────────────────────────────────────────────────────────────────────────

/**
 * The team board's job, in place (mockup screen 1, RESTYLED): every active player in ROSTER ORDER
 * — never a ranking, no sort control — with a Show selector. "Current focus" shows the working
 * focus areas; a test shows THAT test's latest result and ITS date (F09, F12: the board used to
 * pick its three or four most-used tests by usage and show one "last eval" for everything).
 * The choice rides `?metric=` so a link keeps it. Names link to the record, opened on the right
 * view, carrying the way back (the exact addresses of F09).
 */
function PlayersView({ base, board, boardError, types, metricParam }: {
  base: string;
  board: BoardData | null;
  boardError: string;
  types: RepTeamMeasurableType[];
  metricParam: string | null;
}) {
  const router = useRouter();
  // Tests a coach can pick: active measured tests, plus a retired one that still carries a latest
  // result for someone (its readings are records; hiding them would be F02 again).
  const pickable = useMemo(() => {
    const withLatest = new Set<string>();
    for (const r of board?.rows ?? []) for (const id of Object.keys(r.latest)) withLatest.add(id);
    return measuredTestsWithHistory(types, id => withLatest.has(id));
  }, [board, types]);
  const showGoals = board?.showGoals ?? false;
  const chosen = metricParam && pickable.some(t => t.id === metricParam)
    ? metricParam
    : showGoals ? 'focus' : (pickable[0]?.id ?? 'focus');
  const chosenType = pickable.find(t => t.id === chosen) ?? null;
  const here = skillsAndGoalsHref(base, 'players', { metric: chosenType ? chosenType.id : null });

  const choose = (value: string) => {
    router.replace(skillsAndGoalsHref(base, 'players', { metric: value === 'focus' ? null : value }), { scroll: false });
  };

  if (boardError) {
    return <p className={styles.detailPlaceholder}>{boardError}</p>;
  }
  if (!board) {
    return <div className={styles.loadingState}>Loading the players…</div>;
  }
  const rows = board.rows;
  const anyData = rows.some(r => r.goals.length > 0 || Object.keys(r.latest).length > 0);

  return (
    <div className={styles.detailSection}>
      <div className={styles.devCardHeadRow}>
        <div>
          <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Players</p>
          {/* REQUIRED coverage framing (binding coverage ruling): roster order, a coverage view, not a ranking. */}
          <p className={styles.devCardNote} style={{ margin: '0.15rem 0 0' }}>
            Roster order · {plural(rows.length, 'player')} · a coverage view, not a ranking
          </p>
        </div>
        {(showGoals || pickable.length > 0) && (
          <label className={styles.field} style={{ minWidth: 200, flex: '0 1 300px' }}>
            <span className={styles.label}>Show</span>
            <select className={`${styles.select} ${styles.devToolbarControl}`} value={chosen} onChange={e => choose(e.target.value)}>
              {showGoals && <option value="focus">Current focus</option>}
              {pickable.map(t => (
                <option key={t.id} value={t.id}>{t.name} · latest result{t.isActive ? '' : ' (retired)'}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {rows.length === 0 ? (
        <p className={styles.detailPlaceholder}>No active roster for this season yet — add players from the Roster page first.</p>
      ) : !anyData ? (
        <p className={styles.detailPlaceholder}>
          Nothing recorded yet — run an evaluation session or add a focus area from any player&apos;s record.
        </p>
      ) : (
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.devBoardTable}>
            <thead>
              <tr>
                {/* ⚠ NO sort affordance on any column, ever. Roster order is the only order. */}
                <th>Player</th>
                <th>{chosenType ? chosenType.name : 'Current focus'}</th>
                <th>{chosenType ? 'Recorded' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
                const working = r.goals.filter(g => g.status === 'working').map(g => g.focusArea);
                const latest = chosenType ? r.latest[chosenType.id] : undefined;
                const href = playerDevelopmentHref(base, r.playerId, chosenType
                  ? { view: 'results', metricId: chosenType.id, returnTo: here }
                  : { view: 'goals', returnTo: here });
                return (
                  <tr key={r.playerId}>
                    <td>
                      <Link href={href} className={styles.devCellLink}>
                        {r.number ? <span className={styles.devRowNum}>#{r.number} </span> : null}{name}
                      </Link>
                    </td>
                    {chosenType ? (
                      <>
                        <td data-label={chosenType.name} className={styles.devBoardVal}>
                          {latest ? `${formatValue(latest.value)} ${latest.unit}` : <Muted>—</Muted>}
                        </td>
                        {/* The date belongs to the metric chosen — never one "last eval" for everything (F12). */}
                        <td data-label="Recorded" className={styles.devBoardVal}>
                          {latest ? formatShortDate(latest.recordedOn) : <Muted>not recorded</Muted>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td data-label="Current focus">
                          {working.length > 0
                            ? working.join(' · ')
                            : r.goals.length > 0
                              ? <Muted>{r.goals.length} achieved/parked</Muted>
                              : <Muted>none yet</Muted>}
                        </td>
                        <td data-label="Status" className={styles.devBoardVal}>
                          {working.length > 0 ? `${plural(working.length, 'active focus area')}` : <Muted>—</Muted>}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.devCardNote} style={{ marginTop: '0.6rem' }}>
        No ranking, no sort control. The date belongs to the metric you chose — never one “last eval” for everything.
      </p>
    </div>
  );
}

// ── Metrics ───────────────────────────────────────────────────────────────────────────────────

/**
 * The library (mockup screen 1, RESTYLED from "Your test list"; named "Metrics" by owner ruling
 * 2026-09-11 — everything on this screen is already the coach's own, so "your" said it twice).
 * Measured tests and observed skills together, each with what a record of it means. Defining and
 * editing happen on the editor page (screen 2); retire and restore moved into it.
 */
function MetricsView({ base, types, canWrite }: { base: string; types: RepTeamMeasurableType[]; canWrite: boolean }) {
  const active = types.filter(t => t.isActive);
  const retired = types.filter(t => !t.isActive);
  const byId = new Map(types.map(t => [t.id, t]));
  const hasSkill = active.some(t => t.kind === 'skill');
  const editorHref = (id: string) => `${base}/development/metrics/${id}`;

  return (
    <div className={styles.detailSection}>
      <div className={styles.devCardHeadRow}>
        <div>
          <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Metrics</p>
          <p className={styles.devCardNote} style={{ margin: '0.15rem 0 0' }}>
            <strong>Tests record numbers. Skills describe behaviour.</strong> Goals explain what a player is working toward.
          </p>
        </div>
        {canWrite && (
          <Link href={`${base}/development/metrics/new`} className={`btn btn-ghost ${styles.devSectionAction}`}
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Plus size={13} aria-hidden /> Define a metric
          </Link>
        )}
      </div>

      {active.length === 0 ? (
        <CoachEmptyState
          compact
          headline="No metrics defined yet"
          description="A measured test is a number you record the same way every time — a 60-yd sprint in seconds. An observed skill is what you watch for, in your own words."
          payoff="Define your first test and an evaluation session can record it for the whole roster in one go."
          blocker={canWrite ? undefined : 'Defining a metric needs the Development grant — ask your head coach.'}
        />
      ) : (
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.devBoardTable}>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Kind</th>
                <th>What a record means</th>
              </tr>
            </thead>
            <tbody>
              {active.map(t => (
                <tr key={t.id}>
                  <td>
                    <Link href={editorHref(t.id)} className={styles.devCellLink}>{t.name}</Link>
                    {t.kind === 'test' && t.unit && <Muted> · {t.unit}</Muted>}
                  </td>
                  <td data-label="Kind">{KIND_LABELS[t.kind]}</td>
                  <td data-label="What a record means">{recordMeaning(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasSkill && (
        <p className={styles.devCardNote} style={{ marginTop: '0.6rem' }}>
          An observed skill is defined here now; recording an observation against it comes in a later release.
        </p>
      )}

      {retired.length > 0 && (
        <details style={{ marginTop: '0.8rem' }}>
          <summary className={`${styles.devCardNote} ${styles.devDisclosureSummary}`}>Retired definitions ({retired.length})</summary>
          <ul className={styles.miniList} style={{ marginTop: '0.4rem' }}>
            {retired.map(t => {
              const successor = t.replacedById ? byId.get(t.replacedById) : null;
              return (
                <li key={t.id} className={styles.miniRow}>
                  <span className={styles.miniRowMain}>
                    <Link href={editorHref(t.id)} className={styles.devCellLink}>{t.name}</Link>
                    <span className={styles.devCardNote}>
                      {[t.unit, successor ? `replaced by ${successor.name}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={styles.miniRowMeta}>{KIND_LABELS[t.kind]}</span>
                </li>
              );
            })}
          </ul>
          <p className={styles.devCardNote} style={{ marginTop: '0.4rem' }}>
            Retiring removes a definition from new sessions only. Its saved records stay visible in the session and player history they belong to.
          </p>
        </details>
      )}
    </div>
  );
}
