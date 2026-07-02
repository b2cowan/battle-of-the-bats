'use client';
import { useState } from 'react';
import { Check, ArrowRight, Route, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './TryoutFlowHeader.module.css';

type Step = 'done' | 'current' | 'todo';
export type FlowAnchor = 'setup' | 'tryout-day' | 'decide' | 'roster';
export type TabKey = 'setup' | 'tryout-day' | 'decide' | 'build';

export interface TryoutOverview {
  phase: 'setup' | 'tryout_day' | 'decide' | 'build';
  steps: { setup: Step; tryoutDay: Step; decide: Step; build: Step };
  next: { label: string; hint: string; anchor: FlowAnchor } | null;
  stats: {
    offered: number; waitlisted: number; declined: number; accepted: number;
    rosterFromTryouts: number;
  };
}

interface Props {
  overview: TryoutOverview | null;
  rosterHref: string;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const TABS: { tab: TabKey; step: keyof TryoutOverview['steps']; n: number; label: string }[] = [
  { tab: 'setup',      step: 'setup',     n: 1, label: 'Set up' },
  { tab: 'tryout-day', step: 'tryoutDay', n: 2, label: 'Tryout day' },
  { tab: 'decide',     step: 'decide',    n: 3, label: 'Decide' },
  { tab: 'build',      step: 'build',     n: 4, label: 'Build team' },
];

export default function TryoutFlowHeader({ overview, rosterHref, activeTab, onTabChange }: Props) {
  const [howOpen, setHowOpen] = useState(false);
  if (!overview) return null;

  const next = overview.next;

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.topRow}>
          <h2 className={styles.title}><Route size={16} /> Run your tryout</h2>
          <button type="button" className={styles.howBtn} onClick={() => setHowOpen(o => !o)} aria-expanded={howOpen}>
            {howOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} How tryouts work
          </button>
        </div>

        {/* Single next action */}
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
        ) : (
          <p className={styles.doneNote}>
            You&apos;ve made your decisions.{overview.stats.rosterFromTryouts > 0 && <> <a href={rosterHref} style={{ color: 'var(--logic-lime, #a3e635)' }}>{overview.stats.rosterFromTryouts} player{overview.stats.rosterFromTryouts === 1 ? '' : 's'} on your roster →</a></>}
          </p>
        )}

        {/* Re-openable "How tryouts work" overview — for the once-a-year coach */}
        {howOpen && (
          <div className={styles.how}>
            <div className={styles.howStep}><span className={styles.howNum}>1</span><span><strong>Set up.</strong> Add your tryout dates and build a quick scorecard of what you&apos;ll rate. Invite helpers to score too, if you like — no accounts needed.</span></div>
            <div className={styles.howStep}><span className={styles.howNum}>2</span><span><strong>Tryout day.</strong> Check players in (names stay hidden for fairness) and score them from your phone — the board ranks everyone live.</span></div>
            <div className={styles.howStep}><span className={styles.howNum}>3</span><span><strong>Decide.</strong> Lock scoring, reveal names, then offer, waitlist, or pass on each player. Families reply from a secure link in their email.</span></div>
            <div className={styles.howStep}><span className={styles.howNum}>4</span><span><strong>Build your team.</strong> Accept players onto your roster (with their fees, optional). They&apos;re then ready for your lineups.</span></div>
          </div>
        )}
      </div>

      {/* Stage tabs — one stage on screen at a time; the checks/current-dot double as progress. */}
      <div className={styles.tabBar} role="tablist" aria-label="Tryout stages">
        {TABS.map(t => {
          const st = overview.steps[t.step];
          const active = activeTab === t.tab;
          return (
            <button
              key={t.tab} type="button" role="tab" aria-selected={active}
              className={`${styles.tab} ${active ? styles.tabActive : ''} ${st === 'done' ? styles.tabDone : ''}`}
              onClick={() => onTabChange(t.tab)}
            >
              <span className={styles.tabNum}>{st === 'done' ? <Check size={13} /> : t.n}</span>
              {t.label}
              {st === 'current' && !active && <span className={styles.tabCurrentDot} aria-hidden />}
            </button>
          );
        })}
      </div>
    </>
  );
}
