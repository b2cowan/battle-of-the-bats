'use client';
import { use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import HelpButton from '@/components/help/HelpButton';
import { playerDisplayName } from '@/lib/coach-roster-name';
import {
  blockRotates, buildRunSteps, computeBlockClocks, computeRotation, formatDuration, formatRunClock,
  resolveStationTeaching, runRemainingSeconds, runStepAt,
  type PracticePlan, type PracticePlanBlock, type RotationGrid, type RunStep,
} from '@/lib/rep-practice-plan';
import PracticeStationView from '../../_PracticeStationView';
import type { PracticeRosterPlayer } from '../../_PracticePlanEditor';
import styles from '../../../../../coaches.module.css';
import type { RepAttendanceStatus, RepTeamEvent } from '@/lib/types';

/**
 * The field run screen (Practice Plans 1b) — 6:25 PM, sun, gloves, twelve kids.
 *
 * ⚠ NOTHING IS WRITTEN HERE (D4). No ticks, no "✓ ran it", no elapsed-time store, no completion
 * flag — not even locally in a way that could later be persisted. Attendance is the one field-time
 * write a coach with twelve kids reliably finishes, it is already built, and a second one gets
 * half-done and then poisons every downstream coverage surface with data that *looks* like "what we
 * did". "Rotate now" moves the screen and records nothing (D26). The vocabulary is **planned**,
 * never **done**.
 *
 * ⚠ NO SWIPE, NO DRAG, NO LONG-PRESS. Gloves defeat all three and a swipe collides with the
 * browser's own back gesture. Two buttons, both above 56px.
 *
 * ⚠ NO SOUND, NO VIBRATION, NO AUTO-ADVANCE. The clock counts, overrun goes amber, and the screen
 * WAITS. The cursor moves only when a human taps it — including when the planned clock has long
 * since passed, because a drill that is going well should be allowed to run long.
 *
 * ⚠ NO WAKE LOCK. There is no precedent for that API anywhere in this codebase; it is an explicit
 * fast-follow, not something to add quietly under time pressure.
 *
 * Read + run rides `schedule` — the same grant that already opens Tuesday's practice — so an
 * assistant can run a station without a new capability key. There are no writes on this screen, so
 * there is no write gate to get wrong.
 */

type RunData = {
  event: RepTeamEvent;
  plan: PracticePlan | null;
  roster: PracticeRosterPlayer[];
  attendance: { playerId: string; status: RepAttendanceStatus }[];
  viewerName: string | null;
  canViewAttendance: boolean;
  /**
   * May this viewer move the practice on? False for a HELPER (Phase 4) — they run one station and
   * do not decide when the whole team rotates. ⚠ Optional so a client holding a cached response
   * from before this shipped still gets its controls; a missing field must never read as "no".
   */
  canAdvance?: boolean;
  /** Who does move it on, for the line that replaces the button. Null when unknown — never guessed. */
  headCoachName?: string | null;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * "Group A" → "A", so a group reads at arm's length in a 2.75rem gutter.
 *
 * Falls back to the first few characters for a renamed group, and never to an index: the label on
 * screen has to be the one the coach shouted across the diamond, not a position in an array.
 */
function shortGroupLabel(name: string): string {
  const trimmed = name.trim();
  const withoutPrefix = trimmed.replace(/^group\s+/i, '');
  const candidate = withoutPrefix || trimmed;
  return candidate.length <= 3 ? candidate : candidate.slice(0, 2).toUpperCase();
}

/** Which stations the reader is tagged on, matched case-insensitively against their own name. */
function isViewersStation(staff: string[] | undefined, viewerName: string | null): boolean {
  if (!viewerName?.trim() || !staff?.length) return false;
  const me = viewerName.trim().toLowerCase();
  return staff.some(s => s.trim().toLowerCase() === me);
}

/** The one place that decides what the big button says and does. */
type Advance = { label: string; disabled: boolean };

export default function CoachPracticeRunPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; eventId: string }>;
}) {
  const { orgSlug, teamId, eventId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const planHref = `${base}/practice/${eventId}`;

  const assignment = assignments.find(a => a.teamId === teamId);
  const canSchedule = assignment ? assignment.capabilities.schedule : true;

  const runHelpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-practice-run'],
    label: 'Running a practice',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-practice-run`,
  };

  const [data, setData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  /**
   * The cursor. `stepIndex` is where the coach is; `anchorMs` is when the stop on screen started.
   *
   * ⚠ THE ANCHOR IS THE OWNER'S RULING (2026-08-01). Null means "use the PLANNED start", which is
   * what makes opening a phone mid-practice land on the right block with the right number. The
   * moment the coach taps, the stop is re-anchored to *now* and gets its full planned length —
   * so a practice that started eight minutes late does not spend the rest of the night claiming
   * every remaining block is overdue.
   */
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [anchorMs, setAnchorMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [stationId, setStationId] = useState<string | null>(null);

  // Ticks once a second. Started in an effect (never in the initial state) so the server and the
  // first client render agree — a clock seeded with Date.now() during SSR is a hydration mismatch.
  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setLoadError('');
    try {
      // The 1a endpoint already returns everything this screen needs and it is the ONE place the
      // capability model for a practice plan lives. A second read-only route would be a second
      // gate to keep in step with it.
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/practice-plan`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not load this practice');
      }
      const body: RunData = await res.json();
      if (seq !== loadSeqRef.current) return;
      setData(body);
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      setLoadError(errorMessage(e, 'Could not load this practice'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [orgSlug, teamId, eventId]);

  useEffect(() => {
    if (!ctxLoading && canSchedule) void Promise.resolve().then(load);
  }, [ctxLoading, canSchedule, load]);

  const plan = data?.plan ?? null;
  const blocks = useMemo(() => plan?.blocks ?? [], [plan]);
  const eventStartsAt = data?.event.startsAt ?? null;
  const eventEndsAt = data?.event.endsAt ?? null;

  const steps = useMemo(
    () => buildRunSteps(blocks, eventStartsAt, eventEndsAt),
    [blocks, eventStartsAt, eventEndsAt],
  );

  // Open on the stop the PLANNED clock says is running — once, then the coach owns the cursor.
  useEffect(() => {
    if (stepIndex !== null || steps.length === 0) return;
    setStepIndex(runStepAt(steps, Date.now()));
  }, [steps, stepIndex]);

  // The block clocks, walked ONCE and shared with the rotation grid — never a second copy of how
  // "rest of practice" advances the running clock. Indexed BY POSITION, matching buildRunSteps:
  // block ids are client-minted and not guaranteed unique, so a Map keyed on them could hand one
  // block another's start time.
  const clocks = useMemo(
    () => computeBlockClocks(blocks, eventStartsAt, eventEndsAt),
    [blocks, eventStartsAt, eventEndsAt],
  );

  const gridFor = useCallback((block: PracticePlanBlock, blockIndex: number): RotationGrid | null => {
    if (!blockRotates(block) || !block.rotation) return null;
    return computeRotation(
      block.rotation, block.stations, block.duration.minutes ?? null,
      clocks[blockIndex]?.startMs,
    );
  }, [clocks]);

  /**
   * ⚠ A MAP, not a scan. This screen re-renders every second for ninety minutes, and a rotation
   * round asks for a dozen names each time — a linear `.find` per name would be a few thousand
   * pointless comparisons a minute on the phone in the coach's hand.
   */
  const rosterById = useMemo(
    () => new Map((data?.roster ?? []).map(p => [p.id, p])),
    [data?.roster],
  );
  const nameOf = useCallback((playerId: string) => {
    const player = rosterById.get(playerId);
    return player ? playerDisplayName(player) : '';
  }, [rosterById]);

  const index = Math.min(Math.max(stepIndex ?? 0, 0), Math.max(steps.length - 1, 0));
  const step: RunStep | null = steps[index] ?? null;
  const nextStep: RunStep | null = steps[index + 1] ?? null;
  const block = step ? blocks[step.blockIndex] ?? null : null;

  // `nowMs` is 0 until the tick effect runs, and a clock measured against that would read as a
  // wild number for one frame. Nothing clock-shaped renders until it is real.
  const clockReady = nowMs > 0;
  const anchor = anchorMs ?? step?.startMs ?? 0;
  const remaining = step && clockReady ? runRemainingSeconds(step.minutes, anchor, nowMs) : null;
  const clock = remaining == null ? null : formatRunClock(remaining);
  const over = remaining != null && remaining < 0;

  /** Move the cursor, and re-anchor: from this moment, this stop gets its full planned length. */
  const go = useCallback((delta: number) => {
    setStepIndex(current => {
      const from = current ?? 0;
      return Math.min(steps.length - 1, Math.max(0, from + delta));
    });
    setAnchorMs(Date.now());
  }, [steps.length]);

  const rotating = !!block && blockRotates(block);
  /**
   * ⚠ MEMOISED, and it matters more than it looks. `computeRotation` walks groups × rounds, builds
   * the plain-language statements, and formats a clock label per round — each of which constructs
   * an `Intl.DateTimeFormat`. Called straight from the render body it would redo all of that once
   * a second, for every second of the block.
   */
  const grid = useMemo(
    () => (block && step ? gridFor(block, step.blockIndex) : null),
    [block, step, gridFor],
  );
  const staysInBlock = !!nextStep && !!step && nextStep.blockIndex === step.blockIndex;
  const advance: Advance = {
    label: staysInBlock ? 'Rotate now' : 'Next block',
    disabled: !nextStep,
  };
  // A rotation that has run past its interval AND still has a round to go: the screen says so and
  // waits. It never rotates by itself.
  const rotationDue = over && staysInBlock && step?.round != null;

  // Memoised because the restore effect below depends on it — a fresh [] every render would make
  // that effect re-run on every tick of the clock.
  const stations = useMemo(() => block?.stations ?? [], [block]);
  const openStation = stations.find(s => s.id === stationId) ?? null;
  const openStationIndex = stations.findIndex(s => s.id === stationId);

  /**
   * A station chosen on this device stays chosen for the rest of the practice (D28).
   *
   * ⚠ This is a UI PREFERENCE, not a record of the practice, and it is deliberately per-tab and
   * per-event: it says *which station I am standing at*, never what happened at it. D4's rule —
   * nothing about the practice is written at the field — is untouched.
   */
  const stationKey = `fl.practice-run.station.${eventId}`;
  // Restored ONCE, after the plan arrives — not on every render, and never again after the coach
  // has started moving around the practice themselves.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || stations.length === 0) return;
    restoredRef.current = true;
    try {
      const saved = sessionStorage.getItem(stationKey);
      if (saved && stations.some(s => s.id === saved)) setStationId(saved);
    } catch { /* private mode / storage disabled — the picker still works */ }
  }, [stationKey, stations]);

  const chooseStation = useCallback((id: string | null) => {
    setStationId(id);
    try {
      if (id) sessionStorage.setItem(stationKey, id);
      else sessionStorage.removeItem(stationKey);
    } catch { /* nothing to keep, nothing to lose */ }
  }, [stationKey]);

  /**
   * Everything below re-derives only when the PLAN or the CURSOR moves — never on the clock tick.
   *
   * ⚠ These live above the render guards on purpose: hooks cannot sit after an early return, and
   * computing them inline further down (where they read more naturally) is exactly what would put
   * a fresh Map and two array walks on every second of a ninety-minute practice.
   */
  const attendanceByPlayer = useMemo(
    () => new Map((data?.attendance ?? []).map(a => [a.playerId, a.status])),
    [data?.attendance],
  );
  const attendingCount = useMemo(
    () => (data?.roster ?? []).filter(p => attendanceByPlayer.get(p.id) === 'attending').length,
    [data?.roster, attendanceByPlayer],
  );
  const blockPlayers = useMemo(
    () => (block?.playerIds ?? []).map(nameOf).filter(Boolean),
    [block, nameOf],
  );
  /** The moves that are due, named group by group — never one silently winning. */
  const stepRound = step?.round ?? null;
  const dueMoves = useMemo(() => {
    if (!rotationDue || !grid || stepRound == null) return '';
    // `stepRound` is 1-based, so it indexes the NEXT round's cells — where everyone is going.
    return (grid.roundsList[stepRound]?.cells ?? [])
      .map(c => `${shortGroupLabel(c.groupName)} → ${c.stationName || 'a station'}`)
      .join(' · ');
  }, [rotationDue, grid, stepRound]);

  // ── Render ──
  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <CoachNotOnTeam />;
  }

  const backToPlan = (
    <Link href={planHref} className={styles.lineupBackLink}>
      <ArrowLeft size={14} aria-hidden /> The plan
    </Link>
  );

  if (!canSchedule) {
    return (
      <div className={styles.page}>
        {backToPlan}
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={22} />}
          headline="Practice plans aren’t enabled for you"
          description="The field screen walks through a practice one block at a time — what’s running now, who’s where, and how long is left."
          blocker="Ask your head coach to give you schedule access."
        />
      </div>
    );
  }

  if (loading) return <div className={styles.page}>{backToPlan}<div className={styles.loadingState}>Loading practice…</div></div>;
  if (loadError) return <div className={styles.page}>{backToPlan}<p className={styles.errorText}>{loadError}</p></div>;

  if (blocks.length === 0) {
    return (
      <div className={styles.page}>
        {backToPlan}
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={22} />}
          headline="There’s no plan to run yet"
          description="The field screen walks through the blocks of a practice one at a time. This practice doesn’t have any yet."
          secondaryAction={{ href: planHref, label: 'Open the plan' }}
        />
      </div>
    );
  }

  // A running clock needs a start time; there is no honest way to invent one.
  if (steps.length === 0) {
    return (
      <div className={styles.page}>
        {backToPlan}
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={22} />}
          headline="This practice has no start time"
          description="The running clock is worked out from when the practice starts, so the field screen needs one."
          blocker="Add a start time to this practice on the schedule, and this screen works straight away."
          secondaryAction={{ href: `${base}/schedule?event=${eventId}`, label: 'Open it on the schedule' }}
        />
      </div>
    );
  }

  if (!step || !block) return null;

  /**
   * ⚠ A HELPER DOES NOT DRIVE THE PRACTICE (Phase 4, frame H3).
   *
   * Everything on this screen is client state and writes nothing (D4), so this is not a permission —
   * it is honesty. A parent volunteer running the tee does not decide when all three groups rotate,
   * and handing them a button that looks like it moves everybody would be worse than no button.
   *
   * ⚠ It must NOT be a disabled control either: an amber "rotation due" state above a greyed-out
   * "Rotate now" is a screen telling someone off for not doing a thing they were never able to do.
   * They get a sentence naming who does it — which is information they can act on, by looking up.
   *
   * `!== false` deliberately: a response cached from before this field existed still gets controls.
   */
  const canAdvance = data?.canAdvance !== false;
  const whoAdvances = data?.headCoachName?.trim()
    ? `${data.headCoachName.trim()} moves everyone on.`
    : 'Your coach moves everyone on.';

  const actionRow = canAdvance ? (
    <div className={styles.ppRunActions}>
      <button type="button" className={styles.ppRunSecondary} disabled={index === 0} onClick={() => go(-1)}>
        Back
      </button>
      {advance.disabled ? (
        <Link href={planHref} className={styles.ppRunPrimary}>Back to the plan</Link>
      ) : (
        <button type="button" className={styles.ppRunPrimary} onClick={() => go(1)}>{advance.label}</button>
      )}
    </div>
  ) : (
    <p className={styles.ppRunHandedOff}>{whoAdvances}</p>
  );

  if (openStation) {
    return (
      <div className={styles.page}>
        <PracticeStationView
          station={openStation}
          stationIndex={openStationIndex}
          block={block}
          rotating={rotating}
          grid={grid}
          round={step.round}
          isMine={isViewersStation(openStation.staff, data?.viewerName ?? null)}
          clock={clock}
          clockOver={over}
          nameOf={nameOf}
          onBack={() => chooseStation(null)}
          actions={
            /* The same tap as on the block screen, so a station coach never has to back out to a
               list to move the round on. It moves the screen and records nothing.
               ⚠ A helper gets the sentence instead — see `canAdvance` above. */
            !canAdvance ? (
              <p className={styles.ppRunHandedOff}>{whoAdvances}</p>
            ) : advance.disabled ? null : (
              <div className={styles.ppRunActions}>
                <button type="button" className={styles.ppRunPrimary} onClick={() => go(1)}>{advance.label}</button>
              </div>
            )
          }
        />
      </div>
    );
  }

  /**
   * What a plain stop teaches.
   *
   * ⚠ A block built by picking ONE drill holds its teaching on the STATION, not the block — so
   * reading `block.description` alone would show a blank screen for exactly the block a coach
   * assembled in four taps. With a single station the station IS the block, so its words are
   * resolved through; with two or more they differ from each other and the station list below is
   * the honest answer, so the block keeps its own.
   */
  const soleStation = (block.stations ?? []).length === 1 ? block.stations![0] : null;
  const { description: stopDescription, goal: stopGoal, coachingPoints: points } =
    resolveStationTeaching(soleStation ?? {}, block);

  // What the small line under the clock says. Read top to bottom: the most specific state wins.
  let clockLabel: string;
  if (rotationDue) clockLabel = 'Rotation due';
  else if (over) clockLabel = 'Over by';
  else if (step.round != null) clockLabel = 'Until they rotate';
  else if (step.restOfPractice) clockLabel = 'Left of practice';
  else clockLabel = `Left of ${step.minutes} min`;

  // The one quiet line at the foot — the thing a coach actually reads mid-drill.
  let upNext: ReactNode;
  if (!nextStep) {
    upNext = 'That’s the last block.';
  } else if (staysInBlock && nextStep.round != null && grid) {
    upNext = <>Next &nbsp;<b>Round {nextStep.round}</b>{firstMoveOf(grid, nextStep.round)}</>;
  } else {
    const nextBlock = blocks[nextStep.blockIndex];
    upNext = (
      <>
        {step.round != null ? 'After this' : 'Up next'} &nbsp;
        <b>{nextBlock?.title.trim() || 'the next block'}</b>{durationSuffix(nextBlock)}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.ppRunPage}>
        <div className={styles.ppRunBar}>
          <Link href={planHref} className={styles.ppRunBackLink}>
            <ArrowLeft size={13} aria-hidden /> Plan
          </Link>
          {/* Help stays in the 0.7rem chrome line, never in the body — at arm's length in the sun
              there is room for exactly one idea, and it isn't this one. */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <b>{step.blockIndex + 1} of {blocks.length}</b>
            <HelpButton iconOnly label="Running a practice" help={runHelpRequest} />
          </span>
        </div>

        <h1 className={styles.ppRunTitle}>{block.title.trim() || `Block ${step.blockIndex + 1}`}</h1>
        {step.round != null && <p className={styles.ppRunRound}>Round {step.round} of {step.rounds}</p>}

        {clock ? (
          <>
            <p className={styles.ppRunClock} data-over={over ? 'over' : undefined}>{clock}</p>
            <p className={styles.ppRunOf} data-over={over ? 'over' : undefined}>{clockLabel}</p>
          </>
        ) : clockReady ? (
          <p className={styles.ppRunOf}>{step.restOfPractice ? 'Runs to the end' : 'No length set'}</p>
        ) : null}

        {/* ── A rotation: where everyone is, or where everyone is about to go ── */}
        {rotating && grid && step.round != null && (
          rotationDue ? (
            <div className={styles.ppRunWhere} data-due="due">
              <span className={styles.ppRunWhereG} aria-hidden>→</span>
              <div>
                <p className={styles.ppRunWhereS}>{dueMoves || 'Move the groups on'}</p>
                <p className={styles.ppRunWhereM}>Coaches stay where they are</p>
              </div>
            </div>
          ) : (
            (grid.roundsList[step.round - 1]?.cells ?? []).map(cell => {
              const station = (block.stations ?? []).find(s => s.id === cell.stationId);
              return (
                <div key={cell.groupId} className={styles.ppRunWhere}>
                  <span className={styles.ppRunWhereG}>{shortGroupLabel(cell.groupName)}</span>
                  <div>
                    <p className={styles.ppRunWhereS}>{cell.stationName || 'Station'}</p>
                    {station?.staff?.length ? <p className={styles.ppRunWhereM}>{station.staff.join(' · ')}</p> : null}
                  </div>
                </div>
              );
            })
          )
        )}

        {/* ── A plain stop: the note, what to watch for, and who's in it ──
            ⚠ Keyed on `step.round == null`, NOT on `!rotating`. A block can be set to rotate and
            still have no computable carousel — two stations added, groups not drawn yet, which is
            simply what a half-written block looks like. `buildRunSteps` gives that a plain stop,
            so gating on `!rotating` left it falling between the two sections and rendering neither:
            the description, goal and coaching points the coach had already typed just vanished. */}
        {step.round == null && (
          <>
            {stopDescription && <p className={styles.ppRunNote}>{stopDescription}</p>}
            {stopGoal && <p className={styles.ppRunGoal}>{stopGoal}</p>}
            {points.length > 0 && (
              <ol className={styles.ppRunPoints}>
                {points.map((point, i) => <li key={i}>{point}</li>)}
              </ol>
            )}
            {blockPlayers.length > 0 && (
              <div className={styles.ppRunWho}>
                {blockPlayers.map(name => <span key={name} className={styles.ppRunChip}>{name}</span>)}
              </div>
            )}
          </>
        )}

        {/* ── The station picker (D28). Yours is picked out because you're tagged on it. ── */}
        {stations.length > 0 && (
          <div className={styles.ppRunStations}>
            <p className={styles.ppRunStationsLbl}>Stations</p>
            {stations.map((station, i) => {
              const mine = isViewersStation(station.staff, data?.viewerName ?? null);
              const staffLine = station.staff?.length ? station.staff.join(' · ') : '';
              return (
                <button
                  key={station.id}
                  type="button"
                  className={styles.ppRunStationRow}
                  data-mine={mine ? 'mine' : undefined}
                  onClick={() => chooseStation(station.id)}
                >
                  <span>
                    <span className={styles.ppRunStationName}>
                      {station.name.trim() || `Station ${i + 1}`}
                    </span>
                    {(staffLine || mine) && (
                      <span className={styles.ppRunStationMeta}>
                        {staffLine}{mine ? `${staffLine ? ' — ' : ''}that’s you` : ''}
                      </span>
                    )}
                  </span>
                  <span className={styles.ppRunStationGo}>{mine ? 'Open' : 'View'}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className={styles.ppRunNext}>{upNext}</p>

        {actionRow}

        {/* ── D8 — who's here tonight. Read-only, folded shut, already true. ── */}
        {data?.canViewAttendance && (data?.roster.length ?? 0) > 0 && (
          <details className={styles.ppRunFold}>
            <summary className={styles.ppRunFoldHead}>
              <span>Who’s here tonight</span>
              <span className={styles.ppRunFoldCount}>{attendingCount} of {data.roster.length}</span>
            </summary>
            <div className={styles.ppRunFoldBody}>
              {ATTENDANCE_GROUPS.map(group => {
                // Roster order, always — no sort affordance anywhere in this feature (§4).
                const names = data.roster
                  .filter(p => (attendanceByPlayer.get(p.id) ?? 'unknown') === group.status)
                  .map(playerDisplayName);
                if (names.length === 0) return null;
                return (
                  <p key={group.status} className={styles.ppRunFoldGroup}>
                    <b>{group.label}</b>{names.join(' · ')}
                  </p>
                );
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Read-only, present → not-present → unset.
 *
 * ⚠ The labels are VERBATIM the attendance tab's (`ATTENDANCE_OPTIONS` in the schedule page) —
 * a coach reads the same four words on both screens. The first draft of this list invented
 * "Coming / Running late / Not coming", which is a second vocabulary for one enum and the kind of
 * drift that is only ever cheap to fix on the day it is written.
 */
const ATTENDANCE_GROUPS: { status: RepAttendanceStatus; label: string }[] = [
  { status: 'attending', label: 'In' },
  { status: 'late', label: 'Late' },
  { status: 'absent', label: 'Out' },
  { status: 'unknown', label: 'No reply' },
];

/** " · A → Short hop" — where the first group lands next, which is what the mockup reads at. */
function firstMoveOf(grid: RotationGrid, round: number): string {
  const cell = grid.roundsList[round - 1]?.cells[0];
  if (!cell) return '';
  // shortGroupLabel(), not a second inline copy of it — otherwise a renamed group could read one
  // way in the "up next" line and another in the card directly above it, on the same screen.
  return ` · ${shortGroupLabel(cell.groupName)} → ${cell.stationName || 'a station'}`;
}

function durationSuffix(block: PracticePlanBlock | undefined): string {
  const label = block ? formatDuration(block.duration) : '';
  return label ? ` · ${label}` : '';
}
