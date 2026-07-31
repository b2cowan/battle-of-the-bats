'use client';
import { use, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { ClipboardList, UserCheck, ArrowRight, Play } from 'lucide-react';
import { useTryoutAccess } from '@/components/coaches/useTryoutAccess';
import FeedbackModal from '@/components/FeedbackModal';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import HelpButton from '@/components/help/HelpButton';
import TryoutDayCard from '@/components/rep-teams/TryoutDayCard';
import TryoutRubricCard from '@/components/rep-teams/TryoutRubricCard';
import TryoutEvaluatorsCard from '@/components/rep-teams/TryoutEvaluatorsCard';
import TryoutScoreboardCard from '@/components/rep-teams/TryoutScoreboardCard';
import TryoutDecisionBoard from '@/components/rep-teams/TryoutDecisionBoard';
import TryoutFlowHeader, { type TryoutOverview, type TabKey } from '@/components/rep-teams/TryoutFlowHeader';
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

const phaseToTab = (phase: TryoutOverview['phase']): TabKey =>
  phase === 'tryout_day' ? 'tryout-day' : phase === 'setup' ? 'setup' : phase === 'decide' ? 'decide' : 'build';

export default function CoachTryoutsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const base = `/api/coaches/${orgSlug}/teams/${teamId}`;
  const checkInHref = `/${orgSlug}/coaches/teams/${teamId}/tryouts/check-in`;
  const scoreHref = `/${orgSlug}/coaches/teams/${teamId}/tryouts/score`;
  const rosterHref = `/${orgSlug}/coaches/teams/${teamId}/roster`;
  // ONE shared gate for all three tryout pages (WI-11) — semantics documented in the hook.
  const { ctxLoading, canTryouts, assignment } = useTryoutAccess(teamId);
  // No `label` — HelpButton falls back to its own `label` prop, so the string lives in one place.
  const helpRequest = { module: 'coaches' as const, sectionIds: ['recipe-run-tryouts'], fullGuideHref: `/${orgSlug}/coaches/help#recipe-run-tryouts` };

  const [overview, setOverview] = useState<TryoutOverview | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('setup');
  const didAutoSelect = useRef(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const fail = (m: string) => { setFeedbackMsg(m); setFeedbackOpen(true); };

  // Best-effort orientation: fetch on load + on tab focus (e.g. returning from the check-in sub-page).
  // On the FIRST successful load, land the coach on the stage they should be working — but never yank
  // them off a tab they've since chosen.
  const loadOverview = useCallback(async () => {
    if (!canTryouts) return;
    try {
      const res = await fetch(`${base}/tryout-overview`);
      if (!res.ok) return;
      const data: TryoutOverview = await res.json();
      setOverview(data);
      if (!didAutoSelect.current) { setActiveTab(phaseToTab(data.phase)); didAutoSelect.current = true; }
    } catch { /* non-blocking */ }
  }, [base, canTryouts]);
  useEffect(() => {
    loadOverview();
    const onFocus = () => loadOverview();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadOverview]);

  const hidden = (tab: TabKey) => (activeTab === tab ? '' : flow.panelHidden);
  const s = overview?.stats;

  const header = (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderLeft}>
        <div className={styles.headerIcon}><ClipboardList size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Tryouts</h1>
          <p className={styles.pageSub}>Run your whole tryout here — set up, score, decide, and build your team.</p>
        </div>
      </div>
      <HelpButton iconOnly label="Tryouts" help={helpRequest} />
    </div>
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

      <TryoutFlowHeader overview={overview} rosterHref={rosterHref} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Stage 1 — Set up */}
      <div className={hidden('setup')} role="tabpanel">
        <PanelIntro text="Before tryout day: set your dates, build a scorecard of what you'll rate, and (optionally) invite helpers to score." />
        <TryoutDayCard apiBase={`${base}/tryout-sessions`} canWrite sport={assignment?.teamSport} checkInHref={checkInHref} onError={fail} />
        <TryoutRubricCard apiBase={`${base}/tryout-rubric`} canWrite onError={fail} />
        <TryoutEvaluatorsCard apiBase={`${base}/tryout-evaluators`} canWrite onError={fail} />
      </div>

      {/* Stage 2 — Tryout day */}
      <div className={hidden('tryout-day')} role="tabpanel">
        <PanelIntro
          text="Check players in (names stay hidden for fairness), then score them — the board ranks everyone live."
          action={
            <>
              {/* WI-1: the tab finally delivers what this intro promises — the coach's own door
                  into the shared scorer, signed in, no evaluator link required. */}
              <a className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }} href={scoreHref}><Play size={14} /> Score players</a>
              <a className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }} href={checkInHref}><UserCheck size={14} /> Open check-in</a>
            </>
          }
        />
        <TryoutScoreboardCard apiBase={`${base}/tryout-scoreboard`} settingsBase={`${base}/tryout-sessions`} canWrite onError={fail} />
      </div>

      {/* Stage 3 — Decide */}
      <div className={hidden('decide')} role="tabpanel">
        <PanelIntro text="Offer, waitlist, or pass on each ranked player. Turn on family emails to have offers land with a secure reply link — or leave them off and reach out yourself. (If names are still hidden, reveal them back on the Set up tab first.)" />
        <TryoutDecisionBoard apiBase={`${base}/tryout-decisions`}
          continuityApiBase={`${base}/development/continuity`} canWrite teamId={teamId} onError={fail} />
      </div>

      {/* Stage 4 — Build your team */}
      <div className={hidden('build')} role="tabpanel">
        <PanelIntro text="Accept players onto your roster with their fees (optional). They're then ready for your lineups." />
        <div className={flow.results}>
          {!s ? null : (s.offered + s.waitlisted + s.accepted + s.rosterFromTryouts) > 0 ? (
            <>
              <div className={flow.resultStats}>
                <div className={flow.resultStat}><span className={flow.resultNum}>{s.offered}</span><span className={flow.resultLabel}>Offered</span></div>
                <div className={flow.resultStat}><span className={flow.resultNum}>{s.waitlisted}</span><span className={flow.resultLabel}>Waitlisted</span></div>
                <div className={flow.resultStat}><span className={`${flow.resultNum} ${flow.resultNumAccent}`}>{s.accepted}</span><span className={flow.resultLabel}>Accepted</span></div>
                <div className={flow.resultStat}><span className={`${flow.resultNum} ${flow.resultNumAccent}`}>{s.rosterFromTryouts}</span><span className={flow.resultLabel}>On your roster</span></div>
              </div>
              <a className={flow.rosterLink} href={rosterHref}>View your team roster <ArrowRight size={15} /></a>
            </>
          ) : (
            <p className={flow.resultEmpty}>
              Once you accept players from the decision board, they land on your{' '}
              <a href={rosterHref} style={{ color: 'var(--logic-lime)' }}>team roster</a> with their fees already
              set — so lineups, attendance, dues and announcements all work from day one, with no name re-typed.
            </p>
          )}
        </div>
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
