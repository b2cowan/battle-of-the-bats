'use client';
import { use, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { useTryoutAccess } from '@/components/coaches/useTryoutAccess';
import FeedbackModal from '@/components/FeedbackModal';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import TryoutSetupChecklist from '@/components/rep-teams/TryoutSetupChecklist';
import TryoutRevealControl from '@/components/rep-teams/TryoutRevealControl';
import TryoutScoreboardCard from '@/components/rep-teams/TryoutScoreboardCard';
import TryoutDecisionBoard from '@/components/rep-teams/TryoutDecisionBoard';
import TryoutReportCard from '@/components/rep-teams/TryoutReportCard';
import TryoutBaselineCard from '@/components/rep-teams/TryoutBaselineCard';
import TryoutCheckIn from '@/components/rep-teams/TryoutCheckIn';
import TryoutScorerSurface from '@/components/rep-teams/TryoutScorerSurface';
import TryoutFlowHeader, { TryoutPrereqPrompt, phaseToTab, type TryoutOverview, type TabKey } from '@/components/rep-teams/TryoutFlowHeader';
import styles from '../../../coaches.module.css';
import flow from '@/components/rep-teams/TryoutFlowHeader.module.css';

function PanelIntro({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className={flow.panelIntro}>
      <p className={flow.panelIntroText}>{text}</p>
      {action && <span className={flow.panelAction}>{action}</span>}
    </div>
  );
}

/* ── One-Room addresses (2026-08-23) ────────────────────────────────────────────
   Stages and tryout-day faces are URL-backed (`?stage=` + `?view=`) so every screen of the
   tryout is shareable, refresh-safe and Back-safe — the Money hub's `?section=` pattern.
   `view` is tryout-day-scoped: every OTHER stage's href drops it (the one-shot-keys lesson —
   a param that means nothing off its own tab must not ride other tabs' addresses). */
const STAGE_KEYS: readonly TabKey[] = ['setup', 'tryout-day', 'decide', 'build'];
type FaceKey = 'board' | 'check-in' | 'score';
const FACE_KEYS: readonly FaceKey[] = ['board', 'check-in', 'score'];
const FACES: { id: FaceKey; label: string }[] = [
  { id: 'board', label: 'Live board' },
  { id: 'check-in', label: 'Check-in' },
  { id: 'score', label: 'Score' },
];

export default function CoachTryoutsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const base = `/api/coaches/${orgSlug}/teams/${teamId}`;
  const pagePath = `/${orgSlug}/coaches/teams/${teamId}/tryouts`;
  const rosterHref = `/${orgSlug}/coaches/teams/${teamId}/roster`;
  // ONE shared gate for all three tryout surfaces (WI-11) — semantics documented in the hook.
  // The check-in and score faces render only behind it, exactly as their sub-pages did.
  const { ctxLoading, canTryouts, assignment } = useTryoutAccess(teamId);
  // No `label` — HelpButton falls back to its own `label` prop, so the string lives in one place.
  const helpRequest = { module: 'coaches' as const, sectionIds: ['recipe-run-tryouts'], fullGuideHref: `/${orgSlug}/coaches/help#recipe-run-tryouts` };

  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStage = searchParams.get('stage');
  const urlStage: TabKey | null = STAGE_KEYS.includes(rawStage as TabKey) ? (rawStage as TabKey) : null;
  const rawView = searchParams.get('view');
  const urlFace: FaceKey | null = FACE_KEYS.includes(rawView as FaceKey) ? (rawView as FaceKey) : null;

  const [overview, setOverview] = useState<TryoutOverview | null>(null);
  // With no `?stage` in the address, the page lands the coach on the stage the tryout is AT
  // (first successful overview load, exactly the old behaviour). An explicit `?stage` is a
  // choice — the coach's own, or a shared link's — and retires the auto-select for good.
  const [autoStage, setAutoStage] = useState<TabKey>('setup');
  const didAutoStage = useRef(false);
  const activeTab: TabKey = urlStage ?? autoStage;

  // Same one-shot for the face: no `?view` → Check-in until the day's first check-in exists
  // (the actual order of a tryout morning), then the Live board. Never yanks a picked face.
  const [autoFace, setAutoFace] = useState<FaceKey>('board');
  const didAutoFace = useRef(false);
  const activeFace: FaceKey = urlFace ?? autoFace;

  // An address that names a stage/face IS a choice (the coach's own, or a shared link's) — it
  // retires the auto-select before any overview response can land one (effects run at commit;
  // the fetch resolves later). The face choice is also REMEMBERED as the fallback: stage hrefs
  // deliberately drop `view`, so without this a coach who opened Score, peeked at Decide and
  // came back would land on the stale auto default — the yank the one-shot exists to prevent
  // (/review 2026-08-23).
  useEffect(() => { if (urlStage) didAutoStage.current = true; }, [urlStage]);
  useEffect(() => {
    if (urlFace) { didAutoFace.current = true; setAutoFace(urlFace); }
  }, [urlFace]);

  // Bumped when names are revealed from the Decide tab — remounts the decision board so it
  // refetches with names instead of bibs.
  const [revealBump, setRevealBump] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  // Memoized: this handler flows into every card's data-loading effect chain, and the focus-driven
  // overview refresh re-renders this page — an unstable identity here re-armed those loaders on
  // every window focus (the visible refetch flash).
  const fail = useCallback((m: string) => { setFeedbackMsg(m); setFeedbackOpen(true); }, []);

  // Best-effort orientation: fetch on load + on tab focus + on face flips (a check-in recorded on
  // the Check-in face must reach the hint and the guide without a window blur).
  // Sequence token (/review 2026-08-17): overlapping responses resolving out of order must not
  // apply a stale overview.
  const overviewSeq = useRef(0);
  const loadOverview = useCallback(async () => {
    if (!canTryouts) return;
    const seq = ++overviewSeq.current;
    try {
      const res = await fetch(`${base}/tryout-overview`);
      if (!res.ok) return;
      const data: TryoutOverview = await res.json();
      if (seq !== overviewSeq.current) return; // superseded by a newer request
      setOverview(data);
      if (!didAutoStage.current) { setAutoStage(phaseToTab(data.phase)); didAutoStage.current = true; }
      if (!didAutoFace.current) {
        setAutoFace(data.stats.checkedInCount === 0 && data.stats.scoredCount === 0 ? 'check-in' : 'board');
        didAutoFace.current = true;
      }
    } catch { /* non-blocking */ }
  }, [base, canTryouts]);
  useEffect(() => {
    loadOverview();
    const onFocus = () => loadOverview();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadOverview]);

  // Shareable stage/face addresses. Every stage href except Tryout day drops `view`.
  const stageHref = useCallback((tab: TabKey) => {
    const qp = new URLSearchParams(searchParams.toString());
    qp.set('stage', tab);
    if (tab !== 'tryout-day') qp.delete('view');
    return `${pagePath}?${qp.toString()}`;
  }, [searchParams, pagePath]);
  const faceHref = useCallback((face: FaceKey) => {
    const qp = new URLSearchParams(searchParams.toString());
    qp.set('stage', 'tryout-day');
    qp.set('view', face);
    return `${pagePath}?${qp.toString()}`;
  }, [searchParams, pagePath]);
  // For the guide's "Take me there" and the prereq prompts — same addresses, pushed.
  const selectTab = useCallback((tab: TabKey) => { router.push(stageHref(tab)); }, [router, stageHref]);

  // Faces mount on first visit, then stay mounted display:none (the Money hub pattern) — a face
  // flip must never lose the scorer's open player or refetch the check-in list.
  // ⚠ A face is only "visited" while Tryout day is the ACTIVE stage (/review 2026-08-23): a
  // stray `?view=score` on any other stage used to mount the scorer invisibly — fetching, and
  // even minting the coach's self-session — under a panel the coach wasn't looking at.
  // (Render-time adjust, sanctioned same-component pattern: the guard is false after the set.)
  const [visitedFaces, setVisitedFaces] = useState<Set<FaceKey>>(() => new Set());
  if (activeTab === 'tryout-day' && !visitedFaces.has(activeFace)) {
    setVisitedFaces(v => new Set(v).add(activeFace));
  }
  // Coming back to the board (or the hint above it) re-reads the overview quietly.
  const prevFace = useRef(activeFace);
  useEffect(() => {
    if (prevFace.current !== activeFace) { prevFace.current = activeFace; loadOverview(); }
  }, [activeFace, loadOverview]);

  const hidden = (tab: TabKey) => (activeTab === tab ? '' : flow.panelHidden);

  // Page-header ruling 2026-08-11: the blurb ("run your whole tryout here…") is already the
  // no-access empty state's description, and for a coach who HAS tryouts the flow header's own
  // steps say it better than a sentence could. Icon joins the portal's 22px convention.
  const header = (
    <CoachPageHeader
      icon={ClipboardList}
      title="Tryouts"
      helpLabel="Tryouts"
      help={helpRequest}
    />
  );

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;

  if (!canTryouts) {
    return (
      <div className={styles.page}>
        {header}
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={20} aria-hidden />}
          headline="Tryouts aren't turned on for you"
          description="Tryouts runs the whole selection day from a phone — check-in, a shared scorecard, a live ranked board, and Offer / Waitlist decisions."
          payoff="Players you accept land straight on the roster with their fees already set, so the season starts without re-typing a single name."
          blocker="Tryouts involve candidate contact details and selection decisions, so it stays with the head coach unless they grant it to you."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {header}

      <TryoutFlowHeader overview={overview} rosterHref={rosterHref} activeTab={activeTab} onTabChange={selectTab} hrefFor={stageHref} />

      {/* Stage 1 — Set up: ONE checklist card (owner-approved mockup 2026-08-17) — the three
          managers are its row bodies now. Status changes refresh the flow overview so the guide,
          tab checks, and peek-ahead prompts stay honest. */}
      <div className={hidden('setup')} data-tryout-stage="setup">
        <PanelIntro text="Before tryout day: set your dates, build a scorecard of what you'll rate, and (optionally) invite helpers to score." />
        <TryoutSetupChecklist apiBase={base} canWrite sport={assignment?.teamSport} onError={fail} onChanged={loadOverview} blind={overview?.stats.blind} />
      </div>

      {/* Stage 2 — Tryout day: ONE room, three faces (One-Room build, 2026-08-23). The board,
          check-in and the coach's own scorer toggle in place — the "Score players" /
          "Open check-in" doors and both sub-pages' back links are gone with the sub-pages. */}
      <div className={hidden('tryout-day')} data-tryout-stage="tryout-day">
        <TryoutPrereqPrompt overview={overview} tab="tryout-day" onTabChange={selectTab} />
        <div className={flow.faceRow}>
          <nav className={flow.faces} aria-label="Tryout day views">
            {FACES.map(f => (
              <Link
                key={f.id}
                href={faceHref(f.id)}
                className={`${flow.face} ${activeFace === f.id ? flow.faceOn : ''}`}
                aria-current={activeFace === f.id ? 'page' : undefined}
              >
                {f.label}
              </Link>
            ))}
          </nav>
          {/* The other two faces' vitals, kept honest while you watch any one of them. On the
              score face it names the session instead — the scorer's own header stays with the
              public token door, where the hub isn't above it to say this. */}
          <span className={flow.faceHint}>
            {activeFace === 'score'
              ? <>Scoring as you — signed in{overview?.stats.blind ? ' · Blind' : ''}</>
              : overview
                ? `${overview.stats.checkedInCount} of ${overview.stats.candidateCount} checked in · ${overview.stats.scoredCount} scored`
                : null}
          </span>
        </div>

        {visitedFaces.has('board') && (
          <div style={{ display: activeFace === 'board' ? 'block' : 'none' }}>
            <TryoutScoreboardCard apiBase={`${base}/tryout-scoreboard`} settingsBase={`${base}/tryout-sessions`} canWrite onError={fail} />
          </div>
        )}
        {visitedFaces.has('check-in') && (
          <div style={{ display: activeFace === 'check-in' ? 'block' : 'none' }}>
            <TryoutCheckIn
              apiBase={`${base}/tryout-candidates`}
              embedded
              active={activeTab === 'tryout-day' && activeFace === 'check-in'}
              onError={fail}
              onChanged={loadOverview}
            />
          </div>
        )}
        {visitedFaces.has('score') && (
          <div style={{ display: activeFace === 'score' ? 'block' : 'none' }}>
            <TryoutScorerSurface
              apiBase={`${base}/tryout-self-score`}
              selfMode
              embedded
              active={activeTab === 'tryout-day' && activeFace === 'score'}
            />
          </div>
        )}
      </div>

      {/* Stage 3 — Decide */}
      <div className={hidden('decide')} data-tryout-stage="decide">
        <TryoutPrereqPrompt overview={overview} tab="decide" onTabChange={selectTab} />
        {/* Reveal names lives HERE now (2026-08-17) — the stage where the guide says it happens. */}
        <PanelIntro
          text="Offer, waitlist, or pass on each ranked player. Turn on family emails to have offers land with a secure reply link — or leave them off and reach out yourself. Names hidden? Reveal them here when you're ready."
          action={
            <TryoutRevealControl
              apiBase={`${base}/tryout-sessions`}
              canWrite
              onError={fail}
              onRevealed={() => { setRevealBump(b => b + 1); loadOverview(); }}
            />
          }
        />
        {/* Phase 3 (frame 06): a confirmed returning candidate's prior tryout, beside this one.
            The board only asks once names are revealed; the server only answers then too (R6). */}
        <TryoutDecisionBoard key={revealBump} apiBase={`${base}/tryout-decisions`}
          continuityApiBase={`${base}/development/continuity`}
          memoryApiBase={`${base}/tryout-memory`} active={activeTab === 'decide'}
          canWrite teamId={teamId} onError={fail} />
      </div>

      {/* Stage 4 — Build your team: the Tryout Report (Tryout Insights Phase 1, mockups v1
          frames 01–02 — replaces the bare four-stat row; the empty-state payoff paragraph
          moved inside the card so this stage has one owner). */}
      <div className={hidden('build')} data-tryout-stage="build">
        <TryoutPrereqPrompt overview={overview} tab="build" onTabChange={selectTab} />
        <PanelIntro text="Accept players onto your roster with their fees (optional). They're then ready for your lineups." />
        <TryoutReportCard
          apiBase={`${base}/tryout-report`}
          orgSlug={orgSlug}
          teamId={teamId}
          rosterHref={rosterHref}
          active={activeTab === 'build'}
          onError={fail}
        />
        {/* Phase 2 (frame 04): the bridge from the tryout to the season — seed each new player's
            development baseline and pick what to work on first. Renders nothing until at least
            one player has been accepted onto the roster from this tryout. */}
        <TryoutBaselineCard
          apiBase={`${base}/tryout-baselines`}
          orgSlug={orgSlug}
          teamId={teamId}
          active={activeTab === 'build'}
          onError={fail}
        />
      </div>

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        type="danger"
        title="Something went wrong"
        message={feedbackMsg}
      />
    </div>
  );
}
