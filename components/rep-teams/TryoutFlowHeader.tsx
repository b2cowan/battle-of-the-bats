'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './TryoutFlowHeader.module.css';

type Step = 'done' | 'current' | 'todo';
export type FlowAnchor = 'setup' | 'tryout-day' | 'decide' | 'roster';
export type TabKey = 'setup' | 'tryout-day' | 'decide' | 'build';

export interface TryoutOverview {
  phase: 'setup' | 'tryout_day' | 'decide' | 'build';
  steps: { setup: Step; tryoutDay: Step; decide: Step; build: Step };
  next: { label: string; hint: string; anchor: FlowAnchor } | null;
  stats: {
    sessionCount: number; hasScorecard: boolean; evaluatorCount: number;
    candidateCount: number; checkedInCount: number; scoredCount: number;
    blind: boolean; locked: boolean;
    offered: number; waitlisted: number; declined: number; accepted: number;
    rosterFromTryouts: number;
  };
}

export const phaseToTab = (phase: TryoutOverview['phase']): TabKey =>
  phase === 'tryout_day' ? 'tryout-day' : phase === 'setup' ? 'setup' : phase === 'decide' ? 'decide' : 'build';

interface Props {
  overview: TryoutOverview | null;
  rosterHref: string;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  /** Shareable address for a stage tab — the caller owns its own query state (the CoachTabBar
   *  rule: tabs are LINKS, so middle-click, copy-link and browser Back all work). */
  hrefFor: (tab: TabKey) => string;
}

const TABS: { tab: TabKey; step: keyof TryoutOverview['steps']; n: number; label: string }[] = [
  { tab: 'setup',      step: 'setup',     n: 1, label: 'Set up' },
  { tab: 'tryout-day', step: 'tryoutDay', n: 2, label: 'Tryout day' },
  { tab: 'decide',     step: 'decide',    n: 3, label: 'Decide' },
  { tab: 'build',      step: 'build',     n: 4, label: 'Build team' },
];

const PHASE_STEP_N: Record<TryoutOverview['phase'], number> = { setup: 1, tryout_day: 2, decide: 3, build: 4 };

/**
 * The stage tab row + the "How tryouts work" guide (One-Room build, 2026-08-23).
 *
 * The "Run your tryout" CARD is gone: collapsed it carried no information — a full-width row
 * whose only job was holding this toggle, on the most valuable strip of the screen, one line
 * under the help "?" that opens the same subject. The toggle now rests at the quiet end of the
 * tab row (zero vertical cost) and the guide panel drops below the tabs, content unchanged.
 */
