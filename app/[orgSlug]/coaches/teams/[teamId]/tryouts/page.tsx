'use client';
import { use, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { ClipboardList, UserCheck, ArrowRight } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
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
  const rosterHref = `/${orgSlug}/coaches/teams/${teamId}/roster`;

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
    try {
      const res = await fetch(`${base}/tryout-overview`);
      if (!res.ok) return;
      const data: TryoutOverview = await res.json();
      setOverview(data);
      if (!didAutoSelect.current) { setActiveTab(phaseToTab(data.phase)); didAutoSelect.current = true; }
    } catch { /* non-blocking */ }
  }, [base]);
  useEffect(() => {
    loadOverview();
    const onFocus = () => loadOverview();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadOverview]);

  const hidden = (tab: TabKey) => (activeTab === tab ? '' : flow.panelHidden);
  const s = overview?.stats;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><ClipboardList size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Tryouts</h1>
            <p className={styles.pageSub}>Run your whole tryout here — set up, score, decide, and build your team.</p>
          </div>
        </div>
        <HelpButton
          iconOnly
          label="Tryouts"
          help={{ module: 'coaches', sectionIds: ['recipe-run-tryouts'], fullGuideHref: `/${orgSlug}/coaches/help#recipe-run-tryouts` }}
        />
      </div>

      <TryoutFlowHeader overview={overview} rosterHref={rosterHref} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Stage 1 — Set up */}
      <div className={hidden('setup')} role="tabpanel">
        <PanelIntro text="Before tryout day: set your dates, build a scorecard of what you'll rate, and (optionally) invite helpers to score." />
        <TryoutDayCard apiBase={`${base}/tryout-sessions`} canWrite checkInHref={checkInHref} onError={fail} />
        <TryoutRubricCard apiBase={`${base}/tryout-rubric`} onError={fail} />
        <TryoutEvaluatorsCard apiBase={`${base}/tryout-evaluators`} onError={fail} />
      </div>

      {/* Stage 2 — Tryout day */}
      <div className={hidden('tryout-day')} role="tabpanel">
        <PanelIntro
          text="Check players in (names stay hidden for fairness), then score them — the board ranks everyone live."
          action={<a className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }} href={checkInHref}><UserCheck size={14} /> Open check-in</a>}
        />
        <TryoutScoreboardCard apiBase={`${base}/tryout-scoreboard`} settingsBase={`${base}/tryout-sessions`} onError={fail} />
      </div>

      {/* Stage 3 — Decide */}
      <div className={hidden('decide')} role="tabpanel">
        <PanelIntro text="Offer, waitlist, or pass on each ranked player — families reply from a secure link in their email. (If names are still hidden, reveal them back on the Set up tab first.)" />
        <TryoutDecisionBoard apiBase={`${base}/tryout-decisions`}
          continuityApiBase={`${base}/development/continuity`} onError={fail} />
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
            <p className={flow.resultEmpty}>Once you accept players from the decision board, they&apos;ll appear on your <a href={rosterHref} style={{ color: 'var(--logic-lime, #a3e635)' }}>team roster</a> — ready for lineups.</p>
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
