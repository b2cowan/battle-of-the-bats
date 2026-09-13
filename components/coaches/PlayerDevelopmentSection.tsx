'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Plus, X, Check, Settings2, Printer } from 'lucide-react';
import TagPicker from '@/components/coaches/TagPicker';
import { FOCUS_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import { useFocusTags } from '@/components/coaches/use-focus-tags';
import type { DevelopmentAddress } from '@/lib/development-address';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import Sparkline from '@/components/charts/Sparkline';
import { splitSeriesByUnit, drawableSegment, unitSplitNote } from '@/lib/measurable-series';
import { NewTypeFields } from '@/components/coaches/NewTypeFields';
import { activeMeasuredTests, measuredTestsWithHistory } from '@/lib/measurable-definition';
import { skillsAndGoalsHref } from '@/lib/development-address';
import ContinuityCompareCard from '@/components/coaches/ContinuityCompareCard';
import TryoutSnapshotCard from '@/components/coaches/TryoutSnapshotCard';
import { useContinuityLinks } from '@/lib/hooks/useContinuityLinks';
import { formatValue, todayLocal, formatShortDate, formatShortInstant } from '@/lib/measurable-format';
import {
  buildFilename, DEFAULT_PDF_SETTINGS, downloadDevelopmentSummary, fetchResolvedPdfSettings,
  type OrgPdfSettings,
} from '@/lib/export';
import type {
  RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerDevelopmentGoal, RepDevelopmentGoalStatus,
  RepTryoutBaselineSnapshot,
} from '@/lib/types';

const STATUS_LABELS: Record<RepDevelopmentGoalStatus, string> = {
  working: 'Working on it',
  achieved: 'Achieved',
  parked: 'Parked',
};
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
  /** The grant WITH Internal notes — goals (and the carry offer) draw on this, results on `canWrite`. */
  canWriteGoals: boolean;
  showGoals: boolean;
  showMeasurables: boolean;
  types: RepTeamMeasurableType[];
  measurables: RepPlayerMeasurable[];
  goals: RepPlayerDevelopmentGoal[];
  context: { fieldInnings: number; benchInnings: number } | null;
  archive: ArchiveSeason[];
  carry: { linkId: string; priorRosterId: string; priorSeasonLabel: string; workingCount: number } | null;
  /**
   * The frozen tryout snapshot, when this player was seeded from a tryout (Phase 2, R4).
   *
   * ⚠ Null for everyone else, AND null for any coach without the tryouts capability — the server
   * decides that, not this component. It renders as a CONTEXT artifact above the focus areas and
   * must never be folded into the measurables list or a trend.
   */
  tryoutBaseline: RepTryoutBaselineSnapshot | null;
}

// Returning-player continuity (3C) rides the shared useContinuityLinks hook + the
// ContinuityCompareCard — one plumbing + one compare surface across both verify doors.

interface Props {
  orgSlug: string;
  teamId: string;
  playerId: string;
  /** "Best" positions from the depth chart / position profile — quoted, never recomputed. */
  bestPositions: string[];
  /** Attendance % of recorded sessions, when any exist — quoted from the page's own data. */
  attendancePct: number | null;
  /** Identity + season lines for the printable summary (3D) — quoted from the page. */
  playerName: string;
  playerNumber: string | null;
  teamName: string;
  seasonName: string | null;
  /** The address the coach arrived on (view · metric · goal · the way back) — parsed once by the page. */
  arrival: DevelopmentAddress;
  /** Called once the addressed row has been opened and flashed, so a remount does not do it again. */
  onArrived: () => void;
}

// NewTypeFields lives in its own file (single home; acyclic import graph).