export default function TryoutFlowHeader({ overview, rosterHref, activeTab, onTabChange, hrefFor }: Props) {
  const [howOpen, setHowOpen] = useState(false);
  // The guide opens ITSELF exactly once, for the team that has never touched tryouts — the coach
  // who needs the map is exactly the coach who doesn't know to ask for it. A user toggle always
  // wins, and nothing is stored: the resting state is the link, so next August it's still here.
  const userToggled = useRef(false);
  const autoOpenDecided = useRef(false);
  useEffect(() => {
    if (!overview || autoOpenDecided.current) return;
    autoOpenDecided.current = true;
    if (!userToggled.current && overview.stats.sessionCount === 0 && !overview.stats.hasScorecard) {
      setHowOpen(true);
    }
  }, [overview]);

  const next = overview?.next ?? null;
  const hereN = overview ? PHASE_STEP_N[overview.phase] : 0;
  const num = (n: number) => (
    <span className={`${styles.howNum} ${n === hereN ? styles.howNumHere : ''}`}>{n}</span>
  );

  return (
    <>
      {/* Stage tabs — one stage on screen at a time; the checks/current-dot double as progress. */}
      <nav className={styles.tabBar} aria-label="Tryout stages">
        {TABS.map(t => {
          const st = overview?.steps[t.step] ?? 'todo';
          const active = activeTab === t.tab;
          return (
            <Link
              key={t.tab}
              href={hrefFor(t.tab)}
              aria-current={active ? 'page' : undefined}
              className={`${styles.tab} ${active ? styles.tabActive : ''} ${st === 'done' ? styles.tabDone : ''}`}
            >
              <span className={styles.tabNum}>{st === 'done' ? <Check size={13} /> : t.n}</span>
              {t.label}
              {st === 'current' && !active && <span className={styles.tabCurrentDot} aria-hidden />}
            </Link>
          );
        })}
        <button
          type="button"
          className={styles.howBtn}
          onClick={() => { userToggled.current = true; setHowOpen(o => !o); }}
          aria-expanded={howOpen}
        >
          {howOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} How tryouts work
        </button>
      </nav>

      {/* Re-openable "How tryouts work" overview — for the once-a-year coach. The guide ends with
          the single next action ("whole journey → your next move on it"), and the ring on the
          current step's number ties that prompt back to the map. */}
      {howOpen && (
        <div className={styles.how}>
          <div className={styles.howStep}>{num(1)}<span><strong>Set up.</strong> Add your tryout dates and build a quick scorecard of what you&apos;ll rate. Invite helpers to score too, if you like — no accounts needed.</span></div>
          <div className={styles.howStep}>{num(2)}<span><strong>Tryout day.</strong> Check players in (names stay hidden for fairness) and score them from your phone — the board ranks everyone live.</span></div>
          <div className={styles.howStep}>{num(3)}<span><strong>Decide.</strong> Sort each player into Offering, Waitlist or Not this season — tap one to see what made their score. Nothing is sent to a family; whoever sits in Offering is who you build the roster from.</span></div>
          <div className={styles.howStep}>{num(4)}<span><strong>Build your team.</strong> Add your Offering players onto the roster — one tap each. They&apos;re then ready for your lineups; squad numbers and dues come after.</span></div>

          {next ? (
            <div className={styles.next}>
              <div className={styles.nextMain}>
                <div className={styles.nextLabel}>Do this next</div>
                <p className={styles.nextText}>{next.label}</p>
                <p className={styles.nextHint}>{next.hint}</p>
              </div>
              {next.anchor === 'roster' ? (
                <a className={styles.nextBtn} href={rosterHref}>{next.label} <ArrowRight size={15} /></a>
              ) : (
                <button type="button" className={styles.nextBtn} onClick={() => onTabChange(next.anchor as TabKey)}>
                  Take me there <ArrowRight size={15} />
                </button>
              )}
            </div>
          ) : overview && (
            <p className={styles.doneNote}>
              You&apos;ve made your decisions.{overview.stats.rosterFromTryouts > 0 && <> <a href={rosterHref} style={{ color: 'var(--logic-lime)' }}>{overview.stats.rosterFromTryouts} player{overview.stats.rosterFromTryouts === 1 ? '' : 's'} on your roster →</a></>}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * "Do this first" — a tab opened AHEAD of the tryout's actual stage leads with the honest reason
 * plus one jump back, with the tab's own content still visible below (guide-don't-gate ruling,
 * 2026-08-17 — tabs are never disabled). Renders nothing on the current/earlier stages.
 */
export function TryoutPrereqPrompt({ overview, tab, onTabChange }: {
  overview: TryoutOverview | null;
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  if (!overview) return null;
  const order: TabKey[] = ['setup', 'tryout-day', 'decide', 'build'];
  if (order.indexOf(tab) <= order.indexOf(phaseToTab(overview.phase))) return null;

  let text: string, target: TabKey, label: string;
  if (overview.phase === 'setup') {
    text = overview.stats.sessionCount === 0
      ? 'You haven’t set your tryout dates yet — that’s step 1.'
      : 'You haven’t built your scorecard yet — that’s step 1.';
    target = 'setup'; label = 'Go to Set up';
  } else if (overview.phase === 'tryout_day') {
    text = tab === 'build'
      ? 'Nothing to build from yet — check-in and scoring happen on tryout day.'
      : 'Nothing to decide yet — scores come in on tryout day.';
    target = 'tryout-day'; label = 'Go to Tryout day';
  } else {
    text = 'No offers out yet — decisions happen in step 3.';
    target = 'decide'; label = 'Go to Decide';
  }

  return (
    <div className={styles.preNote} role="note">
      <div className={styles.preMain}>
        <div className={styles.preLabel}>Do this first</div>
        <p className={styles.preText}>{text}</p>
      </div>
      <button type="button" className={styles.preBtn} onClick={() => onTabChange(target)}>
        {label} <ArrowRight size={14} />
      </button>
    </div>
  );
}
