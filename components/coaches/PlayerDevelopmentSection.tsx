'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, X, Check, Settings2, Printer } from 'lucide-react';
import TagPicker from '@/components/coaches/TagPicker';
import { FOCUS_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import { useFocusTags } from '@/components/coaches/use-focus-tags';
import { playerDevelopmentHref, developmentHandoutHref, type DevelopmentAddress, type DevelopmentView } from '@/lib/development-address';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import Sparkline from '@/components/charts/Sparkline';
import {
  splitSeriesByUnit, drawableSegment, unitSplitNote, groupBySession, latestSessionResult, headlineLabel, headlineMethod, type SessionResult,
} from '@/lib/measurable-series';
import { NewTypeFields } from '@/components/coaches/NewTypeFields';
import { activeMeasuredTests, measuredTestsWithHistory } from '@/lib/measurable-definition';
import { skillsAndGoalsHref } from '@/lib/development-address';
import { goalTimeline, originSentence, GOAL_STATUS_LABELS } from '@/lib/development-goal-history';
import ContinuityCompareCard from '@/components/coaches/ContinuityCompareCard';
import TryoutSnapshotCard from '@/components/coaches/TryoutSnapshotCard';
import ReviewGoalDialog from '@/components/coaches/ReviewGoalDialog';
import RecordObservationDialog from '@/components/coaches/RecordObservationDialog';
import { useContinuityLinks } from '@/lib/hooks/useContinuityLinks';
import { formatValue, todayLocal, formatShortDate, formatShortInstant } from '@/lib/measurable-format';
import type {
  RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerDevelopmentGoal, RepDevelopmentGoalStatus,
  RepTryoutBaselineSnapshot, RepPlayerObservation, RepDevelopmentGoalReview,
} from '@/lib/types';

const STATUS_LABELS = GOAL_STATUS_LABELS;
const STATUS_ORDER: RepDevelopmentGoalStatus[] = ['working', 'achieved', 'parked'];

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
  /**
   * Identity + season lines the old in-section PDF quoted from the page. The handout page (Phase 3)
   * reads its own; these stay on the contract only until the player page's rebuild lands and both
   * sides drop them together.
   */
  playerName: string;
  playerNumber: string | null;
  teamName: string;
  seasonName: string | null;
  /** The address the coach arrived on (view · metric · goal · the way back) — parsed once by the page. */
  arrival: DevelopmentAddress;
  /** Called once the addressed row has been opened and flashed, so a remount does not do it again. */
  onArrived: () => void;
}

/**
 * ═══ THE DEVELOPMENT SECTION — four views inside it (Phase 2, mockup screen 4; F14) ═══
 * Goals · Results · Observations · Previous seasons as ONE segmented control, one body at a
 * time — the record's three tabs are untouched. The continuity card and the carry-forward offer
 * sit ABOVE the views (they are prompts, not records); the tryout snapshot heads Goals (it is what
 * the goals were chosen from). The old Context lines (depth chart, innings, attendance) LEFT this
 * section (F16) — they are quoted from other homes, never owned here.
 */
