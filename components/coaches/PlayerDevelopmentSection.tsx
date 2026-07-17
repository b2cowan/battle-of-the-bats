'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Check, Settings2 } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import Sparkline from '@/components/charts/Sparkline';
import TestTypesManager, { NewTypeFields } from '@/components/coaches/TestTypesManager';
import { formatValue, todayLocal, formatShortDate } from '@/lib/measurable-format';
import type {
  RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerDevelopmentGoal, RepDevelopmentGoalStatus,
} from '@/lib/types';

const STATUS_LABELS: Record<RepDevelopmentGoalStatus, string> = {
  working: 'Working on it',
  achieved: 'Achieved',
  parked: 'Parked',
};
const STATUS_ORDER: RepDevelopmentGoalStatus[] = ['working', 'achieved', 'parked'];

interface DevelopmentData {
  canWrite: boolean;
  showGoals: boolean;
  showMeasurables: boolean;
  types: RepTeamMeasurableType[];
  measurables: RepPlayerMeasurable[];
  goals: RepPlayerDevelopmentGoal[];
  context: { fieldInnings: number; benchInnings: number } | null;
}

interface Props {
  orgSlug: string;
  teamId: string;
  playerId: string;
  /** "Best" positions from the depth chart / position profile — quoted, never recomputed. */
  bestPositions: string[];
  /** Attendance % of recorded sessions, when any exist — quoted from the page's own data. */
  attendancePct: number | null;
}

// NewTypeFields lives in TestTypesManager.tsx (single home; acyclic import graph).

export default function PlayerDevelopmentSection({ orgSlug, teamId, playerId, bestPositions, attendancePct }: Props) {
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/development`;
  const typesBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/measurable-types`;
  const confirm = useConfirm();

  const [data, setData] = useState<DevelopmentData | null>(null);
  const [error, setError] = useState('');
  // "✓ Saved · Undo" for the most recent create — Undo deletes the just-created row.
  const [lastCreated, setLastCreated] = useState<{ kind: 'goal' | 'entry'; id: string } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalFocus, setGoalFocus] = useState('');
  const [goalNote, setGoalNote] = useState('');
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

  const [manageOpen, setManageOpen] = useState(false);

  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);

  // Inline validation shown right beside the button the coach pressed — a button that
  // silently does nothing is not an answer (owner feedback, 2026-07-17).
  const [goalErr, setGoalErr] = useState('');
  const [logErr, setLogErr] = useState('');
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
        body: JSON.stringify({ focusArea: focus, note: goalNote.trim() || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save — try again.');
      setGoalFormOpen(false);
      setGoalFocus('');
      setGoalNote('');
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

  if (!data && !error) {
    return <p className={styles.detailPlaceholder}>Loading development…</p>;
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
  const activeTypes = data.types.filter(t => t.isActive);
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
  const typeRows = data.types
    .filter(t => t.isActive || entriesByType.has(t.id))
    .map(t => {
      const entries = entriesByType.get(t.id) ?? []; // newest-first from the API
      const chrono = [...entries].reverse();
      return { type: t, entries, latest: entries[0] ?? null, chronoValues: chrono.map(e => e.value) };
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Development</p>
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
          {canWrite && data.showMeasurables && (
            <button type="button" className="btn btn-ghost"
              style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onClick={() => setManageOpen(true)}>
              <Settings2 size={13} /> Test types
            </button>
          )}
        </div>
      </div>

      {error && <p className={styles.errorText} role="alert">{error}</p>}

      {/* ── Focus areas (IDP) ── */}
      {data.showGoals && (
        <>
          <p className={styles.miniListLabel} style={{ marginTop: 0 }}>Focus areas</p>
          {data.goals.length === 0 && !goalFormOpen && (
            <p className={styles.detailPlaceholder}>
              {canWrite ? 'No focus areas yet — add the first thing this player is working on.' : 'No focus areas yet.'}
            </p>
          )}
          {data.goals.length > 0 && (
            <ul className={styles.miniList}>
              {data.goals.map(g => (
                <li key={g.id} className={styles.miniRow}>
                  <span className={styles.miniRowMain}>
                    {canWrite ? (
                      <button type="button"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                        title="Edit this focus area"
                        onClick={() => {
                          setEditingGoalId(g.id);
                          setGoalFocus(g.focusArea);
                          setGoalNote(g.note ?? '');
                          setGoalFormOpen(true);
                        }}>
                        {g.focusArea}
                      </button>
                    ) : g.focusArea}
                    {g.note && <span className={styles.devCardNote}>{g.note}</span>}
                  </span>
                  {canWrite ? (
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
          {canWrite && !goalFormOpen && (
            <button type="button" className="btn btn-ghost"
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0.55rem 0 1rem' }}
              onClick={() => { setEditingGoalId(null); setGoalFocus(''); setGoalNote(''); setGoalErr(''); setGoalFormOpen(true); }}>
              <Plus size={13} /> Add focus area
            </button>
          )}
          {canWrite && goalFormOpen && (
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
              <div className={`${styles.field} ${styles.formGridFull}`} style={{ flexDirection: 'row', display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.35rem' }}>
                <button type="button" className="btn btn-lime" style={{ fontSize: '0.8rem' }} disabled={busy} onClick={saveGoal}>
                  {editingGoalId ? 'Save' : 'Add it'}
                </button>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
                  onClick={() => { setGoalFormOpen(false); setEditingGoalId(null); setGoalErr(''); }}>
                  Discard
                </button>
                {editingGoalId && (
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem', marginLeft: 'auto', color: 'var(--danger, #f87171)' }}
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
              {typeRows.map(({ type, entries, latest, chronoValues }) => (
                <li key={type.id} className={styles.miniRow} style={{ flexWrap: 'wrap' }}>
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
                      {chronoValues.length >= 2
                        ? <Sparkline values={chronoValues.slice(-10)} />
                        : <span className={styles.miniRowMeta} style={{ fontStyle: 'italic' }}>trend shows after a second entry</span>}
                      <span className={styles.miniRowMeta}>{formatShortDate(latest.recordedOn)}</span>
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
            <button type="button" className="btn btn-ghost"
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
                    onName={setNewTypeName} onUnit={setNewTypeUnit}
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

      {/* ── Manage test types (M3) — a centered dialog hosting the ONE shared manager ── */}
      {canWrite && manageOpen && data.showMeasurables && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Test types</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Close"
                onClick={() => setManageOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <TestTypesManager
              apiBase={typesBase}
              types={data.types}
              canWrite={canWrite}
              onTypesChanged={update => setData(d => d ? { ...d, types: update(d.types) } : d)}
            />
          </div>
        </div>
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
    </>
  );
}
