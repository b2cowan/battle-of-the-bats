'use client';
import { Fragment, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useBackStep } from '@/components/coaches/useBackStep';
import HelpButton from '@/components/help/HelpButton';
import { playerDisplayName } from '@/lib/coach-roster-name';
import {
  blockOwnPeople, blockRotates, buildRunOutline, buildRunSteps, computeRotation, formatDuration,
  levelsForStaffTags, namesWholeTeam, resolvePracticePlanTagNames,
  rotationByStation, runStepLengthLabel, soleStationOf, stationLabel,
  type PracticePlan, type PracticePlanBlock, type PracticeStation, type RotationGrid, type RunStep,
} from '@/lib/rep-practice-plan';
import PracticeStationView, { StationLines } from '../../_PracticeStationView';
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
 * never **done**. (The last stop's "Done" button — owner, 2026-09-25 — is the COACH finishing, an
 * imperative, not a claim that the practice ran: it writes nothing and lands on "How it went".)
 *
 * ⚠ NO SWIPE, NO DRAG, NO LONG-PRESS. Buttons, every one 56px. Re-asked as a swipe between
 * stops and CLOSED (practice plans on a phone, stage 3 · M3, owner 2026-09-25), on these grounds —
 * gloves are NOT one of them for a swipe (it is the least precise gesture there is; they do defeat
 * a drag and a long-press): the phone's own back gesture goes UP ONE LEVEL here (below), so a swipe
 * from the left edge is the list while the same swipe a thumb's width in would be the previous stop;
 * on Android the right edge is Back too, so a "next" swipe near it would leave the stop; on a
 * station "next" means two things (the next station, the next round); a button says what will
 * happen ("Rotate now" stays in the block, the block arrow leaves it) and a swipe does not; and
 * with the buttons under the thumb a swipe saves no taps.
 *
 * ⚠ ON A PHONE, RUN PRACTICE IS A FULL SCREEN OF ITS OWN (practice plans on a phone, stage 3b · M5,
 * owner 2026-09-25 — "if anything during a run you want to avoid navigating away by mistake"). The
 * block sheet's construction (`FieldScreen`): a pinned head, a body that scrolls, its own foot, over
 * the team line and the tab bar — and registered with the portal's overlay signal, so the tab bar
 * hides and the page behind stops scrolling. The run keeps nothing between opens (P10), so a stray
 * tab tap did not just go somewhere else: it threw the coach's place away. The list's "← Plan" is the
 * way out. It retired stage 3's bar pinned above the tab bar (M1), and the three pieces that held it
 * there. A computer and the 641–768 band keep the page, with Back / Next under the words.
 * ⚠ ITS FOOT IS THE BLOCK STEPPER (M6, `RunFoot`): "‹ Block 2 of 4 ›" on every stop and station —
 * › skips to the next block even mid-rotation, ‹ from the first block is the list, and the last
 * block's › is "Done" (back to the plan) — with a round row above it in a rotation: Rotate now, and from
 * round 2 a LABELLED "‹ Round 1" (a bare ‹ over the block's ‹ was two identical arrows moving
 * different things). A button with nowhere to go is ABSENT, never greyed; the ink one is the one
 * you'll tap next. EACH BLOCK REMEMBERS ITS ROUND WHILE THE RUN IS OPEN (`lastStopOf`), so a › by
 * mistake is undone by one ‹, on the round — and the station — the coach left.
 * ⚠ AND THE BROWSER'S OWN BACK GESTURE GOES UP ONE LEVEL, THE SAME LEVEL THE BUTTONS DO (owner,
 * 2026-09-21 — "if I am in a station and I do a swipe back like most people do on phones it takes
 * me out of the practice rather than back to the drill"). A stop stands one history entry behind
 * the list and a station one behind its stop (`useBackStep`): Back from a station is the stop,
 * from a stop the list, from the list the plan — exactly what "← Blocks" and the station's own
 * back make. Nothing is an address and nothing survives a reload; the field still holds nothing
 * between opens.
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
 * ⚠ THE SCREEN OPENS ON THE PLAN AS A LIST, ON ANY DAY (practices re-evaluation stage 7, owner
 * ruling W1–W4, 2026-09-18). P10's revision said Run practice "should always land on the initial
 * run practice page", and for a day that was built as block 1 — but there never was a first
 * screen: the field opened on one block and moved with Back / Next, so a coach opening the phone
 * during the circuit read the warm-up and tapped forward, and a helper looking for their station
 * tapped Next and then a row. Without a clock the screen cannot guess where you are; with a list
 * it does not have to. The list (`buildRunOutline`): one row per block in order — number, name,
 * who runs it, the plan's LENGTH on the right (W2: "15 min", never a planned clock) — a block's
 * stations as rows beneath it (W3), every row a door (a block row → that block at its first stop,
 * or the round it was left on while the run is open — stage 3b; a station row → the same stop with
 * that station open), and "that's you" on the reader's own
 * rows from the same identity walk the block screen reads. On a block, "← Blocks" goes back to
 * the list (W4); the plan's door is on the list's bar; the last block still ends at the plan.
 *
 * It used to land on whichever stop the planned clock said was running — the same wrong premise
 * as the counter — and, for an hour, remembered the stop and the chosen station per tab (D28).
 * Both went with P10: the field is a plain reader that opens at the top every time, before, during
 * or after the practice, and holds nothing between opens. Nothing about the practice is written (D4).
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
  // ≤640 — the full screen and its block stepper (stage 3b). The run renders after its fetch, on the
  // client, so the answer is the real one by the time anything below is drawn.
  const phone = useIsPhone();
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
   * The cursor: which stop is on screen. NULL IS THE LIST — the field's first screen (stage 7,
   * W1) — and the coach picks a stop from it. The coach owns the cursor from there: it never
   * moves on its own, and Back from the first stop returns to the list.
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
  /* ⚰ The effect that set the cursor to 0 once the plan arrived is DELETED (stage 7, W1): the
     screen opens on the list, every time, on any day, and the coach picks the stop. */

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

  // The list is on screen while the cursor is null (W1); a stop otherwise.
  const onList = stepIndex === null;
  const index = Math.min(Math.max(stepIndex ?? 0, 0), Math.max(steps.length - 1, 0));
  const step: RunStep | null = onList ? null : steps[index] ?? null;
  const nextStep: RunStep | null = onList ? null : steps[index + 1] ?? null;
  const block = step ? blocks[step.blockIndex] ?? null : null;

  /** Move the cursor. It moves this screen and records nothing (D4 · D26). Back off the first
   *  stop returns to the list — each screen's Back goes one level up (W4). */
  const go = useCallback((delta: number) => {
    setStepIndex(current => {
      const next = (current ?? 0) + delta;
      return next < 0 ? null : Math.min(steps.length - 1, next);
    });
  }, [steps.length]);

  /**
   * A BLOCK REMEMBERS ITS ROUND WHILE THE RUN IS OPEN (stage 3b · M6, owner 2026-09-25): the stop
   * each block was last on. A block is entered there — by the phone's block arrows and by the list's
   * rows — so a › tapped by mistake is undone by one ‹, back on the round the coach left. A ref, not
   * state: nothing renders from it. It lives for this open only, like the cursor: nothing is written
   * (D4) and nothing survives a reload (P10).
   */
  const lastStopOf = useRef(new Map<number, number>());
  const stopFor = useCallback((blockIndex: number) => (
    lastStopOf.current.get(blockIndex) ?? Math.max(0, steps.findIndex(s => s.blockIndex === blockIndex))
  ), [steps]);

  /** A row on the list: open this block — with one of its stations open, when a station row. */
  const openBlock = useCallback((blockIndex: number, station: string | null) => {
    setStepIndex(stopFor(blockIndex));
    setStationId(station);
  }, [stopFor]);

  /** "← Blocks" — back to the list from a stop (W4). */
  const toList = useCallback(() => {
    setStepIndex(null);
    setStationId(null);
  }, []);

  // Every stop the cursor lands on is the one its block comes back to.
  useEffect(() => {
    if (step) lastStopOf.current.set(step.blockIndex, index);
  }, [step, index]);

  /** The phone's block arrows (M6): a neighbouring block, on the stop it was left on; ‹ from the first
   *  block is the list. The chosen station is kept — a block without it shows its stop, and the ‹ that
   *  comes back reopens it. */
  const goBlock = useCallback((delta: -1 | 1) => {
    if (!step) return;
    const target = step.blockIndex + delta;
    if (target < 0) toList();
    else if (target < blocks.length) setStepIndex(stopFor(target));
  }, [step, blocks.length, toList, stopFor]);


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

  // Back goes up one level — see the header. The station's step reads the station ON SCREEN, not
  // the chosen id: "Next block" from inside a station leaves the id pointing at a station the new
  // block does not have, and a level that is not on screen is not a level Back can go up from.
  useBackStep(!onList, toList);
  useBackStep(openStation !== null, () => chooseStation(null));

  /**
   * EVERY TAP OPENS ITS SCREEN AT THE TOP (practice plans on a phone, stage 3 · M1, owner 2026-09-25).
   * The list, a stop, a round and a station are one page re-rendered in place, so the browser kept
   * the scroll: a coach who scrolled down to Rotate now on a long station landed on the next round
   * 382px down, with "With you now" — the one line that changed — 203px above the screen (measured).
   * Before paint, so no frame ever shows the old position; every width alike. On a phone the thing
   * that scrolls is the full screen's body (stage 3b), not the window.
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const top = { top: 0, left: 0, behavior: 'instant' } as const;
    if (scrollRef.current) scrollRef.current.scrollTo(top);
    else window.scrollTo(top);
  }, [stepIndex, stationId]);

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
  const mineTags = useMemo(() => {
    const me = data?.viewerUserId;
    return new Set((data?.staffTags ?? []).filter(t => t.userId != null && t.userId === me).map(t => t.id));
  }, [data?.viewerUserId, data?.staffTags]);
  const mine = useMemo(() => levelsForStaffTags(data?.plan, mineTags), [data?.plan, mineTags]);
  const mineStations = useMemo(() => new Set(mine.stationIds), [mine]);
  const mineBlocks = useMemo(() => new Set(mine.blockIds), [mine]);
  // The list's rows (W1–W3) — the RESOLVED plan, so a row's staff line reads current tag names
  // like every other line on this screen; "mine" from the same walk as the sets above.
  const outline = useMemo(() => buildRunOutline(plan, steps, mineTags), [plan, steps, mineTags]);
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

  const practiceName = data?.event.name?.trim() || 'Practice';
  // The frame every run screen shares — see `FieldScreen`. Loading is drawn in it too, so a phone
  // does not flash the tab bar up for the length of the fetch.
  const frame = (children: ReactNode, foot?: ReactNode) => (
    <FieldScreen phone={phone} label={data ? `Run practice — ${practiceName}` : 'Run practice'} foot={foot} scrollRef={scrollRef}>
      {children}
    </FieldScreen>
  );

  // ⚠ An error and an empty plan stay ORDINARY pages, deliberately: there is no run to protect, and
  // the coach's next move is to leave (the plan, the tabs) — covering the app there would only hide
  // the way out.
  if (loading) return frame(<>{backToPlan}<div className={styles.loadingState}>Loading practice…</div></>);
  if (loadError) return <div className={styles.page}>{backToPlan}<p className={styles.errorText}>{loadError}</p></div>;

  if (blocks.length === 0) {
    return (
      <div className={styles.page}>
        {backToPlan}
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={22} />}
          headline="There’s no plan to run yet"
          description="The field screen lists the blocks of a practice and walks through them one at a time. This practice doesn’t have any yet."
          secondaryAction={{ href: planHref, label: 'Open the plan' }}
        />
      </div>
    );
  }

  const helpButton = <HelpButton iconOnly label="Running a practice" help={runHelpRequest} />;

  /* ── D8 — who's here tonight. Read-only, folded shut, already true. On the list and on every
     stop alike: the one field-time write a coach reliably finishes is one tap from anywhere. ── */
  const attendanceFold = data?.canViewAttendance && (data?.roster.length ?? 0) > 0 ? (
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
  ) : null;

  /* ── THE LIST — the field's first screen (stage 7, W1–W3) ──
     The practice's name, its goal if the plan has one, then one row per block on the station
     list's own recipe: the number where the group letter goes, the name, the rotation's shape
     and who runs it beneath, the plan's length on the right — never a clock (W2). A block's
     stations follow as rows under it (W3), each a door to that station. The reader's own rows
     say "that's you" from the same walk the stops read. No big button: the rows are the doors and
     each stands 56 (a station row 44). Nothing here is remembered between opens. */
  if (onList) {
    const rosterIds = (data?.roster ?? []).map(p => p.id);
    return frame(
      <>
        <div className={styles.ppRunPage} data-field-floor>
          <div className={styles.ppRunBar}>
            <Link href={planHref} className={styles.ppRunBackLink}>
              <ArrowLeft size={13} aria-hidden /> Plan
            </Link>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <b>{blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}</b>
              {helpButton}
            </span>
          </div>

          <h1 className={styles.ppRunTitle}>{data?.event.name?.trim() || 'Practice'}</h1>
          {plan?.goal?.trim() && <p className={styles.ppRunGoal}>{plan.goal.trim()}</p>}

          <div className={styles.ppRunOutline} data-testid="run-outline">
            {outline.map(row => {
              // Who runs it — the holder the stop's own staff line reads (the sole station when the
              // station is the block); with nobody named, the block's people word (P5).
              const holder = soleStationOf(row.block) ?? row.block;
              const staffLine = holder.staff?.length ? holder.staff.join(' · ') : '';
              const own = blockOwnPeople(row.block);
              const peopleWord = own === undefined ? '' : namesWholeTeam(own, rosterIds) ? 'Whole team' : own.length > 0 ? `${own.length} players` : '';
              const who = staffLine || peopleWord;
              const meta = `${who}${row.mine ? `${who ? ' — ' : ''}that’s you` : ''}`;
              return (
                <Fragment key={row.block.id}>
                  <button
                    type="button"
                    className={styles.ppRunRow}
                    data-face="block"
                    data-mine={row.mine ? 'mine' : undefined}
                    onClick={() => openBlock(row.index, null)}
                  >
                    <span className={styles.ppRunRowG}>{row.index + 1}</span>
                    <span>
                      <span className={styles.ppRunRowS}>{row.title}</span>
                      {row.shape && <span className={styles.ppRunRowM}>{row.shape}</span>}
                      {meta && <span className={styles.ppRunRowM}>{meta}</span>}
                    </span>
                    <span className={styles.ppRunRowLen}>
                      {row.length}
                      <ChevronRight size={18} aria-hidden />
                    </span>
                  </button>
                  {row.stations.length > 0 && (
                    <div className={styles.ppRunOutlineStations}>
                      {row.stations.map(s => {
                        const line = s.station.staff?.length ? s.station.staff.join(' · ') : '';
                        const stationMeta = `${line}${s.mine ? `${line ? ' — ' : ''}that’s you` : ''}`;
                        return (
                          <button
                            key={s.station.id}
                            type="button"
                            className={styles.ppRunRow}
                            data-face="station"
                            data-mine={s.mine ? 'mine' : undefined}
                            onClick={() => openBlock(row.index, s.station.id)}
                          >
                            <span>
                              <span className={styles.ppRunRowS}>{s.label}</span>
                              {stationMeta && <span className={styles.ppRunRowM}>{stationMeta}</span>}
                            </span>
                            <span className={styles.ppRunRowGo}><ChevronRight size={18} aria-hidden /></span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          {attendanceFold}
        </div>
      </>,
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

  const helperLine = isHelper ? <p className={styles.ppRunHandedOff}>{whoAdvances}</p> : null;
  /* A computer's buttons, under the words — unchanged by stage 3b; on a phone the foot moves the run
     (`RunFoot`) and only the helper's line stays with the words. */
  const actionRow = phone ? helperLine : (
    <>
      {helperLine}
      <div className={styles.ppRunActions}>
        {/* Never disabled: from the first stop, Back is the list (W4). */}
        <button type="button" className={styles.ppRunSecondary} onClick={() => go(-1)}>
          Back
        </button>
        {/* The last stop still ends at the plan — the practice is over and "How it went" is there.
            "Done" (owner, 2026-09-25 — "more of an indication the practice has reached its conclusion"):
            the coach finishing, never a claim the practice ran — it writes nothing (D4), and the one
            thing that IS written about the night, "How it went", is where it lands. Named for a screen
            reader by where it goes; the one word on a phone and a computer alike. */}
        {advance.disabled ? (
          <Link href={planHref} className={styles.ppRunPrimary} aria-label="Done — back to the plan">Done</Link>
        ) : (
          <button type="button" className={styles.ppRunPrimary} onClick={() => go(1)}>{advance.label}</button>
        )}
      </div>
    </>
  );
  const foot = phone ? <RunFoot step={step} blocks={blocks} planHref={planHref} onBlock={goBlock} onRound={go} /> : null;

  if (openStation) {
    return frame(
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
        /* THE STOP'S OWN MOVES (stage 3, owner 2026-09-25), so a round moved on by accident is one
           tap back — on a phone the foot's "‹ Round 1" (stage 3b), on a computer Back beside Rotate
           now. `go` never touches `stationId`, so going back a round keeps this station open. On a
           computer, with no earlier round (round 1, or a station of a block that doesn't rotate)
           Back is the previous STOP, exactly as on the stop: the station closes, and Next block from
           there reopens it; from the very first stop it is the list, whose rows reset the station.
           It moves the screen and records nothing (D4). */
        actions={actionRow}
      />,
      foot,
    );
  }

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
  /** A lone station whose name the block's title doesn't already say — see the station list below. */
  const sole = soleStationOf(block);
  const soleNameSaysMore = !!sole && !!sole.name.trim() && !!block.title.trim() && sole.name.trim() !== block.title.trim();

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

  return frame(
    <>
      {/* data-field-floor (owner 2026-09-20, stage 0 · A4): the field's screen is read standing up —
          nothing under 12px inside; the sweep's `field-floor` rule holds it. */}
      <div className={styles.ppRunPage} data-field-floor>
        <div className={styles.ppRunBar}>
          {/* "← Blocks" — one level up is the list, not the plan (W4); the plan's door is on the
              list's own bar. A button: it moves this screen and records nothing. */}
          <button type="button" className={styles.ppRunBackLink} onClick={toList}>
            <ArrowLeft size={13} aria-hidden /> Blocks
          </button>
          {/* Help stays in the 0.7rem chrome line, never in the body — at arm's length in the sun
              there is room for exactly one idea, and it isn't this one. On a phone the block's
              place is the foot's ("Block 2 of 4"), so the head does not say it twice. */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            {!phone && <b>{step.blockIndex + 1} of {blocks.length}</b>}
            {helpButton}
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
            {/* A STOP READS LIKE A STATION (practice plans on a phone, stage 3 · M2 · M4, owner
                2026-09-25): the station's own lines in its one order (`StationLines`). ⚠ A block
                built by picking ONE drill holds its words, setup, kit and note on the STATION — with
                one station the station IS the block (D1), so it is passed through; reading the block
                alone showed a blank screen for exactly the block a coach assembled in four taps, and
                the stop used to leave the setup, kit and note out and offer the station as a one-row
                "Stations" list instead (below: that list now needs two). With two or more stations
                they differ from each other, so the block keeps its own words. A written block's own
                kit is not on the stop — as before; not ruled. */}
            <StationLines station={sole} block={block} />
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
            is picked out because you're tagged on it. Two or more — a sole station is the block,
            and its lines are the stop's own (above) — UNLESS the lone station's NAME says what the
            block's title doesn't ("Ladder" on "Skills", the rule `collapseSoleStation` keeps it
            for): then its row stays, the one place that name is on the field (/review 2026-09-25). ── */}
        {step.round == null && (stations.length > 1 || soleNameSaysMore) && (
          <div className={styles.ppRunStations}>
            <p className={styles.ppRunStationsLbl}>Stations</p>
            {stations.map((station, i) => renderStationRow(station, i, null))}
          </div>
        )}

        <p className={styles.ppRunNext}>{upNext}</p>

        {actionRow}

        {/* D8 — who's here tonight, the same fold the list carries. After the buttons, as it always
            was — so a computer never finds its buttons under an opened roster (/review 2026-09-25);
            on a phone the buttons are the screen's foot and this is the words' last line. */}
        {attendanceFold}
      </div>
    </>,
    foot,
  );
}

/**
 * THE FIELD'S FRAME (stage 3b · M5 — the header has the why). On a phone, a full screen of its own
 * over the app, as the block sheet is: the page's head pins in its scroller (the stylesheet) and the
 * foot sits below it, never over the words; everywhere else, the ordinary page.
 *
 * ⚠ ONE INSTANCE for the whole run. Every screen returns it at the page's root, so the list, a stop
 * and a station are the same element re-rendered — moving between them never unregisters the overlay,
 * which would flash the tab bar back for a frame.
 * ⚠ `aria-modal`, as the block sheet wears it: what is under it is covered, and the layout sweep
 * measures the topmost modal alone — without it a fixed full-screen surface reads to the sweep as
 * chrome standing over every word on the page.
 */
function FieldScreen({ phone, label, foot, scrollRef, children }: {
  phone: boolean;
  label: string;
  foot?: ReactNode;
  scrollRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  useOverlayOpen(phone);
  if (!phone) return <div className={styles.page}>{children}</div>;
  return (
    <div className={styles.ppRunScreen} role="dialog" aria-modal="true" aria-label={label} data-field-floor>
      <div ref={scrollRef} className={styles.ppRunScroll} data-run-scroll>{children}</div>
      {foot && <div className={styles.ppRunFoot}>{foot}</div>}
    </div>
  );
}

/**
 * THE PHONE'S FOOT (stage 3b · M6, owner 2026-09-25) — the block sheet's stepper, at the field's
 * 56px, in two rows only when there are rounds to move through:
 *   · rounds (a rotating block) — Rotate now, and from round 2 a LABELLED "‹ Round 1": the owner's
 *     back-a-round (stage 3) needs a home once the arrows move between blocks, and a bare ‹ stacked
 *     over the block's ‹ was two identical arrows moving different things (the first drawing);
 *   · blocks, always — "‹ Block 2 of 4 ›". › skips to the next block even mid-rotation (running
 *     late); ‹ from the first block is the list; the last block's › is "Done", back to the plan
 *     where the practice ends (a computer's last stop says the same — see the action row).
 * A button with nowhere to go is ABSENT, never greyed (no back on round 1 — Rotate now takes the row;
 * no Rotate now on the last round). The INK control is the one you'll tap next: › on a plain block,
 * Rotate now in a rotation, › again on the last round. Not `RoomWalkNav`, deliberately: that stepper
 * greys its ends, sits at 44px, and its ‹ at the first record has nowhere to go — here it has the list.
 */
function RunFoot({ step, blocks, planHref, onBlock, onRound }: {
  step: RunStep;
  /** The plan's blocks — the count, and the neighbours' titles for the arrows' spoken names. */
  blocks: readonly PracticePlanBlock[];
  planHref: string;
  onBlock: (delta: -1 | 1) => void;
  onRound: (delta: -1 | 1) => void;
}) {
  const { round, rounds, blockIndex } = step;
  const lastRound = round == null || round >= rounds;
  const ink = lastRound ? '' : undefined;
  // The neighbour's title as the list shows it; null at the ends.
  const titleOf = (i: number) => blocks[i]?.title.trim() || `Block ${i + 1}`;
  const prevTitle = blockIndex > 0 ? titleOf(blockIndex - 1) : null;
  const nextTitle = blockIndex < blocks.length - 1 ? titleOf(blockIndex + 1) : null;
  return (
    <>
      {round != null && (
        <div className={styles.ppRunFootRow}>
          {round > 1 && (
            <button type="button" className={`${styles.ppRunSecondary} ${styles.ppRunRoundBack}`}
              aria-label={`Back to round ${round - 1}`} onClick={() => onRound(-1)}>
              <ChevronLeft size={18} aria-hidden /> Round {round - 1}
            </button>
          )}
          {lastRound
            ? <p className={styles.ppRunFootNote}>Last round</p>
            : <button type="button" className={styles.ppRunPrimary} onClick={() => onRound(1)}>Rotate now</button>}
        </div>
      )}
      <nav className={styles.ppRunFootRow} aria-label="Blocks">
        <button type="button" className={styles.ppRunArrow}
          aria-label={prevTitle ? `Previous block: ${prevTitle}` : 'Back to the list'} onClick={() => onBlock(-1)}>
          <ChevronLeft size={24} aria-hidden />
        </button>
        <span className={styles.ppRunCount}>Block {blockIndex + 1} of {blocks.length}</span>
        {nextTitle ? (
          <button type="button" className={styles.ppRunArrow} data-ink={ink}
            aria-label={`Next block: ${nextTitle}`} onClick={() => onBlock(1)}>
            <ChevronRight size={24} aria-hidden />
          </button>
        ) : (
          <Link href={planHref} className={styles.ppRunEnd} data-ink={ink} aria-label="Done — back to the plan">Done</Link>
        )}
      </nav>
    </>
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
