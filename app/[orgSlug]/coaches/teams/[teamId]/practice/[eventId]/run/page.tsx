'use client';
import { Fragment, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import HelpButton from '@/components/help/HelpButton';
import { playerDisplayName } from '@/lib/coach-roster-name';
import {
  blockOwnPeople, blockRotates, buildRunSteps, computeRotation, formatDuration, levelsForStaffTags,
  namesWholeTeam, resolvePracticePlanTagNames, resolveStationTeaching, rotationByStation,
  runStepLengthLabel, soleStationOf, stationLabel,
  type PracticePlan, type PracticePlanBlock, type PracticeStation, type RotationGrid, type RunStep,
} from '@/lib/rep-practice-plan';
import PracticeStationView from '../../_PracticeStationView';
import type { PracticeRosterPlayer } from '../../_PracticePlanEditor';
import type { PickableTag } from '@/components/coaches/TagPicker';
import styles from '../../../../../coaches.module.css';
import type { RepAttendanceStatus, RepTeamEvent } from '@/lib/types';

/**
 * The field run screen (Practice Plans 1b) — 6:25 PM, sun, gloves, twelve kids.
 *
 * ⚠ THERE IS NO CLOCK ON THIS SCREEN (owner ruling 2026-09-17, practices re-evaluation stage 5,
 * P10). It used to count — a big countdown per stop, amber once it ran over, a "Rotation due"
 * state, the cursor re-anchored to every tap, a ±3h window outside which the counter gave way to
 * "Planned for …". All of it went in one ruling: a practice never runs to the plan's minute, the
 * block before this one went long and the coach is shortening this one on the fly, and a screen
 * reading "+2:37:53 · OVER BY" is arguing with the person it was built for. What this screen offers
 * is the INFORMATION for the practice — the stop the coach is on, what it is, who runs it, who is
 * in it, where the groups are, what comes next — and the coach is the clock. The plan's length for
 * a stop is shown as plain information ("15 min", "10 min a round"), never counted down.
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
 * ⚠ NO SOUND, NO VIBRATION, NO AUTO-ADVANCE. The cursor moves only when a human taps it.
 *
 * ⚠ NO WAKE LOCK. There is no precedent for that API anywhere in this codebase; it is an explicit
 * fast-follow, not something to add quietly under time pressure.
 *
 * Read + run rides `schedule` — the same grant that already opens Tuesday's practice — so an
 * assistant can run a station without a new capability key. There are no writes on this screen, so
 * there is no write gate to get wrong.
 *
 * ⚠ THE SCREEN ALWAYS OPENS ON THE FIRST STOP, ON ANY DAY (owner, 2026-09-17, P10 revised in the
 * same session). It used to land on whichever stop the planned clock said was running — the same
 * wrong premise as the counter — and, for an hour, remembered the stop and the chosen station per
 * tab (D28). Both went: the field is a plain reader that opens at the top every time, before,
 * during or after the practice, and holds nothing between opens. After a reload the coach taps
 * forward. Nothing about the practice is written (D4).
 *
 * ⚠ EVERYONE GETS BACK / NEXT, HELPERS INCLUDED (the same revision). Phase 4 gave a helper the
 * sentence instead of the buttons because the clock landed them on the right stop and a button
 * that looked like it moved everybody was worse than none. With no clock the buttons are the only
 * way to move, and they only ever move THIS screen — so a helper keeps the line naming who calls
 * the rotation, above the same buttons, and the line says the buttons move their screen only.
 *
 * ⚠ A ROTATION IS ONE LIST, KEYED BY STATION (P7) — `rotationByStation`, the board's own re-key,
 * never the round's cells by group: one row per station with the group letter(s) that are THERE
 * this round, each row the door to that station; "nobody" for a station a hand-arranged round
 * leaves empty; a sitting-out group one line under the list. "Rotate now" shows the next round.
 * The separate Stations list is gone for a rotating stop; a non-rotating block with stations keeps
 * its list on the same row component without the letter column.
 *
 * ⚠ "WHOLE TEAM" (P5) is a SET comparison against the active roster the route already returns,
 * never a count — and a plain block says who runs it (P6): the paper's own staff · players line,
 * under the words, at the support size. Not the eyebrow — that slot is the round's.
 */

type RunData = {
  event: RepTeamEvent;
  plan: PracticePlan | null;
  roster: PracticeRosterPlayer[];
  attendance: { playerId: string; status: RepAttendanceStatus }[];
  /** The 'staff'/'equipment' libraries (mig 266) — resolves a plan's tag ids to current names
   *  for this read-only screen. Optional so a cached response from before this shipped still works. */
  staffTags?: PickableTag[];
  equipmentTags?: PickableTag[];
  /** The reader's own id (mig 303) — with each staff tag's `userId`, what decides "that's you". */
  viewerUserId?: string;
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

/*
 * ⚰ `isViewersStation(staff, viewerName)` — a whole-string, case-insensitive NAME match against the
 * member display name — was DELETED here (COACH_PRACTICE_WHO_RUNS_IT, decision E). "That's you" is
 * now the server's `viewerStationIds`/`viewerBlockIds`: a staff tag that IS this person, by id.
 */

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
   * The cursor: which stop is on screen. Null until the plan arrives, then the remembered stop for
   * this tab (below) or the first. The coach owns it from there — it never moves on its own.
   */
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);

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

  // Resolved to CURRENT tag names for this read-only screen (mig 266) — see
  // `resolvePracticePlanTagNames`. Every display and match below reads `.staff`/`.equipment` off
  // THIS, never off `data.plan` directly, so a station saved under the new picker still shows who's
  // running it instead of a blank line.
  const plan = useMemo(
    () => (data?.plan ? resolvePracticePlanTagNames(data.plan, data.staffTags ?? [], data.equipmentTags ?? []) : null),
    [data],
  );
  const blocks = useMemo(() => plan?.blocks ?? [], [plan]);
  const steps = useMemo(() => buildRunSteps(blocks), [blocks]);

  // Opens on the first stop once the plan arrives — every time, on any day (P10 revised).
  useEffect(() => {
    if (stepIndex === null && steps.length > 0) setStepIndex(0);
  }, [steps, stepIndex]);

  const gridFor = useCallback((block: PracticePlanBlock): RotationGrid | null => {
    if (!blockRotates(block) || !block.rotation) return null;
    return computeRotation(block.rotation, block.stations, block.duration.minutes ?? null);
  }, []);

  /** ⚠ A MAP, not a scan — a rotation round asks for a dozen names, and every tap re-reads them. */
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

  /** Move the cursor. It moves this screen and records nothing (D4 · D26). */
  const go = useCallback((delta: number) => {
    setStepIndex(current => Math.min(steps.length - 1, Math.max(0, (current ?? 0) + delta)));
  }, [steps.length]);

  const rotating = !!block && blockRotates(block);
  // Memoised: `computeRotation` walks groups × rounds and builds the plain-language statements;
  // it needs redoing only when the block on screen changes.
  const grid = useMemo(() => (block ? gridFor(block) : null), [block, gridFor]);
  const staysInBlock = !!nextStep && !!step && nextStep.blockIndex === step.blockIndex;
  const advance: Advance = {
    label: staysInBlock ? 'Rotate now' : 'Next block',
    disabled: !nextStep,
  };

  const stations = useMemo(() => block?.stations ?? [], [block]);
  const openStation = stations.find(s => s.id === stationId) ?? null;
  const openStationIndex = stations.findIndex(s => s.id === stationId);

  // Which station is open — this screen's own state, held for this open only (D28's per-tab
  // memory went with the P10 revision: the field holds nothing between opens).
  const chooseStation = useCallback((id: string | null) => setStationId(id), []);

  /**
   * Everything below re-derives only when the PLAN or the CURSOR moves.
   *
   * ⚠ These live above the render guards on purpose: hooks cannot sit after an early return.
   */
  const attendanceByPlayer = useMemo(
    () => new Map((data?.attendance ?? []).map(a => [a.playerId, a.status])),
    [data?.attendance],
  );
  const attendingCount = useMemo(
    () => (data?.roster ?? []).filter(p => attendanceByPlayer.get(p.id) === 'attending').length,
    [data?.roster, attendanceByPlayer],
  );
  /**
   * Whose block this is — the people and the staff the block itself holds. With no stations the
   * block holds them; with ONE station the station IS the block (the run screen's rule, and
   * `settlePlanLevels` moved the people there); with two or more, the stations hold them and the
   * block's own line says only who runs it.
   */
  // The lib's one rule for whose people these are (`blockOwnPeople`); the staff line reads the same
  // holder — the sole station when the station is the block, else the block.
  const ownPeople = useMemo(() => (block ? blockOwnPeople(block) : undefined), [block]);
  const blockStaff = useMemo(() => (block ? (soleStationOf(block) ?? block).staff ?? [] : []), [block]);
  // "Mine", by IDENTITY (mig 303): the staff tags whose person is the reader, matched by id at
  // every level through the one reader's walk — never a name. The sole-station block reads the
  // station's answer, the same holder the staff line reads.
  const mine = useMemo(() => {
    const me = data?.viewerUserId;
    const mineTags = new Set((data?.staffTags ?? []).filter(t => t.userId != null && t.userId === me).map(t => t.id));
    return levelsForStaffTags(data?.plan, mineTags);
  }, [data?.viewerUserId, data?.staffTags, data?.plan]);
  const mineStations = useMemo(() => new Set(mine.stationIds), [mine]);
  const mineBlocks = useMemo(() => new Set(mine.blockIds), [mine]);
  const blockIsMine = !!block && (mineBlocks.has(block.id) || (!!soleStationOf(block) && mineStations.has(soleStationOf(block)!.id)));
  const blockStaffLine = blockStaff.length > 0 ? `${blockStaff.join(' · ')}${blockIsMine ? ' — that’s you' : ''}` : blockIsMine ? 'that’s you' : '';
  const blockPlayers = useMemo(
    () => (ownPeople ?? []).map(nameOf).filter(Boolean),
    [ownPeople, nameOf],
  );
  // "Whole team" (P5): nobody named, or every active player named — the roster the route handed
  // this screen, compared as a SET (twelve of twelve is the whole team tonight; eleven is chips).
  const wholeTeam = useMemo(
    () => ownPeople !== undefined && namesWholeTeam(ownPeople, (data?.roster ?? []).map(p => p.id)),
    [ownPeople, data?.roster],
  );
  /**
   * The rotation TURNED to its stations (P7) — the board's own re-key, one column per named
   * station — and the row this stop reads: the round on screen (`stepRound` is 1-based). A group
   * the coach arranged to SIT that round out (D14) has no cell; it is named under the list, never
   * left off as if it had been forgotten.
   */
  const stepRound = step?.round ?? null;
  const turned = useMemo(() => (grid && block ? rotationByStation(grid, block.stations) : null), [grid, block]);
  const shownRow = turned && stepRound != null ? turned.rows[stepRound - 1] ?? null : null;

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
          description="The field screen walks through a practice one block at a time — what’s on now, who runs it, and who’s where."
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

  if (!step || !block) return null;

  /**
   * ⚠ A HELPER DOES NOT DRIVE THE PRACTICE (Phase 4, frame H3) — but they do drive their own phone.
   *
   * Everything on this screen is client state and writes nothing (D4), so the buttons are not a
   * permission: "Next block" on a parent volunteer's phone moves that phone. Phase 4 withheld the
   * buttons because the clock landed a helper on the right stop; with the clock gone (P10) the
   * buttons are the only way to move, so everyone has them. What a helper does NOT have is the
   * authority to move the team — so above their buttons a line names who does, and says plainly
   * that these buttons move their screen only. Never a disabled control: a greyed-out "Rotate now"
   * is a screen telling someone off for a thing they were never able to do.
   *
   * `!== false` deliberately: a response cached from before this field existed reads as a coach.
   */
  const isHelper = data?.canAdvance === false;
  const whoAdvances = `${data?.headCoachName?.trim() || 'Your coach'} moves everyone on — these buttons move only your screen.`;

  const actionRow = (
    <>
      {isHelper && <p className={styles.ppRunHandedOff}>{whoAdvances}</p>}
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
    </>
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
          isMine={mineStations.has(openStation.id)}
          nameOf={nameOf}
          onBack={() => chooseStation(null)}
          actions={
            /* The same tap as on the block screen, so a station coach never has to back out to a
               list to move the round on. It moves the screen and records nothing. A helper's line
               sits above it — see `isHelper` above. */
            advance.disabled ? null : (
              <>
                {isHelper && <p className={styles.ppRunHandedOff}>{whoAdvances}</p>}
                <div className={styles.ppRunActions}>
                  <button type="button" className={styles.ppRunPrimary} onClick={() => go(1)}>{advance.label}</button>
                </div>
              </>
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
  const soleStation = soleStationOf(block);
  const { description: stopDescription, goal: stopGoal, coachingPoints: points } =
    resolveStationTeaching(soleStation ?? {}, block);

  /**
   * ONE row, two faces (P7): with `letters` it is the rotation's row — the group letter(s) at this
   * station, two stacked when two share, "nobody" when none — and without them
   * it is the station list's row. Either way the row is the door to that station, and the
   * viewer's own says so. A called function, never a component declared in the render body.
   */
  function renderStationRow(station: PracticeStation, index: number, letters: string[] | null) {
    const mine = mineStations.has(station.id);
    const staffLine = station.staff?.length ? station.staff.join(' · ') : '';
    const meta = `${staffLine}${mine ? `${staffLine ? ' — ' : ''}that’s you` : ''}`;
    return (
      <button
        key={station.id}
        type="button"
        className={styles.ppRunRow}
        data-face={letters ? 'rotation' : 'station'}
        data-mine={mine ? 'mine' : undefined}
        onClick={() => chooseStation(station.id)}
      >
        {letters && (
          <span className={styles.ppRunRowG} data-count={String(Math.min(letters.length, 2))}>
            {letters.length === 0
              ? 'nobody'
              : letters.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{l}</Fragment>)}
          </span>
        )}
        <span>
          <span className={styles.ppRunRowS}>{stationLabel(station, index)}</span>
          {meta && <span className={styles.ppRunRowM}>{meta}</span>}
        </span>
        <span className={styles.ppRunRowGo}>{mine ? 'Open' : 'View'}</span>
      </button>
    );
  }

  // Who is in a plain block (P5): the one word, or the coach's few as chips — null when the block's
  // people live on its stations.
  const people: ReactNode = wholeTeam ? 'Whole team' : blockPlayers.length > 0 ? (
    <span className={styles.ppRunWho}>
      {blockPlayers.map(name => <span key={name} className={styles.ppRunChip}>{name}</span>)}
    </span>
  ) : null;

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
        {/* The plan's length for this stop, as information (P10): "Round 2 of 3 · 10 min a round",
            "15 min", "Rest of practice". Never a countdown — the coach is the clock. */}
        {(step.round != null || runStepLengthLabel(step)) && (
          <p className={styles.ppRunRound}>
            {step.round != null && `Round ${step.round} of ${step.rounds}`}
            {step.round != null && runStepLengthLabel(step) && ' · '}
            {runStepLengthLabel(step)}
          </p>
        )}

        {/* ── A rotation: ONE list keyed by station (P7) — who is at each this round ── */}
        {rotating && grid && turned && step.round != null && (
          <>
            <div className={styles.ppRunList}>
              {stations.map((station, i) => {
                // The row's letters come from the station's COLUMN, found by id — an unnamed station
                // is not a stop in the arithmetic (no column, nobody sent there: "nobody"), but the
                // coach standing at it still needs the door.
                const col = turned.stations.findIndex(s => s.id === station.id);
                return renderStationRow(station, i, (col >= 0 ? shownRow?.cells[col] ?? [] : []).map(shortGroupLabel));
              })}
            </div>
            {shownRow && shownRow.out.length > 0 && (
              <p className={styles.ppRunMeta}>
                {shownRow.out.map((o, i) => (
                  <Fragment key={o.id}>{i > 0 && ' · '}<b>{shortGroupLabel(o.name)}</b> sits round {shownRow.round} out</Fragment>
                ))}
              </p>
            )}
            {blockStaffLine && (
              <p className={styles.ppRunMeta}><b>{blockStaffLine}</b></p>
            )}
          </>
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
            {/* Who runs it · who is in it (P5 · P6): "UAT Coach · Whole team", or the coach's few
                as chips. One quiet line under the words; a block whose people live on its stations
                says only who runs it. */}
            {(blockStaffLine || people) && (
              <div className={styles.ppRunMeta}>
                {blockStaffLine && <b>{blockStaffLine}</b>}
                {blockStaffLine && people && ' · '}
                {people}
              </div>
            )}
          </>
        )}

        {/* ── The station list on a NON-rotating stop (D28): the same row, no letter column. Yours
            is picked out because you're tagged on it. ── */}
        {step.round == null && stations.length > 0 && (
          <div className={styles.ppRunStations}>
            <p className={styles.ppRunStationsLbl}>Stations</p>
            {stations.map((station, i) => renderStationRow(station, i, null))}
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