export default function PlayerDevelopmentSection({
  orgSlug, teamId, playerId, bestPositions, attendancePct, playerName, playerNumber, teamName, seasonName,
  arrival, onArrived,
}: Props) {
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/development`;
  const typesBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/measurable-types`;
  // The library's ONE editor (Phase 1): the Metrics tab. "Test types" used to open a dialog here.
  const metricsHref = skillsAndGoalsHref(`/${orgSlug}/coaches/teams/${teamId}`, 'metrics');
  const confirm = useConfirm();

  const [data, setData] = useState<DevelopmentData | null>(null);
  const [error, setError] = useState('');
  // "✓ Saved · Undo" for the most recent create — Undo deletes the just-created row.
  const [lastCreated, setLastCreated] = useState<{ kind: 'goal' | 'entry'; id: string } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalFocus, setGoalFocus] = useState('');
  const [goalNote, setGoalNote] = useState('');
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
  /**
   * The arrival address (Phase 1, F09): `?section=development` opens this section (the collapse
   * primitive's job); `view` + `metric` / `goal` say WHICH row the link meant, and it is opened and
   * flashed ONCE on arrival — the page owns the address and `onArrived` clears it, because this
   * section remounts on a tab switch and must not run the arrival again on the same address.
   */
  const [flashRowId, setFlashRowId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [logTypeId, setLogTypeId] = useState('');
  const [logValue, setLogValue] = useState('');
  const [logDate, setLogDate] = useState(todayLocal());
  const [logNote, setLogNote] = useState('');
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeUnit, setNewTypeUnit] = useState('');


  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(arrival.view === 'results' ? arrival.metricId : null);
  // Scroll the addressed row into view once the data has drawn it, then let the flash fade.
  useEffect(() => {
    if (!data) return;
    const rowId = arrival.view === 'results' && arrival.metricId ? `dev-metric-${arrival.metricId}`
      : arrival.view === 'goals' && arrival.goalId ? `dev-goal-${arrival.goalId}` : null;
    if (!rowId) return;
    const el = document.getElementById(rowId);
    if (!el) return;
    // After the row paints (the collapse primitive's own idiom), so the flash lands on a drawn row.
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

  // ── 3D: previous-seasons archive + the one-time carry-forward offer + print ──
  const [expandedSeasonId, setExpandedSeasonId] = useState<string | null>(null);
  const [carryBusy, setCarryBusy] = useState(false);
  const [carryErr, setCarryErr] = useState('');
  const [printBusy, setPrintBusy] = useState(false);

  // Inline validation shown right beside the button the coach pressed — a button that
  // silently does nothing is not an answer (owner feedback, 2026-07-17).
  const [goalErr, setGoalErr] = useState('');
  const [logErr, setLogErr] = useState('');
  // Head coach only (the payload carries prior-season guardian identity) — a null apiBase
  // disables the hook until canWrite is known true.
  const {
    byCurrent: continuityByCurrent, decide: decideContinuity, dismiss: dismissContinuity,
    busy: continuityBusy, error: continuityErr,
  } = useContinuityLinks(
    data?.canWrite ? `/api/coaches/${orgSlug}/teams/${teamId}/development/continuity` : null,
    'roster',
    playerId,
  );
  const continuity = continuityByCurrent[playerId] ?? [];
  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      // A non-JSON body (e.g. an HTML error page while the dev server is mid-compile, or a
      // gateway page) must never surface a raw parse error to a coach.
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load development — try again.');
      setData(json);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load development — try again.');
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  // One timer for the Saved · Undo banner — re-arming clears the old timer so a second
  // create within 4s gets its full window; cleared on unmount.
  const flashTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
  }, []);
  // In-flight status PATCHes per goal — blocks double-taps without freezing the whole card.
  const statusInFlightRef = useRef<Set<string>>(new Set());


  function flashSaved(created: { kind: 'goal' | 'entry'; id: string } | null) {
    setLastCreated(created);
    setSavedFlash(true);
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setSavedFlash(false), 4000);
  }

  /** Deleting the very row the Saved · Undo banner points at must retire the banner. */
  function clearFlashFor(id: string) {
    if (lastCreated?.id === id) {
      setLastCreated(null);
      setSavedFlash(false);
    }
  }

  async function undoLastCreate() {
    if (!lastCreated || busy) return;
    const { kind, id } = lastCreated;
    const url = kind === 'goal' ? `${base}/goals/${id}` : `${base}/measurables/${id}`;
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        setData(d => d ? (kind === 'goal'
          ? { ...d, goals: d.goals.filter(g => g.id !== id) }
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
        body: JSON.stringify({ focusArea: focus, note: goalNote.trim() || null, tagId: goalTagId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save — try again.');
      setGoalFormOpen(false);
      setGoalFocus('');
      setGoalNote('');
      setGoalTagId(null);
      const wasEdit = !!editingGoalId;
      setEditingGoalId(null);
      // Merge the mutation's own response locally — no full refetch (documents-section pattern).
      // On edit, keep the LOCAL status: the form never changes status, and a status PATCH may
      // be in flight — the server echo could carry the pre-flip value and stomp it.
      setData(d => d ? {
        ...d,
        goals: wasEdit
          ? d.goals.map(g => g.id === json.goal.id ? { ...json.goal, status: g.status } : g)
          : [...d.goals, json.goal],
      } : d);
      flashSaved(wasEdit ? null : { kind: 'goal', id: json.goal.id });
    } catch (e) {
      setGoalErr(e instanceof Error ? e.message : 'Could not save — try again.');
      setGoalFormOpen(true);
    } finally {
      setBusy(false);
    }
  }

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
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert ONLY if our optimistic value is still what's showing (a later action wins),
      // and say so — an offline tap must not leave a phantom status.
      setData(d => d ? {
        ...d,
        goals: d.goals.map(g => g.id === goal.id && g.status === next ? { ...g, status: prev } : g),
      } : d);
      setError("Couldn't save the status change — try again.");
    } finally {
      statusInFlightRef.current.delete(goal.id);
    }
  }

  async function deleteGoal(goalId: string) {
    if (busy) return;
    const ok = await confirm({
      title: 'Remove this focus area?',
      message: 'Removing is for mis-entries — to set a goal aside but keep it, use the Parked status instead.',
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
      setData(d => d ? { ...d, goals: d.goals.filter(g => g.id !== goalId) } : d);
      clearFlashFor(goalId);
    } catch {
      // Form stays open with an honest message — a failed delete must never look like success.
      setGoalErr("Couldn't remove it — try again.");
    } finally {
      setBusy(false);
    }
  }

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
        onErr(json?.error ?? 'Could not add the test type — try again.');
        return null;
      }
      setNewTypeName('');
      setNewTypeUnit('');
      setNewTypeOpen(false);
      // Merge locally in library order (sortOrder, then name) — no full refetch.
      setData(d => d ? {
        ...d,
        types: [...d.types, json.type].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      } : d);
      return json.type;
    } catch {
      onErr('Could not add the test type — try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function logMeasurable() {
    if (busy) return;
    if (logValue.trim() === '') { setLogErr('Enter the value first.'); return; }
    const value = Number(logValue);
    if (!Number.isFinite(value)) { setLogErr('The value needs to be a number (like 8.42).'); return; }
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
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not log it — try again.');
      setLogValue('');
      setLogNote('');
      // Logging is the finishing move — close the form (the header shows Saved · Undo).
      setLogOpen(false);
      // Merge locally, preserving newest-first (recordedOn, createdAt) order for backdated entries.
      setData(d => d ? {
        ...d,
        measurables: [json.entry, ...d.measurables].sort((a, b) =>
          b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt)),
      } : d);
      flashSaved({ kind: 'entry', id: json.entry.id });
    } catch (e) {
      setLogErr(e instanceof Error ? e.message : 'Could not log it — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(entryId: string) {
    if (busy) return;
    const ok = await confirm({
      title: 'Remove this reading?',
      message: 'This deletes the logged value — for fixing a mis-entry.',
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

  /** The one-time carry-forward answer (3D). 'carry' merges the copied focus areas into
   *  the card; either answer retires the banner. A 409 = answered in another tab — that
   *  answer stands, so the banner quietly retires without an error. */
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

  /** "View {season} record" — expands that archive season in place and scrolls to it
   *  (never a navigation: the prior season's profile page is editable). */
  function viewOldRecord(priorRosterId: string) {
    setExpandedSeasonId(priorRosterId);
    window.setTimeout(() => {
      document.getElementById(`dev-archive-${priorRosterId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  /** One-page family handout — current season only, no deltas, generated on this device
   *  (there is deliberately no shareable link). */
  async function printSummary() {
    if (printBusy || !data) return;
    setPrintBusy(true);
    setError('');
    try {
      // Team-resolved (D4): team look → club look → defaults, team name as the header identity.
      const fetched = await fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`);
      const settings: OrgPdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(fetched ?? {}) };
      const measurableRows: { test: string; reading: string; date: string; note: string | null }[] = [];
      for (const t of data.types) {
        // Library order; each test's readings oldest→newest — a dated log, never a computed trend.
        const entries = data.measurables.filter(e => e.measurableTypeId === t.id)
          .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn) || a.createdAt.localeCompare(b.createdAt));
        for (const e of entries) {
          measurableRows.push({
            test: t.name,
            reading: `${formatValue(e.value)} ${e.unit}`,
            date: formatShortDate(e.recordedOn),
            note: e.note,
          });
        }
      }
      await downloadDevelopmentSummary(
        buildFilename({ org: orgSlug, dataset: 'development', scope: playerName }, 'pdf'),
        {
          playerName,
          playerNumber: playerNumber ? `#${playerNumber}` : null,
          teamName,
          seasonLabel: seasonName,
          goals: data.goals.map(g => ({ focusArea: g.focusArea, status: STATUS_LABELS[g.status], note: g.note })),
          measurables: measurableRows,
          settings,
        },
      );
    } catch {
      setError("Couldn't build the PDF — try again.");
    } finally {
      setPrintBusy(false);
    }
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
  // Measured TESTS only (Phase 1): a skill is a definition with no unit and nothing to log against
  // until Phase 2 records observations — offering it here would take a fabricated number.
  const activeTypes = activeMeasuredTests(data.types);
  // The value/date fields only exist once a real, active test is selected — no dead "Log it".
  const selectedLogType = activeTypes.find(t => t.id === logTypeId) ?? null;
  // With zero tests, the set-up-a-test form IS the flow — it can't be toggled closed.
  const newTypeFormOpen = newTypeOpen || activeTypes.length === 0;
  const entriesByType = new Map<string, RepPlayerMeasurable[]>();
  for (const e of data.measurables) {
    const list = entriesByType.get(e.measurableTypeId) ?? [];
    list.push(e);
    entriesByType.set(e.measurableTypeId, list);
  }
  // Summary rows in library order (roster-order principle: stable, never sorted by result).
  const typeRows = measuredTestsWithHistory(data.types, id => entriesByType.has(id))
    .map(t => {
      const entries = entriesByType.get(t.id) ?? []; // newest-first from the API
      /**
       * F01 (2026-09-11): the line is drawn from the CURRENT unit's run only. Each reading carries
       * the unit it was logged under; a later unit edit on the test starts a new run, and two units
       * are never joined into one line. Every reading stays in the expanded list beneath, and the
       * note says what the line leaves out.
       */
      const segments = splitSeriesByUnit(entries);
      const drawable = drawableSegment(segments);
      return {
        type: t, entries, latest: entries[0] ?? null,
        chronoDrawable: drawable ? drawable.readings.map(e => e.value) : [],
        splitNote: unitSplitNote(segments),
      };
    })
    .filter(r => r.type.isActive || r.entries.length > 0);

  const contextLines: { label: string; value: string }[] = [];
  if (bestPositions.length > 0) contextLines.push({ label: 'Depth chart', value: `Best at ${bestPositions.join(' · ')}` });
  if (data.context) contextLines.push({ label: 'This season', value: `${data.context.fieldInnings} field innings · ${data.context.benchInnings} bench` });
  if (attendancePct != null) contextLines.push({ label: 'Attendance', value: `${attendancePct}% of recorded sessions` });

  const goalPill = (status: RepDevelopmentGoalStatus) =>
    status === 'achieved' ? styles.badgeActive : status === 'working' ? styles.badgeCompleted : styles.badgeDraft;

  return (
    <>
      {/* No title of its own: the profile page's collapse summary carries "Development" now —
          a second visible title directly beneath it is the repeated-header defect the
          2026-07-31 staff ruling retired. The Saved flash + actions stay. */}
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
          {/* Metrics (Phase 1, mockup screen 1): the library has ONE editor now — the Metrics tab on
              Skills & Goals — where "Test types" used to open a dialog of its own here. A quiet door
              for anyone who can read the library (the tab is read-only without the grant). */}
          {data.showMeasurables && (
            <Link href={metricsHref} className={`btn btn-ghost ${styles.devSectionAction}`}
              style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Settings2 size={13} /> Metrics
            </Link>
          )}
        </div>
      </div>

      {error && <p className={styles.errorText} role="alert">{error}</p>}

      {/* ── Returning player? (3C — head coach only; name + DOB always shown, never email
             alone; "Not sure yet" leaves the suggestion for a later visit) ── */}
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

      {/* ── Carry-forward offer (3D, M5) — one-time, never automatic; blueprint-blue is the
             offer voice (amber stays reserved for continuity-verify) ── */}
      {canWriteGoals && data.carry && (
        <div className={styles.devCarryBanner}>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            <b>Returning player — bring forward the {data.carry.workingCount} focus area{data.carry.workingCount === 1 ? '' : 's'} they were working on in {data.carry.priorSeasonLabel}?</b>
          </p>
          <p className={styles.devCardNote} style={{ marginTop: '0.25rem' }}>
            They&apos;ll join this season as &ldquo;Working on it&rdquo;. Readings never carry over — last season&apos;s stay in its archive below. You can look first.
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

      {/* ── Tryout snapshot (Phase 2, frame 05) — where the season started. Deliberately ABOVE
             the focus areas, because it is what those focus areas were chosen from, and
             deliberately dashed so it can never be mistaken for a measurables panel (R4). ── */}
      {data.tryoutBaseline && <TryoutSnapshotCard snapshot={data.tryoutBaseline} variant="card" />}

      {/* ── Focus areas (IDP) ── */}
      {data.showGoals && (
        <>
          <p className={styles.miniListLabel} style={{ marginTop: 0 }}>Focus areas</p>
          {data.goals.length === 0 && !goalFormOpen && (
            <p className={styles.detailPlaceholder}>
              {canWriteGoals ? 'No focus areas yet — add the first thing this player is working on.' : 'No focus areas yet.'}
            </p>
          )}
          {data.goals.length > 0 && (
            <ul className={styles.miniList}>
              {data.goals.map(g => (
                <li key={g.id} id={`dev-goal-${g.id}`} className={`${styles.miniRow}${flashRowId === `dev-goal-${g.id}` ? ` ${styles.collapseFlash}` : ''}`}>
                  <span className={styles.miniRowMain}>
                    {canWriteGoals ? (
                      <button type="button"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                        title="Edit this focus area"
                        onClick={() => {
                          setEditingGoalId(g.id);
                          setGoalFocus(g.focusArea);
                          setGoalNote(g.note ?? '');
                          setGoalTagId(g.tagId ?? null);
                          setGoalFormOpen(true);
                        }}>
                        {g.focusArea}
                      </button>
                    ) : g.focusArea}
                    {/* The focus TAG (F11) — the grouping word the focus rail matches on, shown with the area it groups. */}
                    {g.tagId && focusTagById.has(g.tagId) && (
                      <span className={`${styles.badge} ${styles.badgeDraft}`} style={{ marginLeft: '0.4rem' }}>{focusTagById.get(g.tagId)!.name}</span>
                    )}
                    {g.note && <span className={styles.devCardNote}>{g.note}</span>}
                  </span>
                  {canWriteGoals ? (
                    <button type="button"
                      className={`${styles.badge} ${goalPill(g.status)}`}
                      style={{ cursor: 'pointer' }}
                      title="Tap to change status"
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
          {canWriteGoals && !goalFormOpen && (
            <button type="button" className={`btn btn-ghost ${styles.devSectionAction}`}
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0.55rem 0 1rem' }}
              onClick={() => { setEditingGoalId(null); setGoalFocus(''); setGoalNote(''); setGoalTagId(null); setGoalErr(''); setGoalFormOpen(true); }}>
              <Plus size={13} /> Add focus area
            </button>
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
              <div className={`${styles.field} ${styles.formGridFull}`}>
                {/* ONE optional grouping tag, the team's own 'focus' words — so the focus rail can tell this
                    area belongs to tonight's practice. The text above stays the coach's specific words. */}
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
        </>
      )}

      {/* ── Measurables ── */}
      {data.showMeasurables && (
        <>
          <p className={styles.miniListLabel}>Measurables</p>
          {typeRows.length === 0 && !logOpen && (
            <p className={styles.detailPlaceholder}>
              {canWrite
                ? 'No measurables yet — set up your first test (like a 60-yd sprint) and log a reading.'
                : 'No measurables logged yet.'}
            </p>
          )}
          {typeRows.length > 0 && (
            <ul className={styles.miniList}>
              {typeRows.map(({ type, entries, latest, chronoDrawable, splitNote }) => (
                <li key={type.id} id={`dev-metric-${type.id}`} className={`${styles.miniRow}${flashRowId === `dev-metric-${type.id}` ? ` ${styles.collapseFlash}` : ''}`} style={{ flexWrap: 'wrap' }}>
                  <span className={styles.miniRowMain}>
                    <button type="button"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                      title={entries.length > 0 ? 'Show every reading' : undefined}
                      onClick={() => setExpandedTypeId(id => id === type.id ? null : type.id)}>
                      {type.name}{!type.isActive && ' (retired)'}
                    </button>
                  </span>
                  {latest ? (
                    <>
                      <span className={styles.miniRowMeta} style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatValue(latest.value)} {latest.unit}
                      </span>
                      {chronoDrawable.length >= 2
                        ? <Sparkline values={chronoDrawable.slice(-10)} />
                        : <span className={styles.miniRowMeta} style={{ fontStyle: 'italic' }}>trend shows after a second entry</span>}
                      <span className={styles.miniRowMeta}>{formatShortDate(latest.recordedOn)}</span>
                      {/* F01 — what the line leaves out is SAID on the row, not discovered in the list. */}
                      {splitNote && <span className={styles.devCardNote} style={{ flexBasis: '100%' }}>{splitNote}</span>}
                    </>
                  ) : (
                    <span className={styles.miniRowMeta}>no readings yet</span>
                  )}
                  {expandedTypeId === type.id && entries.length > 0 && (
                    <ul className={styles.miniList} style={{ flexBasis: '100%', marginTop: '0.4rem' }}>
                      {entries.map(e => (
                        <li key={e.id} className={styles.miniRow}>
                          <span className={styles.miniRowMain} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatValue(e.value)} {e.unit}
                          </span>
                          {e.note && <span className={styles.miniRowMeta}>{e.note}</span>}
                          <span className={styles.miniRowMeta}>{formatShortDate(e.recordedOn)}</span>
                          {canWrite && (
                            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}
                              aria-label="Remove this reading" onClick={() => deleteEntry(e.id)}>
                              <X size={11} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canWrite && !logOpen && (
            <button type="button" className={`btn btn-ghost ${styles.devSectionAction}`}
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0.55rem 0 1rem' }}
              onClick={() => {
                setLogOpen(true);
                setLogErr('');
                setLogDate(todayLocal());
                if (!logTypeId && activeTypes.length > 0) setLogTypeId(activeTypes[0].id);
              }}>
              <Plus size={13} /> Log a measurable
            </button>
          )}
          {canWrite && logOpen && (
            <div className={styles.formGrid} style={{ margin: '0.6rem 0 1.1rem' }}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <span className={styles.label}>Test</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {activeTypes.map(t => (
                    <button key={t.id} type="button"
                      className={`${styles.badge} ${logTypeId === t.id ? styles.badgeActive : styles.badgeDraft}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLogTypeId(t.id)}>
                      {t.name}
                    </button>
                  ))}
                  {activeTypes.length > 0 && (
                    <button type="button" className={`${styles.badge} ${styles.badgeDraft}`} style={{ cursor: 'pointer' }}
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
                    <label className={styles.label} htmlFor="dev-log-value">Value ({selectedLogType.unit})</label>
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
                    <button type="button" className="btn btn-lime" style={{ fontSize: '0.8rem' }}
                      disabled={busy}
                      onClick={logMeasurable}>
                      Log it
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
                        ? 'Set up your first test above — then you can log a reading.'
                        : 'Pick a test above to log a reading.'}
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

      {/* ── Previous seasons (3D, M5) — a dated scrapbook, oldest→newest; expands in place
             (never navigates to the prior season's editable profile); NO cross-season
             deltas anywhere. ── */}
      {data.archive.length > 0 && (
        <>
          <p className={styles.miniListLabel}>Previous seasons</p>
          <ul className={styles.miniList}>
            {data.archive.map(season => {
              const achieved = season.goals.filter(g => g.status === 'achieved').length;
              const entryCount = season.tests.reduce((n, t) => n + t.entries.length, 0);
              const summaryParts = [
                season.goals.length > 0
                  ? `${season.goals.length} focus area${season.goals.length === 1 ? '' : 's'}${achieved > 0 ? ` (${achieved} achieved)` : ''}`
                  : null,
                entryCount > 0 ? `${entryCount} measurable${entryCount === 1 ? '' : 's'}` : null,
                season.attendancePct != null ? `attendance ${season.attendancePct}%` : null,
              ].filter(Boolean);
              const expanded = expandedSeasonId === season.priorRosterId;
              return (
                <li key={season.priorRosterId} id={`dev-archive-${season.priorRosterId}`}
                  className={styles.miniRow} style={{ flexWrap: 'wrap' }}>
                  <span className={styles.miniRowMain}>
                    <button type="button"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                      title={expanded ? 'Hide this season' : 'Show this season'}
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
            Shown as a record, side by side — never a computed &ldquo;better or worse than last year.&rdquo;
          </p>
        </>
      )}

      {/* ── Context (quoted, never recomputed) ── */}
      {contextLines.length > 0 && (
        <>
          <p className={styles.miniListLabel}>Context</p>
          <ul className={styles.miniList}>
            {contextLines.map(line => (
              <li key={line.label} className={styles.miniRow}>
                <span className={styles.miniRowMain} style={{ fontWeight: 600 }}>{line.label}</span>
                <span className={styles.miniRowMeta}>{line.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ── Print summary (3D, M1) — a one-page, hand-delivered handout; current season
             only, generated on this device (deliberately no shareable link). ── */}
      {(data.goals.length > 0 || data.measurables.length > 0) && (
        <div style={{ marginTop: '0.7rem' }}>
          <button type="button" className="btn btn-ghost"
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            disabled={printBusy} onClick={printSummary}>
            <Printer size={13} /> {printBusy ? 'Building PDF…' : 'Print summary (PDF)'}
          </button>
        </div>
      )}
    </>
  );
}