export default function PlayerDevelopmentSection({
  orgSlug, teamId, playerId, arrival, onArrived,
}: Props) {
  const router = useRouter();
  const portalBase = `/${orgSlug}/coaches/teams/${teamId}`;
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/development`;
  const typesBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/measurable-types`;
  // The library's ONE editor (Phase 1): the Metrics tab. "Test types" used to open a dialog here.
  const metricsHref = skillsAndGoalsHref(portalBase, 'metrics');
  const confirm = useConfirm();

  const [data, setData] = useState<DevelopmentData | null>(null);
  const [error, setError] = useState('');
  // "✓ Saved · Undo" for the most recent create — Undo deletes the just-created row.
  const [lastCreated, setLastCreated] = useState<{ kind: 'goal' | 'entry' | 'observation'; id: string } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // ── the view (the address module's `view`; the segmented control writes it back to the URL) ──
  const [view, setView] = useState<DevelopmentView | null>(arrival.view);
  function chooseView(next: DevelopmentView) {
    setView(next);
    router.replace(playerDevelopmentHref(portalBase, playerId, { view: next, returnTo: arrival.returnTo }), { scroll: false });
  }

  // ── goals ──
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalFocus, setGoalFocus] = useState('');
  const [goalNote, setGoalNote] = useState('');
  const [goalSuccess, setGoalSuccess] = useState('');
  const [goalReviewOn, setGoalReviewOn] = useState('');
  const [goalMoreOpen, setGoalMoreOpen] = useState(false);
  /**
   * F11 (Phase 1): the goal form exposes the focus TAG that mig 221 gave a goal — the same picker
   * the tryout hand-off uses, the same 'focus' vocabulary the drills and the focus rail read. One
   * tag, optional, never inferred from the text (the type's own note). `verifyFocusTag` proves
   * ownership on both goal routes; the picker only offers this team's words.
   */
  const [goalTagId, setGoalTagId] = useState<string | null>(null);
  // Fetched only once the read says goals are shown here — a results-only coach never pays for it.
  const { tags: focusTags, createTag: createFocusTag, reload: reloadFocusTags } = useFocusTags(orgSlug, teamId, { skipFetch: !data?.showGoals });
  const focusTagById = useMemo(() => new Map(focusTags.map(t => [t.id, t])), [focusTags]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(arrival.goalId);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [reviewingGoal, setReviewingGoal] = useState<RepPlayerDevelopmentGoal | null>(null);
  const [reviewErr, setReviewErr] = useState('');
  const [busy, setBusy] = useState(false);

  // ── observations ──
  const [obsDialog, setObsDialog] = useState<{ editing: RepPlayerObservation | null; goalId: string | null } | null>(null);
  const [obsErr, setObsErr] = useState('');

  // ── results ──
  const [logOpen, setLogOpen] = useState(false);
  const [logTypeId, setLogTypeId] = useState('');
  const [logValue, setLogValue] = useState('');
  const [logDate, setLogDate] = useState(todayLocal());
  const [logNote, setLogNote] = useState('');
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeUnit, setNewTypeUnit] = useState('');
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(arrival.view === 'results' ? arrival.metricId : null);

  /**
   * The arrival address (Phase 1, F09): `?section=development` opens this section (the collapse
   * primitive's job); `view` + `metric` / `goal` say WHICH row the link meant, and it is opened and
   * flashed ONCE on arrival — the page owns the address and `onArrived` clears it, because this
   * section remounts on a tab switch and must not run the arrival again on the same address.
   */
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const rowId = arrival.view === 'results' && arrival.metricId ? `dev-metric-${arrival.metricId}`
      : arrival.view === 'goals' && arrival.goalId ? `dev-goal-${arrival.goalId}` : null;
    if (!rowId) return;
    const el = document.getElementById(rowId);
    if (!el) return;
    let fade: ReturnType<typeof setTimeout> | null = null;
    const raf = requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      setFlashRowId(rowId);
      onArrived();
      fade = setTimeout(() => setFlashRowId(null), 2400);
    });
    return () => { cancelAnimationFrame(raf); if (fade) clearTimeout(fade); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the data first draws the row
  }, [data === null]);

  /**
   * Derived once per data load, not per render: this component re-renders on every dialog keystroke
   * (busy flags, drafts), and regrouping every reading into session rows each time is wasted work.
   * Results rows are in library order (roster-order principle: stable, never sorted by result);
   * each test's readings become ONE row per session through the one home (`groupBySession`) — three
   * sprints are one row with the headline and the attempts listed. F01: the line is drawn from the
   * CURRENT unit's run of SESSION ROWS only; every attempt stays in the expanded list beneath.
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
      .filter(r => r.type.isActive || r.sessions.length > 0);
    return {
      typeRows,
      skillById: new Map((data?.types ?? []).map(t => [t.id, t])),
      goalById: new Map((data?.goals ?? []).map(g => [g.id, g])),
    };
  }, [data]);

  // ── 3D: previous-seasons archive + the one-time carry-forward offer ──
  const [expandedSeasonId, setExpandedSeasonId] = useState<string | null>(null);
  const [carryBusy, setCarryBusy] = useState(false);
  const [carryErr, setCarryErr] = useState('');

  // Inline validation shown right beside the button the coach pressed — a button that
  // silently does nothing is not an answer (owner feedback, 2026-07-17).
  const [goalErr, setGoalErr] = useState('');
  const [logErr, setLogErr] = useState('');
  const {
    byCurrent: continuityByCurrent, decide: decideContinuity, dismiss: dismissContinuity,
    busy: continuityBusy, error: continuityErr,
  } = useContinuityLinks(
    data?.canWrite ? `/api/coaches/${orgSlug}/teams/${teamId}/development/continuity` : null,
    'roster',
    playerId,
  );
  const continuity = continuityByCurrent[playerId] ?? [];
  // Sequenced like the session screen's: every status tap re-reads, and two in quick succession
  // can resolve out of order — the OLDER read must never land over the newer one.
  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const res = await fetch(base);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load development — try again.');
      if (seq !== loadSeqRef.current) return;
      setData(json);
      setError('');
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load development — try again.');
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  const flashTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
  }, []);
  // In-flight status PATCHes per goal — blocks double-taps without freezing the whole card.
  const statusInFlightRef = useRef<Set<string>>(new Set());

  function flashSaved(created: { kind: 'goal' | 'entry' | 'observation'; id: string } | null) {
    setLastCreated(created);
    setSavedFlash(true);
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setSavedFlash(false), 4000);
  }
  function clearFlashFor(id: string) {
    if (lastCreated?.id === id) { setLastCreated(null); setSavedFlash(false); }
  }

  async function undoLastCreate() {
    if (!lastCreated || busy) return;
    const { kind, id } = lastCreated;
    const url = kind === 'goal' ? `${base}/goals/${id}` : kind === 'observation' ? `${base}/observations/${id}` : `${base}/measurables/${id}`;
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        setData(d => d ? (kind === 'goal'
          ? { ...d, goals: d.goals.filter(g => g.id !== id) }
          : kind === 'observation'
            ? { ...d, observations: d.observations.filter(o => o.id !== id) }
            : { ...d, measurables: d.measurables.filter(e => e.id !== id) }) : d);
      }
    } catch {
      setError("Couldn't undo that — try removing it from the list.");
    } finally {
      setLastCreated(null);
      setSavedFlash(false);
      setBusy(false);
    }
  }

  // ── goals: add / edit wording / status / review / remove ──
  function openGoalForm(goal: RepPlayerDevelopmentGoal | null) {
    setEditingGoalId(goal?.id ?? null);
    setGoalFocus(goal?.focusArea ?? '');
    setGoalNote(goal?.note ?? '');
    setGoalTagId(goal?.tagId ?? null);
    setGoalSuccess(goal?.success ?? '');
    setGoalReviewOn(goal?.reviewOn ?? '');
    setGoalMoreOpen(!!(goal?.success || goal?.reviewOn || goal?.tagId));
    setGoalErr('');
    setGoalFormOpen(true);
  }
  async function saveGoal() {
    if (busy) return;
    const focus = goalFocus.trim();
    if (!focus) { setGoalErr('Type the focus area first.'); return; }
    setGoalErr('');
    setBusy(true);
    setError('');
    try {
      const url = editingGoalId ? `${base}/goals/${editingGoalId}` : `${base}/goals`;
      const res = await fetch(url, {
        method: editingGoalId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusArea: focus, note: goalNote.trim() || null, tagId: goalTagId,
          success: goalSuccess.trim() || null, reviewOn: goalReviewOn || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save — try again.');
      setGoalFormOpen(false);
      const wasEdit = !!editingGoalId;
      setEditingGoalId(null);
      // On edit, keep the LOCAL status: the form never changes status, and a status PATCH may
      // be in flight — the server echo could carry the pre-flip value and stomp it.
      setData(d => d ? {
        ...d,
        goals: wasEdit
          ? d.goals.map(g => g.id === json.goal.id ? { ...json.goal, status: g.status } : g)
          : [...d.goals, json.goal],
      } : d);
      if (!wasEdit) setSelectedGoalId(json.goal.id);
      flashSaved(wasEdit ? null : { kind: 'goal', id: json.goal.id });
    } catch (e) {
      setGoalErr(e instanceof Error ? e.message : 'Could not save — try again.');
      setGoalFormOpen(true);
    } finally {
      setBusy(false);
    }
  }

  /** The one-tap status pill (kept — F19): it now APPENDS a status-only review, dated today. */
  async function cycleGoalStatus(goal: RepPlayerDevelopmentGoal) {
    if (statusInFlightRef.current.has(goal.id)) return;
    const prev = goal.status;
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(prev) + 1) % STATUS_ORDER.length];
    statusInFlightRef.current.add(goal.id);
    setData(d => d ? { ...d, goals: d.goals.map(g => g.id === goal.id ? { ...g, status: next } : g) } : d);
    try {
      const res = await fetch(`${base}/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, reviewedOn: todayLocal() }),
      });
      if (!res.ok) throw new Error();
      // The review the status rode on is now on the record — re-read so the timeline shows it.
      load();
    } catch {
      setData(d => d ? {
        ...d,
        goals: d.goals.map(g => g.id === goal.id && g.status === next ? { ...g, status: prev } : g),
      } : d);
      setError("Couldn't save the status change — try again.");
    } finally {
      statusInFlightRef.current.delete(goal.id);
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
      flashSaved(null);
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
      setGoalFormOpen(false);
      setEditingGoalId(null);
      setData(d => d ? { ...d, goals: d.goals.filter(g => g.id !== goalId), reviews: d.reviews.filter(r => r.goalId !== goalId) } : d);
      if (selectedGoalId === goalId) setSelectedGoalId(null);
      clearFlashFor(goalId);
    } catch {
      setGoalErr("Couldn't remove it — try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── observations ──
  async function submitObservation(v: { measurableTypeId: string; observedOn: string; note: string; descriptor: string; goalId: string | null }) {
    if (!obsDialog || busy) return;
    setBusy(true);
    setObsErr('');
    try {
      const editing = obsDialog.editing;
      const res = await fetch(editing ? `${base}/observations/${editing.id}` : `${base}/observations`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing
          ? { observedOn: v.observedOn, note: v.note || null, descriptor: v.descriptor || null, goalId: v.goalId }
          : { measurableTypeId: v.measurableTypeId, observedOn: v.observedOn, note: v.note || null, descriptor: v.descriptor || null, goalId: v.goalId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the observation — try again.');
      setData(d => d ? {
        ...d,
        observations: editing
          ? d.observations.map(o => o.id === editing.id ? json.observation : o)
          : [json.observation, ...d.observations].sort((a, b) => b.observedOn.localeCompare(a.observedOn) || b.createdAt.localeCompare(a.createdAt)),
      } : d);
      setObsDialog(null);
      flashSaved(editing ? null : { kind: 'observation', id: json.observation.id });
    } catch (e) {
      setObsErr(e instanceof Error ? e.message : 'Could not save the observation — try again.');
    } finally {
      setBusy(false);
    }
  }
  async function deleteObservation(id: string) {
    if (busy) return;
    const ok = await confirm({
      title: 'Remove this observation?', message: 'For fixing a mis-entry — a dated record of what you saw goes with it.',
      confirmText: 'Remove', cancelText: 'Cancel', tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/observations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setData(d => d ? { ...d, observations: d.observations.filter(o => o.id !== id) } : d);
      clearFlashFor(id);
    } catch {
      setError("Couldn't remove the observation — try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── results ──
  async function createType(onErr: (msg: string) => void): Promise<RepTeamMeasurableType | null> {
    if (busy) return null;
    setBusy(true);
    try {
      const res = await fetch(typesBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTypeName, unit: newTypeUnit }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        onErr(json?.error ?? 'Could not add the test — try again.');
        return null;
      }
      setNewTypeName('');
      setNewTypeUnit('');
      setNewTypeOpen(false);
      setData(d => d ? {
        ...d,
        types: [...d.types, json.type].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      } : d);
      return json.type;
    } catch {
      onErr('Could not add the test — try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** "Record a result" (F20 — the old label is gone) — the single dated reading, no session; feeds the same rows. */
  async function recordResult() {
    if (busy) return;
    if (logValue.trim() === '') { setLogErr('Enter the result first.'); return; }
    const value = Number(logValue);
    if (!Number.isFinite(value)) { setLogErr('The result needs to be a number (like 8.42).'); return; }
    if (value < 0 || value > 99999) { setLogErr('Value must be between 0 and 99,999.'); return; }
    if (!logTypeId) { setLogErr('Pick a test first.'); return; }
    setLogErr('');
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${base}/measurables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurableTypeId: logTypeId, value, recordedOn: logDate, note: logNote.trim() || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the result — try again.');
      setLogValue('');
      setLogNote('');
      setLogOpen(false);
      setData(d => d ? {
        ...d,
        measurables: [json.entry, ...d.measurables].sort((a, b) =>
          b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt)),
      } : d);
      setExpandedTypeId(logTypeId);
      flashSaved({ kind: 'entry', id: json.entry.id });
    } catch (e) {
      setLogErr(e instanceof Error ? e.message : 'Could not save the result — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(entryId: string) {
    if (busy) return;
    const ok = await confirm({
      title: 'Remove this reading?',
      message: 'This deletes the saved value — for fixing a mis-entry.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/measurables/${entryId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setData(d => d ? { ...d, measurables: d.measurables.filter(e => e.id !== entryId) } : d);
      clearFlashFor(entryId);
    } catch {
      setError("Couldn't remove the reading — try again.");
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
      if (copied.length > 0) flashSaved(null);
    } catch (e) {
      setCarryErr(e instanceof Error ? e.message : "Couldn't save that — try again.");
    } finally {
      setCarryBusy(false);
    }
  }

  /** "View {season} record" — opens the Previous seasons view on that season (never a navigation). */
  function viewOldRecord(priorRosterId: string) {
    chooseView('archive');
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
  // Measured TESTS only for a reading; the active skills for an observation.
  const activeTypes = activeMeasuredTests(data.types);
  const activeSkills = data.types.filter(t => t.kind === 'skill' && t.isActive);
  const selectedLogType = activeTypes.find(t => t.id === logTypeId) ?? null;
  const newTypeFormOpen = newTypeOpen || activeTypes.length === 0;
  const typeRows = derived.typeRows;

  const goalPill = (status: RepDevelopmentGoalStatus) =>
    status === 'achieved' ? styles.badgeActive : status === 'working' ? styles.badgeCompleted : styles.badgeDraft;

  // The views this coach may open. Goals and Observations ride notes; Results rides record access.
  const views: { id: DevelopmentView; label: string }[] = [
    ...(data.showGoals ? [{ id: 'goals' as const, label: 'Goals' }] : []),
    ...(data.showMeasurables ? [{ id: 'results' as const, label: 'Results' }] : []),
    ...(data.showGoals ? [{ id: 'observations' as const, label: 'Observations' }] : []),
    { id: 'archive' as const, label: 'Previous seasons' },
  ];
  const activeView: DevelopmentView = view && views.some(v => v.id === view) ? view : views[0].id;
  const selectedGoal = data.goals.find(g => g.id === selectedGoalId) ?? data.goals[0] ?? null;
  const { skillById, goalById } = derived;
  const linkedToSelected = selectedGoal ? data.observations.filter(o => o.goalId === selectedGoal.id) : [];

  return (
    <>
      {/* No title of its own: the profile page's collapse summary carries "Development" now. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {savedFlash && (
            <span style={{ fontSize: '0.75rem', color: 'var(--logic-lime)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Check size={12} /> Saved
              {lastCreated && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem' }} onClick={undoLastCreate}>
                  Undo
                </button>
              )}
            </span>
          )}
          {data.showMeasurables && (
            <Link href={metricsHref} className={`btn btn-ghost ${styles.devSectionAction}`}
              style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Settings2 size={13} /> Metrics
            </Link>
          )}
        </div>
      </div>

      {error && <p className={styles.errorText} role="alert">{error}</p>}

      {/* ── Returning player? (3C — UNCHANGED, above the views) ── */}
      {canWrite && continuity.length > 0 && (
        <div style={{ marginBottom: '0.9rem' }}>
          {continuity.map(row => row.status === 'confirmed' ? (
            <p key={row.linkId} className={styles.devCardNote} style={{ marginBottom: '0.35rem' }}>
              Linked to your {row.prior.seasonLabel} record
              {row.decidedAt ? ` — confirmed ${formatShortInstant(row.decidedAt)}` : ''}.{' '}
              <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem' }}
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
            They&apos;ll join this season as &ldquo;Working on it&rdquo;. Readings never carry over — last season&apos;s stay in Previous seasons. You can look first.
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

      {/* ── The four views — ONE segmented control (F14: inside the section, never a fourth tab) ── */}
      <div className={styles.segChoice} role="group" aria-label="Development views" style={{ marginBottom: '0.8rem', maxWidth: '100%', flexWrap: 'wrap' }}>
        {views.map(v => (
          <button key={v.id} type="button" aria-pressed={activeView === v.id}
            className={`${styles.segBtn} ${styles.tapFloor}${activeView === v.id ? ' ' + styles.segBtnActive : ''}`}
            onClick={() => chooseView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ══ GOALS ══ */}
      {activeView === 'goals' && data.showGoals && (
        <>
          {/* Tryout snapshot — where the season started, above the goals (it is what they were chosen from; R4). */}
          {data.tryoutBaseline && <TryoutSnapshotCard snapshot={data.tryoutBaseline} variant="card" />}

          <div className={styles.devCardHeadRow}>
            <p className={styles.miniListLabel} style={{ margin: 0 }}>Goals</p>
            {canWriteGoals && !goalFormOpen && (
              <button type="button" className={`btn btn-ghost ${styles.devSectionAction}`}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => openGoalForm(null)}>
                <Plus size={13} /> Add goal
              </button>
            )}
          </div>
          {data.goals.length === 0 && !goalFormOpen && (
            <p className={styles.detailPlaceholder}>
              {canWriteGoals ? 'No goals yet — add the first thing this player is working on.' : 'No goals yet.'}
            </p>
          )}
          {data.goals.length > 0 && (
            <ul className={styles.miniList}>
              {data.goals.map(g => (
                <li key={g.id} id={`dev-goal-${g.id}`} aria-current={selectedGoal?.id === g.id ? 'true' : undefined}
                  className={`${styles.miniRow}${flashRowId === `dev-goal-${g.id}` ? ` ${styles.collapseFlash}` : ''}`}
                  style={selectedGoal?.id === g.id ? { background: 'var(--home-card, rgba(255,255,255,0.05))' } : undefined}>
                  <span className={`${styles.miniRowMain} ${styles.miniRowMainWrap}`}>
                    <button type="button"
                      className={styles.tapFloor} style={{ background: 'none', border: 'none', padding: '0.6rem 0', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                      aria-pressed={selectedGoal?.id === g.id}
                      onClick={() => setSelectedGoalId(g.id)}>
                      {g.focusArea}
                    </button>
                    {g.tagId && focusTagById.has(g.tagId) && (
                      <span className={`${styles.badge} ${styles.badgeDraft}`} style={{ marginLeft: '0.4rem' }}>{focusTagById.get(g.tagId)!.name}</span>
                    )}
                    <span className={styles.devCardNote}>
                      {[originSentence(g.origin), author(g.createdBy) ? `written by ${author(g.createdBy)}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {canWriteGoals ? (
                    <button type="button"
                      className={`${styles.badge} ${styles.tapFloor} ${goalPill(g.status)}`}
                      style={{ cursor: 'pointer' }}
                      title="Tap to change status — a dated review is added"
                      onClick={() => cycleGoalStatus(g)}>
                      {STATUS_LABELS[g.status]}
                    </button>
                  ) : (
                    <span className={`${styles.badge} ${goalPill(g.status)}`}>{STATUS_LABELS[g.status]}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canWriteGoals && goalFormOpen && (
            <div className={styles.formGrid} style={{ margin: '0.6rem 0 1.1rem' }}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="dev-goal-focus">Focus area</label>
                <input id="dev-goal-focus" className={styles.input} type="text" value={goalFocus}
                  onChange={e => setGoalFocus(e.target.value)} maxLength={80}
                  placeholder="e.g. First-step quickness off the bag" autoFocus />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="dev-goal-note">Note (optional)</label>
                <input id="dev-goal-note" className={styles.input} type="text" value={goalNote}
                  onChange={e => setGoalNote(e.target.value)} maxLength={280}
                  placeholder="One short note the player would be happy to read" />
              </div>
              {/* "More" — success, review date, tag (F08, F11, F17). A goal can still be one line of text. */}
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <button type="button" className={`btn btn-ghost ${styles.tapFloor}`} style={{ fontSize: '0.78rem', alignSelf: 'flex-start' }}
                  aria-expanded={goalMoreOpen} onClick={() => setGoalMoreOpen(o => !o)}>
                  {goalMoreOpen ? 'Less' : 'More — success, review date, tag'}
                </button>
              </div>
              {goalMoreOpen && (
                <>
                  <div className={`${styles.field} ${styles.formGridFull}`}>
                    <label className={styles.label} htmlFor="dev-goal-success">What would success look like? (optional)</label>
                    <input id="dev-goal-success" className={styles.input} type="text" value={goalSuccess}
                      onChange={e => setGoalSuccess(e.target.value)} maxLength={280}
                      placeholder="e.g. sets feet without a cue in the partner drill" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="dev-goal-review">Review on (optional)</label>
                    <input id="dev-goal-review" className={styles.input} type="date" value={goalReviewOn}
                      onChange={e => setGoalReviewOn(e.target.value)} />
                  </div>
                  <div className={`${styles.field} ${styles.formGridFull}`}>
                    <TagPicker
                      all={focusTags}
                      selected={goalTagId ? [goalTagId] : []}
                      onChange={next => setGoalTagId(next[0] ?? null)}
                      onCreate={createFocusTag}
                      single
                      label="Focus tag (optional)"
                      placeholder="Group it with a focus word…"
                      emptyHint="No focus words yet — type one to make your team’s first."
                      manage={{ ...FOCUS_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/focus-tags` }}
                      onManageChanged={reloadFocusTags}
                    />
                  </div>
                </>
              )}
              <div className={`${styles.field} ${styles.formGridFull}`} style={{ flexDirection: 'row', display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.35rem' }}>
                <button type="button" className="btn btn-lime" style={{ fontSize: '0.8rem' }} disabled={busy} onClick={saveGoal}>
                  {editingGoalId ? 'Save' : 'Add it'}
                </button>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
                  onClick={() => { setGoalFormOpen(false); setEditingGoalId(null); setGoalErr(''); }}>
                  Discard
                </button>
                {editingGoalId && (
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem', marginLeft: 'auto', color: 'var(--danger)' }}
                    onClick={() => deleteGoal(editingGoalId)}>
                    <X size={12} /> Remove
                  </button>
                )}
              </div>
              {goalErr && (
                <p className={`${styles.errorText} ${styles.formGridFull}`} role="alert">{goalErr}</p>
              )}
            </div>
          )}

          {/* The selected goal: its facts, its actions, its history (set → observed → reviewed). */}
          {selectedGoal && !goalFormOpen && (
            <div className={styles.detailSection} style={{ marginTop: '0.6rem' }}>
              <p className={styles.miniListLabel} style={{ marginTop: 0 }}>Selected goal</p>
              <p style={{ margin: '0 0 0.4rem', fontWeight: 600 }}>{selectedGoal.focusArea}</p>
              {selectedGoal.note && <p className={styles.devCardNote} style={{ marginBottom: '0.4rem' }}>{selectedGoal.note}</p>}
              <ul className={styles.miniList}>
                <li className={styles.miniRow}>
                  <span className={styles.miniRowMain} style={{ fontWeight: 600 }}>Success looks like</span>
                  <span className={styles.miniRowMeta} style={{ whiteSpace: 'normal' }}>{selectedGoal.success ?? <span className={styles.devRowDash}>not written yet</span>}</span>
                </li>
                <li className={styles.miniRow}>
                  <span className={styles.miniRowMain} style={{ fontWeight: 600 }}>Next review</span>
                  <span className={styles.miniRowMeta}>{selectedGoal.reviewOn ? formatShortDate(selectedGoal.reviewOn) : <span className={styles.devRowDash}>no review date set</span>}</span>
                </li>
                <li className={styles.miniRow}>
                  <span className={styles.miniRowMain} style={{ fontWeight: 600 }}>Status</span>
                  <span className={`${styles.badge} ${goalPill(selectedGoal.status)}`}>{STATUS_LABELS[selectedGoal.status]}</span>
                </li>
              </ul>
              {canWriteGoals && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.6rem 0' }}>
                  <button type="button" className={`btn btn-lime ${styles.tapFloor}`} style={{ fontSize: '0.8rem' }} onClick={() => { setReviewErr(''); setReviewingGoal(selectedGoal); }}>Review goal</button>
                  <button type="button" className={`btn btn-ghost ${styles.tapFloor}`} style={{ fontSize: '0.8rem' }} disabled={activeSkills.length === 0}
                    title={activeSkills.length === 0 ? 'Define an observed skill in Metrics first' : undefined}
                    onClick={() => { setObsErr(''); setObsDialog({ editing: null, goalId: selectedGoal.id }); }}>Record an observation</button>
                  <button type="button" className={`btn btn-ghost ${styles.tapFloor}`} style={{ fontSize: '0.8rem' }} onClick={() => openGoalForm(selectedGoal)}>Edit wording</button>
                </div>
              )}
              <p className={styles.miniListLabel}>How this goal has developed</p>
              <ul className={styles.miniList}>
                {goalTimeline(selectedGoal, data.reviews, data.observations).map((ev, i) => (
                  <li key={`${ev.kind}-${ev.reviewId ?? ev.observationId ?? i}`} className={styles.miniRow} style={{ flexWrap: 'wrap' }}>
                    <span className={`${styles.miniRowMain} ${styles.miniRowMainWrap}`}>
                      <strong>{ev.title}</strong>
                      {ev.text && <span className={styles.devCardNote}>{ev.text}</span>}
                      {ev.kind === 'review' && ev.nextReviewOn && <span className={styles.devCardNote}>Next review {formatShortDate(ev.nextReviewOn)}</span>}
                    </span>
                    <span className={styles.miniRowMeta}>
                      {formatShortDate(ev.on)}{author(ev.by) ? ` · ${ev.kind === 'set' ? 'written by' : 'by'} ${author(ev.by)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.devCardNote} style={{ marginTop: '0.35rem' }}>Every review is a dated event — nothing overwrites the previous one.</p>
            </div>
          )}
        </>
      )}

      {/* ══ RESULTS ══ */}
      {activeView === 'results' && data.showMeasurables && (
        <>
          <div className={styles.devCardHeadRow}>
            <p className={styles.miniListLabel} style={{ margin: 0 }}>Results</p>
            {canWrite && !logOpen && (
              <button type="button" className={`btn btn-ghost ${styles.devSectionAction}`}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => {
                  setLogOpen(true);
                  setLogErr('');
                  setLogDate(todayLocal());
                  if (!logTypeId && activeTypes.length > 0) setLogTypeId(activeTypes[0].id);
                }}>
                <Plus size={13} /> Record a result
              </button>
            )}
          </div>
          <p className={styles.devCardNote} style={{ marginBottom: '0.5rem' }}>
            A single dated reading from a notebook — no session needed. Feeds the same records a session does.
          </p>
          {typeRows.length === 0 && !logOpen && (
            <p className={styles.detailPlaceholder}>
              {canWrite
                ? 'No results yet — set up your first test (like a 60-yd sprint) and record a result.'
                : 'No results recorded yet.'}
            </p>
          )}
          {typeRows.length > 0 && (
            <ul className={styles.miniList}>
              {typeRows.map(({ type, sessions, latest, chronoDrawable, splitNote }) => (
                <li key={type.id} id={`dev-metric-${type.id}`} className={`${styles.miniRow}${flashRowId === `dev-metric-${type.id}` ? ` ${styles.collapseFlash}` : ''}`} style={{ flexWrap: 'wrap' }}>
                  <span className={`${styles.miniRowMain} ${styles.miniRowMainWrap}`}>
                    <button type="button"
                      className={styles.tapFloor} style={{ background: 'none', border: 'none', padding: '0.6rem 0', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                      aria-expanded={expandedTypeId === type.id}
                      onClick={() => setExpandedTypeId(id => id === type.id ? null : type.id)}>
                      {type.name}{!type.isActive && ' (retired)'}
                    </button>
                    <span className={styles.devCardNote}>
                      {type.unit} · {type.aim === 'lower' ? 'lower is the aim' : type.aim === 'higher' ? 'higher is the aim' : type.aim === 'range' ? `aim ${formatValue(type.rangeFrom ?? 0)}–${formatValue(type.rangeTo ?? 0)}` : 'record only'}
                      {' · '}{sessions.length} {sessions.length === 1 ? 'result' : 'results'}
                      {sessions.some(s => s.attempts.length > 1) && ` · ${sessions.reduce((n, s) => n + s.attempts.length, 0)} attempts`}
                    </span>
                  </span>
                  {latest ? (
                    <>
                      <span className={styles.miniRowMeta} style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {headlineLabel(latest, type)}
                        {headlineMethod(latest, type) && <span className={styles.devRowDash}> · {headlineMethod(latest, type)}</span>}
                      </span>
                      {chronoDrawable.length >= 2
                        ? <Sparkline values={chronoDrawable.slice(-10)} />
                        : <span className={styles.miniRowMeta} style={{ fontStyle: 'italic' }}>trend shows after a second result</span>}
                      <span className={styles.miniRowMeta}>{formatShortDate(latest.recordedOn)}</span>
                      {splitNote && <span className={styles.devCardNote} style={{ flexBasis: '100%' }}>{splitNote}</span>}
                    </>
                  ) : (
                    <span className={styles.miniRowMeta}>no results yet</span>
                  )}
                  {expandedTypeId === type.id && sessions.length > 0 && (
                    <ul className={styles.miniList} style={{ flexBasis: '100%', marginTop: '0.4rem' }}>
                      {sessions.map(r => <ResultRow key={r.key} row={r} type={type} portalBase={portalBase} author={author} canWrite={canWrite} onDelete={deleteEntry} />)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canWrite && logOpen && (
            <div className={styles.formGrid} style={{ margin: '0.6rem 0 1.1rem' }}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <span className={styles.label}>Test</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {activeTypes.map(t => (
                    <button key={t.id} type="button"
                      className={`${styles.badge} ${styles.tapFloor} ${logTypeId === t.id ? styles.badgeActive : styles.badgeDraft}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLogTypeId(t.id)}>
                      {t.name}
                    </button>
                  ))}
                  {activeTypes.length > 0 && (
                    <button type="button" className={`${styles.badge} ${styles.badgeDraft} ${styles.tapFloor}`} style={{ cursor: 'pointer' }}
                      onClick={() => setNewTypeOpen(o => !o)}>
                      + New test…
                    </button>
                  )}
                </div>
              </div>
              {newTypeFormOpen && (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <NewTypeFields idPrefix="dev-newtype" name={newTypeName} unit={newTypeUnit}
                    onName={setNewTypeName} onUnit={setNewTypeUnit} metricsHref={metricsHref}
                    onAdd={async () => {
                      if (!newTypeName.trim() || !newTypeUnit.trim()) {
                        setLogErr('Give the test a name and a unit (like seconds).');
                        return;
                      }
                      setLogErr('');
                      const created = await createType(setLogErr);
                      if (created) setLogTypeId(created.id);
                    }} />
                </div>
              )}
              {selectedLogType ? (
                <>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="dev-log-value">Result ({selectedLogType.unit})</label>
                    <input id="dev-log-value" className={styles.input} type="text" inputMode="decimal" value={logValue}
                      onChange={e => setLogValue(e.target.value)} maxLength={9} placeholder="8.42" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="dev-log-date">Date</label>
                    <input id="dev-log-date" className={styles.input} type="date" value={logDate}
                      onChange={e => setLogDate(e.target.value)} />
                  </div>
                  <div className={`${styles.field} ${styles.formGridFull}`}>
                    <label className={styles.label} htmlFor="dev-log-note">Note (optional)</label>
                    <input id="dev-log-note" className={styles.input} type="text" value={logNote}
                      onChange={e => setLogNote(e.target.value)} maxLength={200} placeholder='e.g. "after warm-up, turf"' />
                  </div>
                  <div className={`${styles.field} ${styles.formGridFull}`} style={{ flexDirection: 'row', display: 'flex', gap: '0.6rem', marginTop: '0.35rem' }}>
                    <button type="button" className="btn btn-lime" style={{ fontSize: '0.8rem' }} disabled={busy} onClick={recordResult}>
                      Save result
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
                      onClick={() => { setLogOpen(false); setLogValue(''); setLogNote(''); setLogErr(''); }}>
                      Discard
                    </button>
                  </div>
                  {logErr && (
                    <p className={`${styles.errorText} ${styles.formGridFull}`} role="alert">{logErr}</p>
                  )}
                </>
              ) : (
                <>
                  <div className={`${styles.field} ${styles.formGridFull}`} style={{ flexDirection: 'row', display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.35rem' }}>
                    <span className={styles.miniRowMeta}>
                      {activeTypes.length === 0
                        ? 'Set up your first test above — then you can record a result.'
                        : 'Pick a test above to record a result.'}
                    </span>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem', marginLeft: 'auto' }}
                      onClick={() => { setLogOpen(false); setLogErr(''); }}>
                      Close
                    </button>
                  </div>
                  {logErr && (
                    <p className={`${styles.errorText} ${styles.formGridFull}`} role="alert">{logErr}</p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ OBSERVATIONS ══ */}
      {activeView === 'observations' && data.showGoals && (
        <>
          <div className={styles.devCardHeadRow}>
            <p className={styles.miniListLabel} style={{ margin: 0 }}>Observations</p>
            {canWriteGoals && (
              <button type="button" className={`btn btn-ghost ${styles.devSectionAction}`}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                disabled={activeSkills.length === 0}
                title={activeSkills.length === 0 ? 'Define an observed skill in Metrics first' : undefined}
                onClick={() => { setObsErr(''); setObsDialog({ editing: null, goalId: null }); }}>
                <Plus size={13} /> Record an observation
              </button>
            )}
          </div>
          <p className={styles.devCardNote} style={{ marginBottom: '0.5rem' }}>
            What you saw, in a stated setting — a record, never an overall rating. Visible to coaches with Internal notes.
          </p>
          {data.observations.length === 0 ? (
            <p className={styles.detailPlaceholder}>
              {activeSkills.length === 0
                ? (canWrite ? 'No observed skill is defined yet — define one in Metrics, then record what you see.' : 'No observed skill is defined yet.')
                : canWriteGoals ? 'No observations yet — record the first thing you saw.' : 'No observations yet.'}
            </p>
          ) : (
            // One timeline per skill, library order; each newest first.
            [...new Map(data.observations.map(o => [o.measurableTypeId, o])).keys()]
              .map(id => skillById.get(id))
              .filter((t): t is RepTeamMeasurableType => !!t)
              .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
              .map(skill => (
                <div key={skill.id} style={{ marginBottom: '0.8rem' }}>
                  <p style={{ margin: '0 0 0.2rem', fontWeight: 600 }}>{skill.name}{!skill.isActive && ' (retired)'}</p>
                  <ul className={styles.miniList}>
                    {data.observations.filter(o => o.measurableTypeId === skill.id).map(o => (
                      <li key={o.id} className={styles.miniRow} style={{ flexWrap: 'wrap' }}>
                        <span className={`${styles.miniRowMain} ${styles.miniRowMainWrap}`}>
                          {o.descriptor && <strong>{o.descriptor}</strong>}
                          {o.descriptor && o.note ? ' — ' : ''}{o.note}
                          <span className={styles.devCardNote}>
                            {[
                              o.sessionId ? 'in an evaluation session' : null,
                              o.goalId && goalById.has(o.goalId) ? `Evidence for: ${goalById.get(o.goalId)!.focusArea}` : null,
                              author(o.createdBy) ? `written by ${author(o.createdBy)}` : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className={styles.miniRowMeta}>{formatShortDate(o.observedOn)}</span>
                        {canWriteGoals && (
                          <>
                            <button type="button" className={`btn btn-ghost ${styles.tapFloor}`} style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem' }}
                              onClick={() => { setObsErr(''); setObsDialog({ editing: o, goalId: o.goalId }); }}>Edit</button>
                            <button type="button" className={`btn btn-ghost ${styles.tapFloorSquare}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}
                              aria-label="Remove this observation" onClick={() => deleteObservation(o.id)}>
                              <X size={11} />
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
        </>
      )}

      {/* ══ PREVIOUS SEASONS (3D, M5 — the scrapbook, as a view; NO cross-season deltas anywhere) ══ */}
      {activeView === 'archive' && (
        data.archive.length === 0 ? (
          <p className={styles.detailPlaceholder}>No previous season is linked to this player.</p>
        ) : (
          <>
            <p className={styles.miniListLabel} style={{ marginTop: 0 }}>Previous seasons</p>
            <ul className={styles.miniList}>
              {data.archive.map(season => {
                const achieved = season.goals.filter(g => g.status === 'achieved').length;
                const entryCount = season.tests.reduce((n, t) => n + t.entries.length, 0);
                const summaryParts = [
                  season.goals.length > 0
                    ? `${season.goals.length} goal${season.goals.length === 1 ? '' : 's'}${achieved > 0 ? ` (${achieved} achieved)` : ''}`
                    : null,
                  entryCount > 0 ? `${entryCount} result${entryCount === 1 ? '' : 's'}` : null,
                  season.attendancePct != null ? `attendance ${season.attendancePct}%` : null,
                ].filter(Boolean);
                const expanded = expandedSeasonId === season.priorRosterId;
                return (
                  <li key={season.priorRosterId} id={`dev-archive-${season.priorRosterId}`}
                    className={styles.miniRow} style={{ flexWrap: 'wrap' }}>
                    <span className={`${styles.miniRowMain} ${styles.miniRowMainWrap}`}>
                      <button type="button"
                        className={styles.tapFloor} style={{ background: 'none', border: 'none', padding: '0.6rem 0', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                        aria-expanded={expanded}
                        onClick={() => setExpandedSeasonId(id => id === season.priorRosterId ? null : season.priorRosterId)}>
                        {season.seasonLabel}
                      </button>
                      <span className={styles.devCardNote}>
                        {summaryParts.length > 0 ? summaryParts.join(' · ') : 'no development records that season'}
                      </span>
                    </span>
                    <span className={`${styles.badge} ${styles.badgeDraft}`}>Archive</span>
                    {expanded && (summaryParts.length > 0 ? (
                      <div style={{ flexBasis: '100%', marginTop: '0.4rem' }}>
                        {season.goals.length > 0 && (
                          <ul className={styles.miniList}>
                            {season.goals.map((g, i) => (
                              <li key={i} className={styles.miniRow}>
                                <span className={styles.miniRowMain}>
                                  {g.focusArea}
                                  {g.note && <span className={styles.devCardNote}>{g.note}</span>}
                                </span>
                                <span className={`${styles.badge} ${goalPill(g.status as RepDevelopmentGoalStatus)}`}>
                                  {STATUS_LABELS[g.status as RepDevelopmentGoalStatus] ?? g.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {season.tests.length > 0 && (
                          <ul className={styles.miniList} style={season.goals.length > 0 ? { marginTop: '0.35rem' } : undefined}>
                            {season.tests.map(t => (
                              <li key={t.name} className={styles.miniRow} style={{ flexWrap: 'wrap' }}>
                                <span className={styles.miniRowMain}>{t.name}</span>
                                <span className={styles.miniRowMeta} style={{ whiteSpace: 'normal', fontVariantNumeric: 'tabular-nums' }}>
                                  {t.entries.map(e => `${formatValue(e.value)} ${e.unit} (${formatShortDate(e.recordedOn)})`).join(' · ')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null)}
                  </li>
                );
              })}
            </ul>
            <p className={styles.devCardNote} style={{ margin: '0.35rem 0 1rem' }}>
              Shown as a record, side by side — never a computed &ldquo;better or worse than last year.&rdquo; Attendance and playing time stay on their own tabs of the player record.
            </p>
          </>
        )
      )}

      {/* ── The handout (3D, M1; Phase 3 screen 6) — a page of its own where the coach CHOOSES what
          belongs in this conversation, previews the paper and prints it. Was "Print summary (PDF)",
          which sent the whole log with no preview and no choice (F13). Carries the way back to this
          view. Current season only; the old PDF's boundary unchanged. ── */}
      {(data.goals.length > 0 || data.measurables.length > 0 || data.observations.length > 0) && (
        <div style={{ marginTop: '0.7rem' }}>
          <Link href={developmentHandoutHref(portalBase, playerId, { returnTo: playerDevelopmentHref(portalBase, playerId, { view: activeView, returnTo: arrival.returnTo }) })}
            className={`btn btn-ghost ${styles.tapFloor}`}
            style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Printer size={13} /> Preview development handout
          </Link>
        </div>
      )}

      {reviewingGoal && (
        <ReviewGoalDialog goal={reviewingGoal} linkedObservations={linkedToSelected.filter(o => o.goalId === reviewingGoal.id)}
          busy={busy} error={reviewErr} onSubmit={submitReview} onClose={() => { if (!busy) setReviewingGoal(null); }} />
      )}
      {obsDialog && (
        <RecordObservationDialog skills={activeSkills} goals={data.goals} editing={obsDialog.editing} presetGoalId={obsDialog.goalId}
          busy={busy} error={obsErr} onSubmit={submitObservation} onClose={() => { if (!busy) setObsDialog(null); }} />
      )}
    </>
  );
}

/** One result row: a session (every attempt, best/average or k of N in range) or a single reading. */
function ResultRow({ row, type, portalBase, author, canWrite, onDelete }: {
  row: SessionResult<RepPlayerMeasurable>;
  type: RepTeamMeasurableType;
  portalBase: string;
  author: (id: string | null) => string | null;
  canWrite: boolean;
  onDelete: (entryId: string) => void;
}) {
  const single = row.attempts.length === 1 && !row.sessionId;
  const first = row.attempts[0];
  const by = author(first.createdBy);
  return (
    <li className={styles.miniRow} style={{ flexWrap: 'wrap' }}>
      <span className={`${styles.miniRowMain} ${styles.miniRowMainWrap}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        <strong>{headlineLabel(row, type)}</strong>
        {row.attempts.length > 1 && <span className={styles.devCardNote}>{row.readBack}</span>}
        {row.attempts.some(a => a.correctedFrom != null) && (
          <span className={styles.devCardNote}>corrected — was {row.attempts.filter(a => a.correctedFrom != null).map(a => formatValue(a.correctedFrom!)).join(' · ')}</span>
        )}
        {row.attempts.some(a => a.note) && <span className={styles.devCardNote}>{row.attempts.map(a => a.note).filter(Boolean).join(' · ')}</span>}
      </span>
      <span className={styles.miniRowMeta}>{formatShortDate(row.recordedOn)}</span>
      <span className={styles.miniRowMeta}>
        {row.sessionId ? <Link href={`${portalBase}/development/sessions/${row.sessionId}`} className={`${styles.devTailLink} ${styles.tapFloor}`} style={{ display: 'inline-flex', alignItems: 'center' }}>Session →</Link> : 'Single reading'}
        {by ? ` · entered by ${by}` : ''}
      </span>
      {canWrite && single && (
        <button type="button" className={`btn btn-ghost ${styles.tapFloorSquare}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}
          aria-label="Remove this reading" onClick={() => onDelete(first.id)}>
          <X size={11} />
        </button>
      )}
    </li>
  );
}
