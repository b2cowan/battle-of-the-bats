'use client';
import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Printer, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useFocusTags } from '@/components/coaches/use-focus-tags';
import { playerDevelopmentHref, developmentHandoutHref, type DevelopmentAddress, type DevelopmentView } from '@/lib/development-address';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './PlayerDevelopment.module.css';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import Sparkline from '@/components/charts/Sparkline';
import {
  splitSeriesByUnit, drawableSegment, unitSplitNote, groupBySession, latestSessionResult, headlineLabel, headlineLead, rangeSign, planResultEdit,
  type SessionResult,
} from '@/lib/measurable-series';
import { activeMeasuredTests, measuredTestsWithHistory } from '@/lib/measurable-definition';
import { goalTimeline, originSentence, GOAL_STATUS_LABELS, type GoalEvent } from '@/lib/development-goal-history';
import ContinuityCompareCard from '@/components/coaches/ContinuityCompareCard';
import TryoutSnapshotCard from '@/components/coaches/TryoutSnapshotCard';
import ReviewGoalDialog from '@/components/coaches/ReviewGoalDialog';
import RecordObservationDialog from '@/components/coaches/RecordObservationDialog';
import RecordResultSheet, { type ResultSheetValues } from '@/components/coaches/RecordResultSheet';
import GoalSheet, { type GoalSheetValues } from '@/components/coaches/GoalSheet';
import { GOAL_STATUSES } from '@/lib/development-input';
import { REMOVE_OBSERVATION_CONFIRM, fixedObservation, patchObservation, deleteObservation as deleteObservationRecord } from '@/components/coaches/observation-sheet-host';
import { splitTypedName } from '@/lib/coach-roster-name';
import { useContinuityLinks } from '@/lib/hooks/useContinuityLinks';
import { formatValue, todayLocal, formatShortDate, formatShortInstant } from '@/lib/measurable-format';
import type {
  RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerDevelopmentGoal, RepDevelopmentGoalStatus,
  RepTryoutBaselineSnapshot, RepPlayerObservation, RepDevelopmentGoalReview,
} from '@/lib/types';

/** One confirmed prior season, display-ready (3D archive — a dated record, never deltas). */
interface ArchiveSeason {
  priorRosterId: string;
  seasonLabel: string;
  goals: { focusArea: string; status: string; note: string | null }[];
  tests: { name: string; entries: { value: number; unit: string; recordedOn: string; note: string | null }[] }[];
  attendancePct: number | null;
}

interface DevelopmentData {
  canWrite: boolean;
  /** The grant WITH Internal notes — goals, observations, reviews (and the carry offer) draw on this; results on `canWrite`. */
  canWriteGoals: boolean;
  showGoals: boolean;
  showMeasurables: boolean;
  types: RepTeamMeasurableType[];
  measurables: RepPlayerMeasurable[];
  goals: RepPlayerDevelopmentGoal[];
  observations: RepPlayerObservation[];
  reviews: RepDevelopmentGoalReview[];
  /** user id → display name, for "entered by" / "written by". */
  authors: Record<string, string>;
  archive: ArchiveSeason[];
  carry: { linkId: string; priorRosterId: string; priorSeasonLabel: string; workingCount: number } | null;
  /**
   * The frozen tryout snapshot, when this player was seeded from a tryout (Phase 2, R4).
   * ⚠ Null for everyone else, AND null for any coach without the tryouts capability — the server
   * decides that, not this component. It renders ABOVE the goals and never joins a trend.
   */
  tryoutBaseline: RepTryoutBaselineSnapshot | null;
}

interface Props {
  orgSlug: string;
  teamId: string;
  playerId: string;
  /** The player's name — the sheets' titles and the never-run caption say it. */
  playerName: string;
  /** The address the coach arrived on (view · metric · goal · observation · the fold · the way back) — parsed once by the page. */
  arrival: DevelopmentAddress;
  /** Called once the addressed row has been opened and flashed, so a remount does not do it again. */
  onArrived: () => void;
}

type ResultGroup = SessionResult<RepPlayerMeasurable>;
/** `openGoalId`'s third state: the coach shut the row that would otherwise open by itself (E3). */
const NO_GOAL_OPEN = 'none' as const;

/**
 * ═══ THE PLAYER'S SKILLS & GOALS TAB — two views and a fold (development lifecycle re-evaluation
 * stage 3 · Player, owner rulings E1–E8, 2026-09-15) ═══
 * Goals · Results as ONE segmented control with the handout door beside it; the goal row IS the
 * panel (it opens in place — the facts, the three actions, the history); the status pill is a PICK,
 * never a cycle; an observation's home is the Notes tab and every door to one opens the same sheet;
 * Results is a table on the list recipe whose rows open to their dated rows; a bench-side result is
 * a SHEET that records what a session records (up to five attempts on a date, one headline); and
 * Previous seasons is a shut fold at the tab's foot, titled by the season's name, absent when there
 * is none. The continuity card and the carry-forward offer sit ABOVE the views (prompts, not
 * records); the tryout snapshot heads Goals (it is what the goals were chosen from). Phase 2's
 * Observations and Previous seasons VIEWS are gone; their addresses land on the home.
 */
