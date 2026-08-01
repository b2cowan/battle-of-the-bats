'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { TrendingUp, Plus, X, HelpCircle } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachSeasonChip from '@/components/coaches/CoachSeasonChip';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import HelpButton from '@/components/help/HelpButton';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import TestTypesManager from '@/components/coaches/TestTypesManager';
import { todayLocal } from '@/lib/measurable-format';
import { canViewDevelopmentGoals, canViewMeasurables, canWriteDevelopment } from '@/lib/coach-capabilities';
import styles from '../../../coaches.module.css';
import type { RepTeamEvaluationSession, RepTeamMeasurableType } from '@/lib/types';

function formatSessionDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function DevelopmentHubPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  // Fresh instance per team — no cross-team fetch races or stale drafts (3A key= pattern).
  return <DevelopmentHub key={teamId} orgSlug={orgSlug} teamId={teamId} />;
}

function DevelopmentHub({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { openHelp } = useHelpDrawer();
  const { assignments, loading: assignmentsLoading } = useCoaches();
  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
  const assignment = assignments.find(a => a.teamId === teamId);
  // Chunk F: THAT season's grants (governing rule 1), not the coach's current ones.
  const caps = page.capabilities;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development`;

  const [sessions, setSessions] = useState<RepTeamEvaluationSession[] | null>(null);
  const [types, setTypes] = useState<RepTeamMeasurableType[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // ONE source for the write flag, resilient to the sessions GET 404'ing (no active program
  // year must not silently lock the test list for a legit head coach).
  const canWrite = page.canWrite(caps ? canWriteDevelopment(caps) : false);

  // `label` is required here — this object also goes straight to openHelp() from the empty state,
  // where there is no HelpButton label to fall back to.
  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-development'],
    label: 'Development',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-development`,
  };

  // ONE fetch: the sessions GET carries sessions + types + canWrite (board-route precedent —
  // two separate GETs doubled the auth/capability resolution per hub load).
  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/sessions${seasonQuery}`);
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
  }, [apiBase, seasonQuery]);

  useEffect(() => { load(); }, [load]);

  /**
   * Door state (restructure D3): the two doors soften when there is genuinely nothing behind
   * them — the treatment the Insights hub ALREADY applies to these same two doors, so the two
   * surfaces stop disagreeing about how one door looks.
   *
   * Rides the board GET (the Insights precedent: "one dataset, several doors") rather than
   * widening the hub's own fetch, deliberately: it stays OFF the first-paint path, so the hub
   * still renders at the speed of the sessions GET and the door labels fill in a moment later.
   * Failure is silent and safe — no coverage means the doors render unsoftened, which never
   * hides a door from a coach who has data. If this ever costs too much, the fix is one shared
   * summary endpoint serving BOTH hubs, not a third fetch here.
   */
  const [coverage, setCoverage] = useState<{ rosterCount: number; withMeasurable: number; withFocus: number } | null>(null);
  // Gated the way its own precedent gates it (/review): the board route requires roster
  // visibility, so a coach without it must not fire a request that can only ever 403.
  const canSeeBoard = caps ? canViewMeasurables(caps) : false;
  useEffect(() => {
    if (!canSeeBoard) return;
    let cancelled = false;
    fetch(`${apiBase}/board${seasonQuery}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        const rows: { goals?: { status: string }[]; latest?: Record<string, unknown> }[] = data.rows ?? [];
        setCoverage({
          rosterCount: rows.length,
          withMeasurable: rows.filter(r => Object.keys(r.latest ?? {}).length > 0).length,
          withFocus: rows.filter(r => (r.goals ?? []).some(g => g.status === 'working')).length,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiBase, canSeeBoard, seasonQuery]);

  async function newSession() {
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
    return (
      <div className={styles.page}>
        <CoachEmptyState
          quiet
          icon={<TrendingUp size={20} aria-hidden />}
          headline="Development isn't turned on for you"
          description="Development records what each player is working on and the results of the tests you run through the season."
          payoff="It's what lets Insights answer “Is everyone getting attention?” — one row per player, so nobody quietly gets overlooked."
          blocker="Ask your head coach for player notes or roster access on this team."
        />
      </div>
    );
  }

  const loading = sessions === null || types === null;

  /* ── The one branch this page turns on ────────────────────────────────────────────
     A session can only record what's on the test list, so a team with no ACTIVE test has
     exactly one thing to do — and the page shows exactly one thing to do (restructure D1).
     Retired tests are excluded on purpose: they leave the session picker, so an all-retired
     list is as empty as no list at all, and the server guard counts the same way. */
  const activeTypes = (types ?? []).filter(t => t.isActive);
  const firstRun = !loading && activeTypes.length === 0;

  /* The honest reason the action is off, in the coach's terms. Branches on BOTH axes: a list
     that exists-but-is-all-retired is a different fact from no list at all, and a view-only
     coach must not be told "your head coach hasn't set one up" when one exists with history
     behind it (/review F2). */
  const listExists = (types ?? []).length > 0;
  const heldBackReason = listExists
    ? (canWrite
        ? 'Every test on your list is retired — add or restore one above and this turns on.'
        : 'Every test on the list is retired, so there’s nothing for a session to record right now.')
    : (canWrite
        ? 'Add your first test above and this turns on. A session runs your whole test list across the roster in one go, usually at a practice.'
        : 'Your head coach hasn’t set up a test list yet, so there’s nothing to record.');

  const hasSessions = (sessions ?? []).length > 0;

  /* ── Band 1 — Evaluation sessions ──
     `firstRun` withholds the ability to START a session. It must NOT withhold the sessions
     already run: an all-retired test list used to swap this whole card for a header + note,
     silently hiding real session history — three sessions of readings could vanish from the
     page because someone retired a test (/review F1). The list now renders in every state;
     only the button, the note, and the dimming change. Nothing holding real records is dimmed. */
  const sessionsCard = (
    <div key="sessions" className={`${styles.detailSection} ${firstRun && !hasSessions ? styles.devHeldBack : ''}`}>
      <div className={styles.devCardHeadRow}>
        <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Evaluation sessions</p>
        {canWrite && (firstRun ? (
          /* aria-disabled, NOT the `disabled` attribute: a disabled button leaves the tab
             order, so a keyboard or screen-reader user never lands on it and never hears WHY
             it's off (/review a11y). It carries no handler, so it stays inert to a click. */
          <button type="button" className={styles.devBtnHeld} aria-disabled="true" aria-describedby="dev-sessions-held">
            <Plus size={13} aria-hidden /> New session
          </button>
        ) : (
          <button type="button" className="btn btn-lime" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            disabled={busy} onClick={newSession}>
            <Plus size={13} /> New session
          </button>
        ))}
      </div>

      {firstRun ? (
        <p className={styles.devCardNote} id="dev-sessions-held" style={{ margin: hasSessions ? '0 0 0.5rem' : 0 }}>{heldBackReason}</p>
      ) : hasSessions ? (
        <p className={styles.devCardNote} style={{ marginBottom: '0.5rem' }}>
          Run your tests for the whole roster in one go — a few sessions a season is what makes the trend lines real.
        </p>
      ) : null}

      {hasSessions ? (
        /* While a delete is in flight the rows go inert — tapping into a session
           that's mid-delete would land on a jarring 404. */
        <ul className={styles.miniList} style={busy ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>
          {(sessions ?? []).map(s => (
            <li key={s.id} className={styles.miniRow}>
              <span className={styles.miniRowMain}>
                <Link href={`${base}/development/sessions/${s.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {formatSessionDate(s.sessionDate)}{s.note ? ` — ${s.note}` : ''}
                </Link>
              </span>
              <span className={styles.miniRowMeta}>
                {(s.playerCount ?? 0) > 0
                  ? `${plural(s.playerCount ?? 0, 'player')} · ${plural(s.typeCount ?? 0, 'test')}`
                  : 'no readings yet'}
              </span>
              {canWrite && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}
                  aria-label="Delete this session" onClick={() => deleteSession(s)}>
                  <X size={11} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : firstRun ? null : (
        // The card header already owns the ONE lime action ("New session"), so this empty
        // teaches and links to the guide rather than repeating the button. The old "add a test
        // below" blocker is gone: that state renders the held-back note above instead, and
        // "below" was wrong on desktop anyway (the list sat diagonally down-right).
        <CoachEmptyState
          compact
          headline={canWrite ? 'No sessions yet' : 'No sessions have been run yet'}
          description="An evaluation session runs your tests across the whole roster in one go, usually at a practice."
          payoff="A few a season is what turns single readings into a trend — and it's what fills the team board and the “Is everyone getting attention?” report in Insights."
          blocker={canWrite ? undefined : 'Only the head coach can start a session and record readings.'}
          secondaryAction={{ label: 'How development works', icon: <HelpCircle size={15} aria-hidden />, onClick: () => openHelp(helpRequest) }}
        />
      )}
    </div>
  );

  /* ── Band 2 — the two doors OUT, together and equal ──
     Chunk E WI-5 already untangled their wording (the team board is a surface you edit; the
     Insights report is read-only). The restructure fixes their SHAPE: sharing one row makes
     them the same height by construction, instead of two odd-sized tiles marooned in a card
     grid. .insightsDoors is the Insights-hub strip primitive — same doors, same idiom. */
  const boardEmpty = coverage !== null && coverage.withFocus === 0 && coverage.withMeasurable === 0;
  const reportEmpty = coverage !== null && coverage.withMeasurable === 0;

  const doorsStrip = (
    <div key="doors" className={styles.insightsDoors}>
      <Link href={`${base}/development/board`} className={`${styles.insightsDoor} ${boardEmpty ? styles.insightsDoorSoft : ''}`}>
        <span className={styles.insightsDoorQ}>What&apos;s each player working on?<span aria-hidden>→</span></span>
        <span className={styles.insightsDoorSum}>
          {boardEmpty
            ? 'Nothing set yet — the board fills in as you give players focus areas.'
            : coverage && coverage.withFocus > 0
              // Verb agrees with the SUBJECT count, noun with the roster count — "1 of 1 player
              // has", "1 of 12 players has", "9 of 12 players have" (/review F4).
              ? `Set focus areas and log where each player is. ${coverage.withFocus} of ${plural(coverage.rosterCount, 'player')} ${coverage.withFocus === 1 ? 'has' : 'have'} an active focus.`
              : 'Open the team board to set focus areas and log where each player is.'}
        </span>
      </Link>

      {/* Insights door (3D) — deliberately absent until the report existed (no doors to
          nowhere); same question as the Insights tile: one phrasing, one destination. */}
      <Link href={`${base}/history/development`} className={`${styles.insightsDoor} ${reportEmpty ? styles.insightsDoorSoft : ''}`}>
        <span className={styles.insightsDoorQ}>Is everyone getting attention?<span aria-hidden>→</span></span>
        <span className={styles.insightsDoorSum}>
          {reportEmpty
            ? 'Nothing to report until your first session.'
            : 'The coverage report in Insights — one row per player: active focus, last evaluation, history linked.'}
        </span>
      </Link>
    </div>
  );

  /* ── Band 3 — the test list. "Your test list" is the wording the sessions card already uses
        when it points here; "Test types" was the only place that said it the other way. ── */
  const testListCard = (
    <div key="testlist" className={styles.detailSection}>
      <div className={styles.devCardHeadRow}>
        <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Your test list</p>
        {firstRun && canWrite && <span className={styles.devStartHere}>Start here</span>}
      </div>
      <TestTypesManager
        apiBase={`${apiBase}/measurable-types`}
        types={types ?? []}
        canWrite={canWrite}
        primaryAdd={firstRun}
        onTypesChanged={update => setTypes(t => update(t ?? []))}
      />
    </div>
  );

  const bandRule = (
    <div key="rule" className={styles.devBandRule}><span className={styles.devBandLabel}>Then go look</span></div>
  );

  /* D9 — a POINTER, not a room. Practice plans live on the practice itself (D1), because a
     practice is a date and Development owns no calendar. This one line keeps the feature
     findable from where it was promised without minting a second home for one job. */
  const practicePlansLine = (
    <p className={styles.devTail}>
      Practice plans live on each practice in your{' '}
      <Link href={`${base}/schedule`} className={styles.devTailLink}>Schedule →</Link>
    </p>
  );

  /* The keys here are load-bearing, not decoration. Without them React reconciles these
     siblings POSITIONALLY across the firstRun flip, so adding the first test tore down and
     rebuilt the very card the coach was typing in — dropping keyboard focus to the top of the
     document and discarding any open rename draft (/review F6 + concurrency lens). Keyed,
     React MOVES the existing nodes instead, so the card keeps its state and its focus while
     the page reorders around it. */
  const bands = firstRun
    ? [testListCard, sessionsCard, bandRule, doorsStrip]
    : [sessionsCard, bandRule, doorsStrip, testListCard];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><TrendingUp size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Development<CoachSeasonChip season={page.season} teamBase={page.teamBase} /></h1>
            <p className={styles.pageSub}>
              {assignment?.teamName ?? ''}
              {/* Instructional, not a claim about the team's overall state — a team can have
                  focus areas set with no test list yet, and the doors below will say so
                  truthfully; the subtitle must not contradict them (/review F3). */}
              {loading ? '' : firstRun
                ? ' — add a test to start recording evaluations'
                : ' — run evaluations, see where each player is'}
            </p>
          </div>
        </div>
        <HelpButton iconOnly label="Development" help={helpRequest} />
      </div>

      {error && <p className={styles.errorText} role="alert">{error}</p>}
      {loading ? (
        <div className={styles.loadingState}>Loading development…</div>
      ) : (
        /* One top-to-bottom sequence, not a mosaic. FIRST RUN puts the test list first (the
           only thing a coach can actually do) and holds sessions back; once a test exists the
           everyday order takes over and the list drops below the doors, where a set-and-forget
           list belongs. Phones inherit whichever order applies, for free. */
        <div className={styles.devBands}>
          {bands}
          {practicePlansLine}
        </div>
      )}
    </div>
  );
}
