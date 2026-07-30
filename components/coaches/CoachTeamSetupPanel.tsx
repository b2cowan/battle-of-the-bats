'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Rocket, Check, Loader2, X } from 'lucide-react';
import { activateCoachTeamFeature } from '@/lib/coach-feature-activation';
import { COACH_TEAM_TOOLS, coachTeamToolPath } from '@/lib/coach-team-tools';
import CoachEmptyState from './CoachEmptyState';
import CoachExploreFaintLine from './CoachExploreFaintLine';
import { useCoachNudgeDismiss } from './useCoachNudgeDismiss';
import styles from './CoachTeamSetupPanel.module.css';

export type SetupStepKey = 'roster' | 'schedule' | 'announcements';

/**
 * The free team Overview's setup panel.
 *
 * The defect this replaces: the old panel listed three steps as static text while Roster /
 * Schedule / Announcements are Tier-2 sections OFF by default — so two steps named tabs that
 * didn't exist, and the one button landed the coach on a Roster page missing from their own
 * navigation (a one-way door). Every step now carries its own action and is honest about state:
 * off → turn it on and open it; on → open it; done → a checkmark, and it stops asking.
 *
 * Voice: this is the consumer COMPANION, not the operator HQ. One short warm line per step —
 * deliberately NOT the premium empty states' three-sentence teaching contract.
 *
 * Activation goes through the shared `activateCoachTeamFeature` (the same write Explore uses);
 * Explore itself is untouched and stays the browsable home + a permanent tab.
 */
const STEPS: Array<{
  key: SetupStepKey;
  /** What the coach DOES — plain language, never the tab's name. */
  label: string;
  /** One light line, shown once the tool is on (or the step is done). */
  note: string;
}> = [
  {
    key: 'roster',
    label: 'Add your players',
    note: 'Built once, reused for every tournament you enter.',
  },
  {
    key: 'schedule',
    label: 'Add practices and games',
    note: 'Your own practices alongside your tournament games.',
  },
  {
    key: 'announcements',
    label: 'Send a note to parents',
    note: 'One message to everyone at once.',
  },
];

/** The tool's NAV NAME, from the one shared catalog — a button must name the door it opens. */
function toolLabel(key: SetupStepKey): string {
  return COACH_TEAM_TOOLS.find(tool => tool.key === key)!.label;
}

/** The honest line for a tool the coach hasn't switched on yet. */
const OFF_NOTE = 'Not on yet — this switches it on and opens it.';

export default function CoachTeamSetupPanel({
  basicTeamId,
  activatedFeatures,
  stepsDone,
}: {
  basicTeamId: string;
  /** Tier-2 features already switched on (mig 131) — decides "Turn on" vs "Open". */
  activatedFeatures: string[];
  /** Per-step completion, derived from the team's REAL data on the server. */
  stepsDone: Record<SetupStepKey, boolean>;
}) {
  const router = useRouter();
  const { dismissed, dismiss } = useCoachNudgeDismiss(basicTeamId, 'first_run_setup');
  const [busy, setBusy] = useState<SetupStepKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tools switched on during THIS render's life. `activatedFeatures` is a server prop, so between a
  // successful write and the refreshed payload landing it is stale — without this the panel would
  // re-offer "Turn on" for a tool that is already on (a lie, and a second pointless write).
  const [justActivated, setJustActivated] = useState<SetupStepKey[]>([]);
  // The coach can leave (nav rail, an "Open" link, Back) while a write is in flight. The router
  // outlives this component, so an unguarded push would yank them off the page they chose.
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  async function turnOn(key: SetupStepKey) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await activateCoachTeamFeature(basicTeamId, key, activatedFeatures);
      if (!aliveRef.current) return; // they navigated elsewhere meanwhile — their latest intent wins
      setJustActivated(prev => (prev.includes(key) ? prev : [...prev, key]));
      // Clear `busy` BEFORE navigating. If the navigation stalls (bad signal at a field) the coach
      // must not be left on a dead panel with every button disabled behind a spinner that can only
      // be cleared by reloading — the write already succeeded, so the honest state is "Open X →".
      setBusy(null);
      // `refresh()` is NOT for the rail — the shell refetches team context on every pathname change
      // already. It synchronously invalidates the Router Cache entry for THIS page, so coming back
      // to the Overview doesn't replay a stale payload still offering "Turn on".
      router.refresh();
      router.push(coachTeamToolPath(basicTeamId, key));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn this on.');
      setBusy(null);
    }
  }

  // Server truth + anything switched on since this panel mounted. Hoisted out of the row loop.
  const activated = new Set<string>([...activatedFeatures, ...justActivated]);

  // Dismissed → the panel degrades to one faint line back to Explore. Never erased: the line is
  // live, and Explore is a permanent tab either way.
  if (dismissed) {
    return (
      <CoachExploreFaintLine basicTeamId={basicTeamId}>
        Set up your team any time — explore your free tools →
      </CoachExploreFaintLine>
    );
  }

  return (
    // .preHydrateGate: CSS hides this before first paint when the no-flash script found this team's
    // skip flag, so a coach who opted out never watches the card paint and collapse.
    <div className={styles.preHydrateGate}>
    <CoachEmptyState
      icon={<Rocket size={22} aria-hidden />}
      eyebrow="Get started"
      headline="Let’s set up your team"
      description="Three quick steps and your team home is ready."
    >
      <div className={styles.body}>
        <ol className={styles.steps}>
          {STEPS.map(({ key, label, note }, index) => {
            // ONE derived state per row. The marker, the class, the note and the action all read
            // from it, so a later tweak can't leave three independent done/on checks disagreeing.
            //
            // Being switched ON outranks having data, and that ordering is the whole point: the
            // tool sub-routes are NOT gated on activation, so a coach who reaches /schedule by
            // bookmark or typed URL can add an event while the tool stays off. Ranking "done"
            // first would then render a checkmark with no button, while the nav still hides the
            // tab — rebuilding the exact one-way door this panel exists to close. An off tool
            // always offers to turn itself on, however much data is already behind it.
            const state = !activated.has(key) ? 'off' : stepsDone[key] ? 'done' : 'on';
            const tab = toolLabel(key);
            return (
              <li key={key} className={`${styles.step}${state === 'done' ? ` ${styles.stepDone}` : ''}`}>
                <span className={styles.marker} aria-hidden>
                  {state === 'done' ? <Check size={15} /> : index + 1}
                </span>
                <span className={styles.text}>
                  <span className={styles.label}>
                    {state === 'done' && <span className={styles.srOnly}>Done: </span>}
                    {label}
                  </span>
                  <span className={styles.note}>{state === 'off' ? OFF_NOTE : note}</span>
                </span>
                {/* A finished step stops asking — no button at all. */}
                {state === 'done' ? null : state === 'on' ? (
                  <Link href={coachTeamToolPath(basicTeamId, key)} className={styles.openBtn}>
                    Open {tab} &rarr;
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.turnOn}
                    onClick={() => turnOn(key)}
                    disabled={busy !== null}
                  >
                    {busy === key
                      ? <><Loader2 size={13} className={styles.spin} aria-hidden /> Turning on&hellip;</>
                      : <>Turn on {tab} &rarr;</>}
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {/* The real exit — one interaction. Plenty of free coaches only ever want a place to keep
            their team while they enter a tournament; clearing guidance must not cost three steps. */}
        <button type="button" className={styles.skip} onClick={dismiss}>
          <span>Just here to enter a tournament? Skip all this.</span>
          <X size={14} aria-hidden />
        </button>
      </div>
    </CoachEmptyState>
    </div>
  );
}