export default function PlayerDevelopmentSection({
  orgSlug, teamId, playerId, playerName, arrival, onArrived,
}: Props) {
  const router = useRouter();
  const portalBase = `/${orgSlug}/coaches/teams/${teamId}`;
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/development`;
  const confirm = useConfirm();
  const firstName = splitTypedName(playerName).first || playerName;

  const [data, setData] = useState<DevelopmentData | null>(null);
  const [error, setError] = useState('');

  // ── the view (the address module's `view`; the segmented control writes it back to the URL) ──
  const [view, setView] = useState<DevelopmentView | null>(arrival.view);
  function chooseView(next: DevelopmentView) {
    setView(next);
    router.replace(playerDevelopmentHref(portalBase, playerId, { view: next, returnTo: arrival.returnTo }), { scroll: false });
  }

  // ── goals ──
  const [goalSheet, setGoalSheet] = useState<{ editing: RepPlayerDevelopmentGoal | null } | null>(null);
  const [goalErr, setGoalErr] = useState('');
  // Fetched only once the read says goals are shown here — a results-only coach never pays for it.
  const { tags: focusTags, createTag: createFocusTag, reload: reloadFocusTags } = useFocusTags(orgSlug, teamId, { skipFetch: !data?.showGoals });
  const focusTagById = useMemo(() => new Map(focusTags.map(t => [t.id, t])), [focusTags]);
  // ONE goal open at a time (E3): the goal the address named, else the only goal, else none.
  const [openGoalId, setOpenGoalId] = useState<string | typeof NO_GOAL_OPEN | null>(arrival.goalId);
  const [openStatusKey, setOpenStatusKey] = useState<string | null>(null);
  const [reviewingGoal, setReviewingGoal] = useState<RepPlayerDevelopmentGoal | null>(null);
  const [reviewErr, setReviewErr] = useState('');
  const [busy, setBusy] = useState(false);

  // ── observations — one sheet from every door (E2) ──
  const [obsDialog, setObsDialog] = useState<{ editing: RepPlayerObservation | null; goalId: string | null } | null>(null);
  const [obsErr, setObsErr] = useState('');

  // ── results — the bench-side sheet (E7) ──
  const [resultSheet, setResultSheet] = useState<{ editing: { row: ResultGroup; type: RepTeamMeasurableType } | null } | null>(null);
  const [resultErr, setResultErr] = useState('');
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(arrival.view === 'results' ? arrival.metricId : null);

  // ── 3D: previous-seasons archive (the fold) + the one-time carry-forward offer ──
  const [expandedSeasonId, setExpandedSeasonId] = useState<string | null>(null);
  const [carryBusy, setCarryBusy] = useState(false);
  const [carryErr, setCarryErr] = useState('');

  const {
    byCurrent: continuityByCurrent, decide: decideContinuity, dismiss: dismissContinuity,
    busy: continuityBusy, error: continuityErr,
  } = useContinuityLinks(
    data?.canWrite ? `/api/coaches/${orgSlug}/teams/${teamId}/development/continuity` : null,
    'roster',
    playerId,
  );
  const continuity = continuityByCurrent[playerId] ?? [];
  // Sequenced like the session screen's: every status pick re-reads, and two in quick succession
  // can resolve out of order — the OLDER read must never land over the newer one.
  const loadSeqRef = useRef(0);
  const load = useCallback(async (): Promise<DevelopmentData | null> => {
    const seq = ++loadSeqRef.current;
    try {
      const res = await fetch(base);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load development — try again.');
      if (seq !== loadSeqRef.current) return null;
      setData(json);
      setError('');
      return json as DevelopmentData;
    } catch (e) {
      if (seq !== loadSeqRef.current) return null;
      setError(e instanceof Error ? e.message : 'Could not load development — try again.');
      return null;
    }
  }, [base]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  /**
   * Derived once per data load, not per render: this component re-renders on every sheet keystroke
   * (busy flags, drafts), and regrouping every attempt into result rows each time is wasted work.
   * Results rows are in library order (roster-order principle: stable, never sorted by result), the
   * RETIRED tests last (E6); each test's attempts become ONE row per session — or per bench-side
   * DAY (E7) — through the one home (`groupBySession`). F01: the line is drawn from the CURRENT
   * unit's run of result rows only; every attempt stays in the opened list beneath.
   */
  const derived = useMemo(() => {
    const entriesByType = new Map<string, RepPlayerMeasurable[]>();
    for (const e of data?.measurables ?? []) {
      const list = entriesByType.get(e.measurableTypeId) ?? [];
      list.push(e);
      entriesByType.set(e.measurableTypeId, list);
    }
    const typeRows = measuredTestsWithHistory(data?.types ?? [], id => entriesByType.has(id))
      .map(t => {
        const sessions = groupBySession(entriesByType.get(t.id) ?? [], t);
        const segments = splitSeriesByUnit(sessions);
        const drawable = drawableSegment(segments);
        return {
          type: t, sessions, latest: latestSessionResult(sessions),
          chronoDrawable: drawable ? drawable.readings.map(r => r.value) : [],
          splitNote: unitSplitNote(segments),
        };
      })
      .filter(r => r.sessions.length > 0)
      .sort((a, b) => Number(!a.type.isActive) - Number(!b.type.isActive));
    // A test the library holds that this player has never run is a caption, not a row (E6).
    const neverRun = activeMeasuredTests(data?.types ?? []).filter(t => !entriesByType.has(t.id));
    return {
      typeRows,
      neverRun,
      skillById: new Map((data?.types ?? []).map(t => [t.id, t])),
    };
  }, [data]);

  /**
   * The arrival address (Phase 1, F09): `?section=development` opens this tab (the page's job);
   * `view` + `metric` / `goal` say WHICH row the link meant, and it is opened and flashed ONCE on
   * arrival; `observation` opens that record's sheet (E2); an old `view=archive` opens the fold
   * (E1). The page owns the address and `onArrived` clears it, because this section remounts on a
   * tab switch and must not run the arrival again on the same address.
   */
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const rowId = arrival.view === 'results' && arrival.metricId ? `dev-metric-${arrival.metricId}`
      : arrival.view === 'goals' && arrival.goalId ? `dev-goal-${arrival.goalId}`
      : arrival.archive && data.archive[0] ? `dev-archive-${data.archive[0].priorRosterId}` : null;
    const observation = arrival.observationId ? data.observations.find(o => o.id === arrival.observationId) ?? null : null;
    const archiveId = arrival.archive && data.archive[0] ? data.archive[0].priorRosterId : null;
    if (!rowId && !observation) {
      // An address that named something the record no longer holds (a deleted goal or observation,
      // a season since unlinked) is still consumed once — nothing to open, nothing to run again.
      if (arrival.goalId || arrival.metricId || arrival.observationId || arrival.archive) onArrived();
      return;
    }
    let fade: ReturnType<typeof setTimeout> | null = null;
    const raf = requestAnimationFrame(() => {
      // The fold opens and the sheet opens here, on the frame — the row it scrolls to is already drawn.
      if (archiveId) setExpandedSeasonId(archiveId);
      if (observation) {
        if (observation.goalId) setOpenGoalId(observation.goalId);
        setObsErr('');
        setObsDialog({ editing: observation, goalId: observation.goalId });
      }
      const el = rowId ? document.getElementById(rowId) : null;
      if (el) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        setFlashRowId(rowId);
        fade = setTimeout(() => setFlashRowId(null), 2400);
      }
      onArrived();
    });
    return () => { cancelAnimationFrame(raf); if (fade) clearTimeout(fade); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the data first draws the row
  }, [data === null]);

  // The goal whose status pick is in flight: its control is disabled until the PATCH lands, so a
  // second pick inside the round-trip is refused visibly rather than dropped and snapped back
  // (/review 2026-09-15). One at a time is the pill's whole speed.
  const [statusPending, setStatusPending] = useState<string | null>(null);

  // ── goals: add / edit wording / status / review / remove ──
  async function saveGoal(v: GoalSheetValues) {
    if (!goalSheet || busy) return;
    const editing = goalSheet.editing;
    setGoalErr('');
    setBusy(true);
    setError('');
    try {
      const res = await fetch(editing ? `${base}/goals/${editing.id}` : `${base}/goals`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save — try again.');
      // On edit, keep the LOCAL status: the sheet never changes status, and a status PATCH may
      // be in flight — the server echo could carry the pre-pick value and stomp it.
      setData(d => d ? {
        ...d,
        goals: editing
          ? d.goals.map(g => g.id === json.goal.id ? { ...json.goal, status: g.status } : g)
          : [...d.goals, json.goal],
      } : d);
      setGoalSheet(null);
      if (!editing) setOpenGoalId(json.goal.id);
    } catch (e) {
      setGoalErr(e instanceof Error ? e.message : 'Could not save — try again.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * The status PICK (E4 — one control, never a cycle): choosing a status appends a status-only
   * review dated today through the same PATCH the pill always used; the history reads it as one
   * quiet line. Optimistic on the row, put back on failure.
   */
  async function pickStatus(goal: RepPlayerDevelopmentGoal, next: RepDevelopmentGoalStatus) {
    if (next === goal.status || statusPending) return;
    const prev = goal.status;
    setStatusPending(goal.id);
    setData(d => d ? { ...d, goals: d.goals.map(g => g.id === goal.id ? { ...g, status: next } : g) } : d);
    try {
      const res = await fetch(`${base}/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, reviewedOn: todayLocal() }),
      });
      if (!res.ok) throw new Error();
      // The review the status rode on is now on the record — re-read so the history shows it.
      await load();
    } catch {
      setData(d => d ? {
        ...d,
        goals: d.goals.map(g => g.id === goal.id && g.status === next ? { ...g, status: prev } : g),
      } : d);
      setError("Couldn't save the status change — try again.");
    } finally {
      setStatusPending(null);
    }
  }

  async function submitReview(v: { status: RepDevelopmentGoalStatus; reviewedOn: string; note: string; nextReviewOn: string | null; evidenceObservationIds: string[] }) {
    if (!reviewingGoal || busy) return;
    setBusy(true);
    setReviewErr('');
    try {
      const res = await fetch(`${base}/goals/${reviewingGoal.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, note: v.note || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the review — try again.');
      setData(d => d ? {
        ...d,
        reviews: [json.review, ...d.reviews],
        goals: d.goals.map(g => g.id === reviewingGoal.id ? (json.goal ?? { ...g, status: v.status, reviewOn: v.nextReviewOn ?? g.reviewOn }) : g),
      } : d);
      setReviewingGoal(null);
    } catch (e) {
      setReviewErr(e instanceof Error ? e.message : 'Could not save the review — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteGoal(goalId: string) {
    if (busy) return;
    const ok = await confirm({
      title: 'Remove this goal?',
      message: 'Removing is for mis-entries — to set a goal aside but keep it, review it as Parked instead. Its reviews go with it.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/goals/${goalId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setGoalSheet(null);
      setData(d => d ? { ...d, goals: d.goals.filter(g => g.id !== goalId), reviews: d.reviews.filter(r => r.goalId !== goalId) } : d);
      if (openGoalId === goalId) setOpenGoalId(null);
    } catch {
      setGoalErr("Couldn't remove it — try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── observations — the two player-page hosts share one module (`observation-sheet-host`) ──
  async function submitObservation(v: { measurableTypeId: string; observedOn: string; note: string; descriptor: string; goalId: string | null }) {
    if (!obsDialog || busy) return;
    const editing = obsDialog.editing;
    // An edit sends ONLY what changed (`observationEditPatch`, inside the host module); nothing
    // changed closes without a request (/review 2026-09-15).
    setBusy(true);
    setObsErr('');
    try {
      let saved: RepPlayerObservation;
      if (editing) {
        const patched = await patchObservation(base, editing, v);
        if (!patched) { setObsDialog(null); return; }
        saved = patched;
      } else {
        const res = await fetch(`${base}/observations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ measurableTypeId: v.measurableTypeId, observedOn: v.observedOn, note: v.note || null, descriptor: v.descriptor || null, goalId: v.goalId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the observation — try again.');
        saved = json.observation;
      }
      setData(d => d ? {
        ...d,
        observations: editing
          ? d.observations.map(o => o.id === editing.id ? saved : o)
          : [saved, ...d.observations].sort((a, b) => b.observedOn.localeCompare(a.observedOn) || b.createdAt.localeCompare(a.createdAt)),
      } : d);
      setObsDialog(null);
    } catch (e) {
      setObsErr(e instanceof Error ? e.message : 'Could not save the observation — try again.');
    } finally {
      setBusy(false);
    }
  }
  /** Remove — from the sheet's footer, behind the confirm the old view's × used (E2). */
  async function deleteObservation(id: string) {
    if (busy) return;
    if (!(await confirm(REMOVE_OBSERVATION_CONFIRM))) return;
    setBusy(true);
    try {
      await deleteObservationRecord(base, id);
      setData(d => d ? { ...d, observations: d.observations.filter(o => o.id !== id) } : d);
      setObsDialog(null);
    } catch (e) {
      setObsErr(e instanceof Error ? e.message : "Couldn't remove the observation — try again.");
    } finally {
      setBusy(false);
    }
  }
  /** Every door to an observation opens the same sheet (E2): a session-dated one has its skill and date fixed by the session. */
  function openObservation(o: RepPlayerObservation) {
    setObsErr('');
    setObsDialog({ editing: o, goalId: o.goalId });
  }

  // ── results ──
  function typeDefined(type: RepTeamMeasurableType) {
    setData(d => d ? {
      ...d,
      types: [...d.types, type].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    } : d);
  }
  const sortNewest = (list: RepPlayerMeasurable[]) =>
    [...list].sort((a, b) => b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt));

  /**
   * Save from the result sheet (E7): a new result POSTs one row per attempt (attempt 1..N, the same
   * date, no session — the reader groups them by the day); an edit walks the boxes against the saved
   * attempts — a changed value is a CORRECTION (the original kept), a cleared box removes that
   * attempt, a new box adds one — ONE AT A TIME, so a failure part-way leaves a smaller result the
   * next read shows honestly, never a broken one (the stage-2 lesson: `Promise.all` over data moves
   * is a partial move nobody repairs).
   */
  async function submitResult(v: ResultSheetValues) {
    if (!resultSheet || busy) return;
    const editing = resultSheet.editing;
    setBusy(true);
    setResultErr('');
    setError('');
    const post = async (attemptNo: number, value: number, note: string | null) => {
      const res = await fetch(`${base}/measurables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurableTypeId: v.measurableTypeId, value, recordedOn: v.recordedOn, note, attemptNo }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the result — try again.');
      const entry: RepPlayerMeasurable = json.entry;
      setData(d => d ? { ...d, measurables: sortNewest([entry, ...d.measurables]) } : d);
    };
    const patch = async (entryId: string, value: number, note: string | null | undefined) => {
      const res = await fetch(`${base}/measurables/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note === undefined ? { value } : { value, note }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the result — try again.');
      const entry: RepPlayerMeasurable = json.entry;
      setData(d => d ? { ...d, measurables: d.measurables.map(e => e.id === entry.id ? entry : e) } : d);
    };
    const remove = async (entryId: string) => {
      const res = await fetch(`${base}/measurables/${entryId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove an attempt — try again.');
      setData(d => d ? { ...d, measurables: d.measurables.filter(e => e.id !== entryId) } : d);
    };
    try {
      // The plan is decided in one tested place (`planResultEdit`); a new result is the same plan
      // against no saved attempts. Then each step, one at a time.
      const plan = planResultEdit(editing?.row.attempts ?? [], v.attempts, v.note || null);
      for (const r of plan.remove) await remove(r.id);
      for (const c of plan.patch) await patch(c.id, c.value, c.note);
      for (const n of plan.post) await post(n.attemptNo, n.value, n.note);
      setResultSheet(null);
      setExpandedTypeId(v.measurableTypeId);
    } catch (e) {
      setResultErr(e instanceof Error ? e.message : 'Could not save the result — try again.');
      // A partial write: re-read, and re-seat the sheet on the day's result AS THE RECORD NOW HOLDS
      // IT (a fresh row → the sheet remounts with the truth in its boxes), so "try again" plans
      // against what landed — never against the row as it was when the sheet opened, which would
      // re-issue steps already done (/review 2026-09-15). Nothing landed = the sheet stays as typed.
      await reseatResultSheet(v.measurableTypeId, v.recordedOn);
    } finally {
      setBusy(false);
    }
  }
  /** After a partial write: the open sheet follows the record. Null group = the day has no result now. */
  async function reseatResultSheet(typeId: string, recordedOn: string) {
    const fresh = await load();
    if (!fresh || !resultSheet) return;
    const type = fresh.types.find(t => t.id === typeId);
    const row = type ? groupBySession(fresh.measurables.filter(m => m.measurableTypeId === typeId), type).find(r => !r.sessionId && r.recordedOn === recordedOn) ?? null : null;
    if (row && type) setResultSheet({ editing: { row, type } });
    else if (resultSheet.editing) setResultSheet(null);
  }

  /** Remove result (E7) — every attempt in the group, sequenced through the existing per-entry delete. */
  async function deleteResult(row: ResultGroup) {
    if (busy) return;
    const n = row.attempts.length;
    const ok = await confirm({
      title: 'Remove this result?',
      message: n > 1 ? `Every attempt in it (${n}) comes off the record — for fixing a mis-entry.` : 'This deletes the saved value — for fixing a mis-entry.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setResultErr('');
    try {
      for (const a of row.attempts) {
        const res = await fetch(`${base}/measurables/${a.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Couldn't remove the result — try again.");
        setData(d => d ? { ...d, measurables: d.measurables.filter(e => e.id !== a.id) } : d);
      }
      setResultSheet(null);
    } catch (e) {
      setResultErr(e instanceof Error ? e.message : "Couldn't remove the result — try again.");
      // The attempts still on the record are the sheet's now — Remove again takes the rest.
      const type = resultSheet?.editing?.type;
      if (type) await reseatResultSheet(type.id, row.recordedOn);
    } finally {
      setBusy(false);
    }
  }

  /** The one-time carry-forward answer (3D). 'carry' merges the copied focus areas into the
   *  list; either answer retires the banner. A 409 = answered in another tab — that answer
   *  stands, so the banner quietly retires without an error. */
  async function answerCarry(action: 'carry' | 'fresh') {
    if (carryBusy) return;
    setCarryBusy(true);
    setCarryErr('');
    try {
      const res = await fetch(`${base}/carry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 409) {
        setData(d => d ? { ...d, carry: null } : d);
        return;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? "Couldn't save that — try again.");
      const copied: RepPlayerDevelopmentGoal[] = json.goals ?? [];
      setData(d => d ? { ...d, carry: null, goals: [...d.goals, ...copied] } : d);
    } catch (e) {
      setCarryErr(e instanceof Error ? e.message : "Couldn't save that — try again.");
    } finally {
      setCarryBusy(false);
    }
  }

  /** "View {season} record" — opens that season's fold at the tab's foot (never a navigation, E1). */
  function viewOldRecord(priorRosterId: string) {
    setExpandedSeasonId(priorRosterId);
    window.setTimeout(() => {
      document.getElementById(`dev-archive-${priorRosterId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  if (!data && !error) {
    return <CoachLoading label="Loading development…" inline />;
  }
  if (!data) {
    return (
      <p className={styles.detailPlaceholder}>
        {error}{' '}
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
          onClick={() => { setError(''); load(); }}>
          Try again
        </button>
      </p>
    );
  }

  const canWrite = data.canWrite;
  const canWriteGoals = data.canWriteGoals;
  const author = (id: string | null) => (id ? (data.authors[id] ?? 'a coach') : null);
  // Measured TESTS only for a result; the active skills for an observation.
  const activeTypes = activeMeasuredTests(data.types);
  const activeSkills = data.types.filter(t => t.kind === 'skill' && t.isActive);
  const { typeRows, neverRun, skillById } = derived;

  const goalPill = (status: RepDevelopmentGoalStatus) =>
    status === 'achieved' ? styles.badgeActive : status === 'working' ? styles.badgeCompleted : styles.badgeDraft;

  // The views this coach may open. Goals rides notes; Results rides record access.
  const views: { id: DevelopmentView; label: string }[] = [
    ...(data.showGoals ? [{ id: 'goals' as const, label: 'Goals' }] : []),
    ...(data.showMeasurables ? [{ id: 'results' as const, label: 'Results' }] : []),
  ];
  const activeView: DevelopmentView = view && views.some(v => v.id === view) ? view : views[0].id;
  // One goal opens by itself (E3) — most players have one. Nothing chosen yet, or an address naming a
  // goal the record no longer holds = the only goal opens; the coach's own close = every row shut.
  const chosenGoal = openGoalId && openGoalId !== NO_GOAL_OPEN ? data.goals.find(g => g.id === openGoalId) ?? null : null;
  const openGoal = openGoalId === NO_GOAL_OPEN ? null : chosenGoal ?? (data.goals.length === 1 ? data.goals[0] : null);
  const withResult = typeRows.length;
  const hasRecords = data.goals.length > 0 || data.measurables.length > 0 || data.observations.length > 0;

  const obsSkills = obsDialog?.editing
    ? [skillById.get(obsDialog.editing.measurableTypeId)].filter((t): t is RepTeamMeasurableType => !!t)
    : activeSkills;

  return (
    <>
      {error && <p className={styles.errorText} role="alert">{error}</p>}

      {/* ── Returning player? (3C — UNCHANGED, above the views) ── */}
      {canWrite && continuity.length > 0 && (
        <div style={{ marginBottom: '0.9rem' }}>
          {continuity.map(row => row.status === 'confirmed' ? (
            <p key={row.linkId} className={styles.devCardNote} style={{ marginBottom: '0.35rem' }}>
              Linked to your {row.prior.seasonLabel} record
              {row.decidedAt ? ` — confirmed ${formatShortInstant(row.decidedAt)}` : ''}.{' '}
              {/* At the tap floor: the linked season the fixture now carries put this line on the
                  layout sweep for the first time (the "green check over an empty fixture" trap). */}
              <button type="button" className={`btn btn-ghost ${styles.tapFloor}`} style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem' }}
                disabled={continuityBusy} onClick={() => decideContinuity(playerId, row, 'reject')}>
                Not the same player — unlink
              </button>
            </p>
          ) : (
            <ContinuityCompareCard key={row.linkId} row={row} busy={continuityBusy}
              onConfirm={() => decideContinuity(playerId, row, 'confirm')}
              onReject={() => decideContinuity(playerId, row, 'reject')}
              onDismiss={() => dismissContinuity(playerId, row.linkId)} />
          ))}
          {continuityErr && <p className={styles.errorText} role="alert">{continuityErr}</p>}
        </div>
      )}

      {/* ── Carry-forward offer (3D, M5 — UNCHANGED, above the views) ── */}
      {canWriteGoals && data.carry && (
        <div className={styles.devCarryBanner}>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            <b>Returning player — bring forward the {data.carry.workingCount} goal{data.carry.workingCount === 1 ? '' : 's'} they were working on in {data.carry.priorSeasonLabel}?</b>
          </p>
          <p className={styles.devCardNote} style={{ marginTop: '0.25rem' }}>
            They&apos;ll join this season as &ldquo;Working on it&rdquo;. Results never carry over — last season&apos;s stay in its fold below. You can look first.
          </p>
          <div className={styles.devCarryActions}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.77rem' }} disabled={carryBusy}
              onClick={() => data.carry && viewOldRecord(data.carry.priorRosterId)}>
              View {data.carry.priorSeasonLabel} record
            </button>
            <button type="button" className="btn btn-lime" style={{ fontSize: '0.77rem' }} disabled={carryBusy}
              onClick={() => answerCarry('carry')}>
              Yes, bring forward
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.77rem' }} disabled={carryBusy}
              onClick={() => answerCarry('fresh')}>
              No, start fresh
            </button>
          </div>
          {carryErr && <p className={styles.errorText} role="alert" style={{ marginTop: '0.4rem' }}>{carryErr}</p>}
        </div>
      )}

      {/* ── The view switch, and the handout door beside it (E1) — the one thing on this tab a coach
          opens with a purpose beyond reading, where the Metrics door used to sit. Roster's List /
          Depth-chart shape (owner ruling 2026-09-13, hub R2-4). ── */}
      <div className={styles.listToolbar}>
        <div className={`${styles.segChoice} ${css.viewSwitch}`} role="group" aria-label="Development views">
          {views.map(v => (
            <button key={v.id} type="button" aria-pressed={activeView === v.id}
              className={`${styles.segBtn} ${styles.tapFloor}${activeView === v.id ? ' ' + styles.segBtnActive : ''}`}
              onClick={() => chooseView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
        {hasRecords && (
          <span className={`${styles.listToolbarEnd} ${css.toolbarEnd}`}>
            <Link href={developmentHandoutHref(portalBase, playerId, { returnTo: playerDevelopmentHref(portalBase, playerId, { view: activeView, returnTo: arrival.returnTo }) })}
              className={`btn btn-ghost ${styles.tapFloor} ${css.handoutLink}`}>
              <Printer size={13} aria-hidden /> Preview development handout
            </Link>
          </span>
        )}
      </div>

      {/* ══ GOALS ══ */}
      {activeView === 'goals' && data.showGoals && (
        <>
          {/* Tryout snapshot — where the season started, above the goals (it is what they were chosen from; R4). */}
          {data.tryoutBaseline && <TryoutSnapshotCard snapshot={data.tryoutBaseline} variant="card" />}

          {/* One line above the list: the count, and the two things a coach writes from here — a goal,
              or an observation with no goal behind it (the sheet's "Evidence for" can still name one). */}
          <div className={styles.devCardHeadRow}>
            <p className={css.countLine}><b>{data.goals.length}</b> {data.goals.length === 1 ? 'goal' : 'goals'} this season</p>
            {canWriteGoals && (
              <span className={css.writeDoors}>
                <button type="button" className={`btn btn-ghost ${styles.devSectionAction} ${css.door}`}
                  onClick={() => { setGoalErr(''); setGoalSheet({ editing: null }); }}>
                  <Plus size={13} aria-hidden /> Add goal
                </button>
                <button type="button" className={`btn btn-ghost ${styles.devSectionAction} ${css.door}`}
                  disabled={activeSkills.length === 0}
                  title={activeSkills.length === 0 ? 'Define a skill in Metrics first' : undefined}
                  onClick={() => { setObsErr(''); setObsDialog({ editing: null, goalId: null }); }}>
                  <Plus size={13} aria-hidden /> Record an observation
                </button>
              </span>
            )}
          </div>
          {data.goals.length === 0 && (
            <p className={styles.detailPlaceholder}>
              {canWriteGoals ? `No goals yet — add the first thing ${firstName} is working on.` : 'No goals yet.'}
            </p>
          )}
          {data.goals.length > 0 && (
            <ul className={css.goalList}>
              {data.goals.map(g => {
                const open = openGoal?.id === g.id;
                const toggle = () => setOpenGoalId(open ? NO_GOAL_OPEN : g.id);
                const tag = g.tagId ? focusTagById.get(g.tagId) : null;
                const caption = [originSentence(g.origin), author(g.createdBy)].filter(Boolean).join(' · ');
                return (
                  <li key={g.id} id={`dev-goal-${g.id}`} className={`${css.goalRow}${flashRowId === `dev-goal-${g.id}` ? ` ${styles.collapseFlash}` : ''}`}>
                    {/* The row IS the panel (E3): the name is the real button; the head is the pointer shortcut. */}
                    <div className={css.goalHead} onClick={toggle}>
                      <button type="button" className={css.goalName} aria-expanded={open} aria-controls={`dev-goal-body-${g.id}`}
                        onClick={e => { e.stopPropagation(); toggle(); }}>
                        {g.focusArea}
                        {tag && <span className={`${styles.badge} ${styles.badgeDraft} ${css.goalTag}`}>{tag.name}</span>}
                        {caption && <small>{caption}</small>}
                      </button>
                      {/* ONE status control, a PICK (E4): three choices, never a cycle. */}
                      {canWriteGoals ? (
                        <span className={css.statusPickWrap} onClick={e => e.stopPropagation()}>
                          <select className={`${styles.badge} ${goalPill(g.status)} ${css.statusPick}`} value={g.status} disabled={statusPending !== null}
                            aria-label={`Status of ${g.focusArea} — choosing one adds a dated review`}
                            onChange={e => pickStatus(g, e.target.value as RepDevelopmentGoalStatus)}>
                            {GOAL_STATUSES.map(s => <option key={s} value={s}>{GOAL_STATUS_LABELS[s]}</option>)}
                          </select>
                          <ChevronDown size={12} className={css.statusPickCaret} aria-hidden />
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${goalPill(g.status)}`}>{GOAL_STATUS_LABELS[g.status]}</span>
                      )}
                      <span className={css.chev} aria-hidden>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                    </div>
                    {open && (
                      <div id={`dev-goal-body-${g.id}`} className={css.goalBody}>
                        {g.note && <p className={styles.devCardNote} style={{ marginBottom: '0.5rem' }}>{g.note}</p>}
                        {(g.success || g.reviewOn) && (
                          <div className={css.goalFacts}>
                            {g.success && <span><b>Success looks like:</b> {g.success}</span>}
                            {g.reviewOn && <span><b>Next review:</b> {formatShortDate(g.reviewOn)}</span>}
                          </div>
                        )}
                        {canWriteGoals && (
                          <div className={css.goalActions}>
                            <button type="button" className={`btn btn-lime ${styles.tapFloor} ${css.door}`}
                              onClick={() => { setReviewErr(''); setReviewingGoal(g); }}>Review goal</button>
                            <button type="button" className={`btn btn-ghost ${styles.tapFloor} ${css.door}`} disabled={activeSkills.length === 0}
                              title={activeSkills.length === 0 ? 'Define a skill in Metrics first' : undefined}
                              onClick={() => { setObsErr(''); setObsDialog({ editing: null, goalId: g.id }); }}>Record an observation</button>
                            <button type="button" className={`btn btn-ghost ${styles.tapFloor} ${css.door}`}
                              onClick={() => { setGoalErr(''); setGoalSheet({ editing: g }); }}>Edit wording</button>
                          </div>
                        )}
                        <p className={styles.miniListLabel} style={{ marginTop: 0 }}>How this goal has developed</p>
                        <ul className={css.history}>
                          {goalTimeline(g, data.reviews, data.observations).map((ev, i) => (
                            <HistoryRow key={`${ev.kind}-${ev.reviewId ?? ev.observationId ?? i}`} ev={ev} author={author} portalBase={portalBase} canWrite={canWrite}
                              observation={ev.observationId ? data.observations.find(o => o.id === ev.observationId) ?? null : null}
                              onOpenObservation={canWriteGoals ? openObservation : null}
                              statusOpen={openStatusKey === `${g.id}:${ev.on}`}
                              onToggleStatus={() => setOpenStatusKey(k => (k === `${g.id}:${ev.on}` ? null : `${g.id}:${ev.on}`))} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* ══ RESULTS ══ */}
      {activeView === 'results' && data.showMeasurables && (
        <>
          <div className={styles.devCardHeadRow}>
            <p className={css.countLine}><b>{withResult}</b> {withResult === 1 ? 'test' : 'tests'} with a result this season</p>
            {canWrite && (
              <span className={css.writeDoors}>
                <button type="button" className={`btn btn-ghost ${styles.devSectionAction} ${css.door}`}
                  onClick={() => { setResultErr(''); setResultSheet({ editing: null }); }}>
                  <Plus size={13} aria-hidden /> Record a result
                </button>
              </span>
            )}
          </div>
          {typeRows.length === 0 && (
            <p className={styles.detailPlaceholder}>
              {canWrite
                ? (activeTypes.length === 0 ? 'No results yet — set up your first test (like a 60-yd sprint) and record a result.' : `No results yet for ${firstName} — record one, or run a session.`)
                : 'No results recorded yet.'}
            </p>
          )}
          {typeRows.length > 0 && (
            /* A table on the card ground, on the list recipe (E6): the name is the button, the row the
               pointer shortcut, the chevron last; retired rows the same rows in the tertiary ink, last.
               The .tableAsCards primitive reflows rows to cards @640 — the lead cell is the card's
               title; its own one-line reading of the hidden columns sits under it. */
            <div className={`${styles.tableWrap} ${styles.tableAsCards} ${styles.devTableCard}`}>
              <table className={styles.table} aria-label="Results">
                <thead>
                  <tr>
                    <th className={styles.th}>Test</th>
                    <th className={`${styles.th} ${css.desktopCell}`}>Latest</th>
                    <th className={`${styles.th} ${css.desktopCell}`}>Trend</th>
                    <th className={`${styles.th} ${styles.tdShrink} ${css.desktopCell}`}>Date</th>
                    <th className={styles.th} aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {typeRows.map(({ type, sessions, latest, chronoDrawable, splitNote }) => {
                    const expanded = expandedTypeId === type.id;
                    const attempts = sessions.reduce((n, s) => n + s.attempts.length, 0);
                    const caption = [
                      type.unit,
                      type.aim === 'lower' ? 'lower is the aim' : type.aim === 'higher' ? 'higher is the aim' : type.aim === 'range' ? `aim ${formatValue(type.rangeFrom ?? 0)}–${formatValue(type.rangeTo ?? 0)}` : 'record only',
                      `${sessions.length} ${sessions.length === 1 ? 'result' : 'results'}`,
                      attempts > sessions.length ? `${attempts} attempts` : null,
                      type.isActive ? null : 'retired',
                      splitNote ? splitNote.replace(/\.$/, '').replace(/^Units changed — /, 'units changed — ') : null,
                    ].filter(Boolean).join(' · ');
                    const headline = latest ? headlineLabel(latest, type) : '—';
                    const toggle = () => setExpandedTypeId(id => (id === type.id ? null : type.id));
                    return (
                      <Fragment key={type.id}>
                        <tr id={`dev-metric-${type.id}`}
                          className={`${styles.tr} ${styles.rowTappable}${type.isActive ? '' : ` ${styles.devRetiredRow}`}${flashRowId === `dev-metric-${type.id}` ? ` ${styles.collapseFlash}` : ''}`}
                          onClick={toggle}>
                          <td className={`${styles.td} ${styles.cardStackCell}`}>
                            <button type="button" className={`${styles.devCellLink} ${css.testName}`} aria-expanded={expanded} onClick={e => { e.stopPropagation(); toggle(); }}>{type.name}</button>
                            <span className={styles.listRowSub}>{caption}</span>
                            {latest && <span className={css.phoneLine}><b>{headline}</b> · {formatShortDate(latest.recordedOn)}</span>}
                          </td>
                          <td className={`${styles.td} ${css.desktopCell} ${css.latest}`} data-label="Latest">{headline}</td>
                          <td className={`${styles.td} ${css.desktopCell} ${css.trendCell}`} data-label="Trend">
                            {chronoDrawable.length >= 2 ? <Sparkline values={chronoDrawable.slice(-10)} /> : <span className={styles.devRowDash}>—</span>}
                          </td>
                          <td className={`${styles.td} ${styles.tdShrink} ${css.desktopCell}`} data-label="Date">{latest ? formatShortDate(latest.recordedOn) : <span className={styles.devRowDash}>—</span>}</td>
                          <td className={`${styles.td} ${styles.cardActionCell} ${styles.cardActionCorner}`}>
                            <span className={styles.listRowActions}>
                              <button type="button" className={`${styles.linkBtn} ${styles.listRowToggle}`} aria-label={`${expanded ? 'Close' : 'Open'} ${type.name}`} aria-expanded={expanded}
                                onClick={e => { e.stopPropagation(); toggle(); }}>
                                {expanded ? <ChevronUp size={16} className={styles.listRowChevron} aria-hidden /> : <ChevronRight size={16} className={styles.listRowChevron} aria-hidden />}
                              </button>
                            </span>
                          </td>
                        </tr>
                        {expanded && (
                          <>
                            <tr className={`${css.innerHead} ${css.desktopCell}`}>
                              <td className={styles.td}>Date</td>
                              <td className={styles.td}>Result</td>
                              <td className={styles.td} colSpan={2}>Attempts</td>
                              <td className={styles.td}>Source</td>
                            </tr>
                            {sessions.map(row => {
                              const corrected = row.attempts.filter(a => a.correctedFrom != null);
                              const attemptsText = attemptsLine(row, type);
                              const correctedTitle = corrected.length > 0 ? `corrected — was ${corrected.map(a => formatValue(a.correctedFrom!)).join(' · ')}` : undefined;
                              return (
                                <tr key={row.key} className={`${styles.tr} ${css.innerRow}`}>
                                  <td className={`${styles.td} ${styles.cardStackCell}`}>
                                    <span className={css.desktopCell}>{formatShortDate(row.recordedOn)}</span>
                                    <span className={css.phoneLine}><b>{formatShortDate(row.recordedOn)} · {headlineLabel(row, type)}</b></span>
                                  </td>
                                  <td className={`${styles.td} ${css.desktopCell} ${css.innerResult}`} data-label="Result">{headlineLabel(row, type)}</td>
                                  {/* The attempts and the correction mark as the grid shows them (8.31* — the original on
                                      hover); a single uncorrected attempt is one dash, and on a phone that cell is not drawn. */}
                                  <td className={`${styles.td} ${css.attemptsCell}${attemptsText ? '' : ` ${css.desktopCell}`}`} colSpan={2}>
                                    {attemptsText ? <span title={correctedTitle}>{attemptsText}</span> : <span className={styles.devRowDash}>—</span>}
                                  </td>
                                  <td className={`${styles.td} ${styles.tdShrink}`}>
                                    {/* The source is a door: the session (a room inside Skills & Goals, which opens with
                                        the Development grant only — a coach without it gets no door that 403s), or the
                                        result's own sheet (E7). */}
                                    {row.sessionId
                                      ? (canWrite ? <Link href={`${portalBase}/development/sessions/${row.sessionId}`} className={`${styles.devCellLink} ${css.sourceDoor}`}>Session ›</Link> : <span className={styles.devRowDash}>In a session</span>)
                                      : (canWrite && type.isActive
                                        ? <button type="button" className={`${styles.devCellLink} ${css.sourceDoor}`} onClick={() => { setResultErr(''); setResultSheet({ editing: { row, type } }); }}>Outside a session ›</button>
                                        : <span className={styles.devRowDash}>Outside a session</span>)}
                                  </td>
                                </tr>
                              );
                            })}
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {neverRun.length > 0 && typeRows.length > 0 && (
            <p className={css.captionLine}><b>Not yet recorded for {firstName}:</b> {neverRun.map(t => t.name).join(', ')}.</p>
          )}
        </>
      )}

      {/* ── Previous seasons — a shut fold at the tab's foot, under whichever view is open, titled by
          the season's NAME (E1; the closed-season ruling's answer to "which year am I reading?").
          Absent when the player has no linked season. A scrapbook: dated records, NO cross-season
          computation anywhere. ── */}
      {data.archive.map(season => {
        const expanded = expandedSeasonId === season.priorRosterId;
        const entryCount = season.tests.reduce((n, t) => n + t.entries.length, 0);
        const hint = [
          season.goals.length > 0 ? `${season.goals.length} goal${season.goals.length === 1 ? '' : 's'}` : null,
          entryCount > 0 ? `${entryCount} result${entryCount === 1 ? '' : 's'}` : null,
          season.attendancePct != null ? 'attendance' : null,
        ].filter(Boolean);
        return (
          <div key={season.priorRosterId} id={`dev-archive-${season.priorRosterId}`}
            className={`${css.archive}${flashRowId === `dev-archive-${season.priorRosterId}` ? ` ${styles.collapseFlash}` : ''}`}>
            <button type="button" className={css.archiveHead} aria-expanded={expanded}
              onClick={() => setExpandedSeasonId(id => (id === season.priorRosterId ? null : season.priorRosterId))}>
              <b>{season.seasonLabel}</b>
              <span className={`${styles.badge} ${styles.badgeDraft}`}>Archive</span>
              <span className={css.archiveHint}>{hint.length > 0 ? `${hint.length === 1 ? hint[0] : `${hint.slice(0, -1).join(', ')} and ${hint.at(-1)}`} from that season` : 'no development records that season'}</span>
              <span className={css.chev} aria-hidden>{expanded ? <ChevronUp size={16} /> : <ChevronRight size={16} />}</span>
            </button>
            {expanded && (
              <div className={css.archiveBody}>
                {season.goals.length > 0 && (
                  <>
                    <p className={css.archiveLabel}>Goals that season</p>
                    {season.goals.map((g, i) => (
                      <div key={i} className={css.archiveRow}>
                        <span>{g.focusArea}{g.note && <small>{g.note}</small>}</span>
                        <span className={`${styles.badge} ${goalPill(g.status as RepDevelopmentGoalStatus)}`}>
                          {GOAL_STATUS_LABELS[g.status as RepDevelopmentGoalStatus] ?? g.status}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {season.tests.length > 0 && (
                  <>
                    <p className={css.archiveLabel}>Results that season</p>
                    {season.tests.map(t => (
                      <div key={t.name} className={css.archiveRow}>
                        <span>{t.name}</span>
                        <span className={css.archiveVals}>{t.entries.map(e => `${formatValue(e.value)} ${e.unit} (${formatShortDate(e.recordedOn)})`).join(' · ')}</span>
                      </div>
                    ))}
                  </>
                )}
                {season.attendancePct != null && <p className={css.captionLine}>Attendance that season: {season.attendancePct}%.</p>}
                {hint.length === 0 && <p className={css.captionLine}>Nothing was recorded for {firstName} that season.</p>}
              </div>
            )}
          </div>
        );
      })}

      {goalSheet && (
        <GoalSheet editing={goalSheet.editing} orgSlug={orgSlug} teamId={teamId}
          focusTags={focusTags} onCreateTag={createFocusTag} onTagsChanged={reloadFocusTags}
          busy={busy} error={goalErr} onSubmit={saveGoal} onClose={() => { if (!busy) setGoalSheet(null); }}
          onRemove={goalSheet.editing ? () => deleteGoal(goalSheet.editing!.id) : undefined} />
      )}
      {reviewingGoal && (
        <ReviewGoalDialog goal={reviewingGoal} reviews={data.reviews} linkedObservations={data.observations.filter(o => o.goalId === reviewingGoal.id)}
          busy={busy} error={reviewErr} onSubmit={submitReview} onClose={() => { if (!busy) setReviewingGoal(null); }} />
      )}
      {obsDialog && (
        <RecordObservationDialog key={obsDialog.editing?.id ?? 'new'} skills={obsSkills} goals={data.goals} editing={obsDialog.editing} presetGoalId={obsDialog.goalId}
          fixed={obsDialog.editing ? fixedObservation(obsDialog.editing, skillById.get(obsDialog.editing.measurableTypeId), playerName, author(obsDialog.editing.createdBy)) : null}
          busy={busy} error={obsErr} onSubmit={submitObservation} onClose={() => { if (!busy) setObsDialog(null); }}
          onRemove={obsDialog.editing ? () => deleteObservation(obsDialog.editing!.id) : undefined} />
      )}
      {resultSheet && (
        <RecordResultSheet key={resultSheet.editing ? resultSheet.editing.row.attempts.map(a => `${a.id}:${a.value}`).join('|') : 'new'}
          orgSlug={orgSlug} teamId={teamId} playerName={playerName} tests={activeTypes} editing={resultSheet.editing}
          presetTypeId={expandedTypeId && activeTypes.some(t => t.id === expandedTypeId) ? expandedTypeId : null}
          enteredBy={resultSheet.editing ? author(resultSheet.editing.row.attempts[0]?.createdBy ?? null) : null}
          busy={busy} error={resultErr} onSubmit={submitResult} onClose={() => { if (!busy) setResultSheet(null); }}
          onRemove={resultSheet.editing ? () => deleteResult(resultSheet.editing!.row) : undefined}
          onTypeDefined={typeDefined} />
      )}
    </>
  );
}

/**
 * The Attempts cell of an opened test (E6): "best of 2 · 8.31* · 8.24 · average 8.275" for a test,
 * "66 (in) · 70 (+2) · 64 (in)" for a range test (the Result cell already says "2 of 3 in range"),
 * the note(s) after; a corrected attempt wears the grid's *; one uncorrected attempt with no note
 * is nothing (a dash in the cell).
 */
function attemptsLine(row: ResultGroup, type: RepTeamMeasurableType): string | null {
  const range = type.aim === 'range' && type.rangeFrom != null && type.rangeTo != null;
  const mark = (a: RepPlayerMeasurable) => `${formatValue(a.value)}${a.correctedFrom != null ? '*' : ''}${range ? ` (${rangeSign(a.value, type.rangeFrom!, type.rangeTo!)})` : ''}`;
  const parts: string[] = [];
  if (row.attempts.length > 1) {
    if (!range) parts.push(`${headlineLead(type)} of ${row.attempts.length}`);
    parts.push(row.attempts.map(mark).join(' · '));
    if (!range && type.headline !== 'average' && row.average != null) parts.push(`average ${formatValue(row.average)}`);
  } else if (row.attempts[0]?.correctedFrom != null) {
    parts.push(`corrected — was ${formatValue(row.attempts[0].correctedFrom)}`);
  }
  const notes = row.attempts.map(a => a.note).filter(Boolean).join(' · ');
  if (notes) parts.push(notes);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * One line of a goal's history: a review with its words, an observation (a DOOR into its sheet,
 * with "in a session ›" when a session dates it — E2), the set event, or a wordless status change
 * in the quiet ink — several on one day folded into one line that opens to the rows (E4).
 */
function HistoryRow({ ev, author, portalBase, canWrite, observation, onOpenObservation, statusOpen, onToggleStatus }: {
  ev: GoalEvent;
  author: (id: string | null) => string | null;
  portalBase: string;
  canWrite: boolean;
  observation: RepPlayerObservation | null;
  onOpenObservation: ((o: RepPlayerObservation) => void) | null;
  statusOpen: boolean;
  onToggleStatus: () => void;
}) {
  const by = author(ev.by);
  const folded = ev.kind === 'status' && (ev.changes?.length ?? 0) > 1;
  const detail = [ev.text, ev.nextReviewOn ? `Next review ${formatShortDate(ev.nextReviewOn)}` : null].filter(Boolean).join(' · ');
  const face = (
    <>
      <strong>{ev.title}</strong>
      {detail && <small>{detail}</small>}
    </>
  );
  return (
    <li className={`${css.historyRow}${ev.kind === 'status' ? ` ${css.historyQuiet}` : ''}`}>
      <span className={css.historyMain}>
        {ev.kind === 'observation' && observation && onOpenObservation
          ? <button type="button" className={css.historyDoor} onClick={() => onOpenObservation(observation)}>{face}</button>
          : face}
      </span>
      <span className={css.historyMeta}>
        {formatShortDate(ev.on)}{by ? ` · ${by}` : ''}
        {ev.kind === 'observation' && ev.sessionId && canWrite && (
          <> · <Link href={`${portalBase}/development/sessions/${ev.sessionId}`} className={css.historyLink}>in a session ›</Link></>
        )}
        {folded && (
          <> · <button type="button" className={css.historyLink} aria-expanded={statusOpen} onClick={onToggleStatus}>{statusOpen ? 'hide' : 'show ›'}</button></>
        )}
      </span>
      {folded && statusOpen && ev.changes && (
        <ul className={css.statusRows}>
          {ev.changes.map(c => (
            <li key={c.reviewId}>
              <span>Status → {GOAL_STATUS_LABELS[c.status]}{c.nextReviewOn ? ` · next review ${formatShortDate(c.nextReviewOn)}` : ''}</span>
              <span>{author(c.by) ?? ''}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
