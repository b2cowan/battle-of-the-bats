'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ClipboardCheck, X } from 'lucide-react';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { NewTypeFields } from '@/components/coaches/TestTypesManager';
import { formatValue } from '@/lib/measurable-format';
import styles from '../../../../../coaches.module.css';
import type { RepTeamEvaluationSession, RepTeamMeasurableType, RepPlayerMeasurable } from '@/lib/types';

interface SessionRosterRow {
  id: string;
  playerFirstName: string;
  playerLastName: string | null;
  playerNumber: string | null;
}

interface SessionWorld {
  session: RepTeamEvaluationSession;
  roster: SessionRosterRow[];
  types: RepTeamMeasurableType[];
  entries: RepPlayerMeasurable[];
  canWrite: boolean;
}

function formatSessionDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function EvaluationSessionPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string; sessionId: string }>;
}) {
  const { orgSlug, teamId, sessionId } = use(params);
  // Fresh instance per session — a stale fetch must never swap another session's data in,
  // and drafts must never survive into a different session (3A key= pattern).
  return <SessionView key={sessionId} orgSlug={orgSlug} teamId={teamId} sessionId={sessionId} />;
}

function SessionView({ orgSlug, teamId, sessionId }: { orgSlug: string; teamId: string; sessionId: string }) {
  const confirm = useConfirm();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}`;

  const [data, setData] = useState<SessionWorld | null>(null);
  const [error, setError] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  // Drafts are keyed by player AND test — a value typed under one test must never
  // pre-fill (or silently post against) another test's row (3B review fix).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowErr, setRowErr] = useState('');
  // Visible saving state doubles as the double-submit guard, shared by log + remove per player.
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeUnit, setNewTypeUnit] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/development/sessions/${sessionId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load the session — try again.');
      setData(json);
      setError('');
      setSelectedTypeId(prev => prev || (json.types as RepTeamMeasurableType[]).find(t => t.isActive)?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the session — try again.');
    }
  }, [apiBase, sessionId]);

  useEffect(() => { load(); }, [load]);

  if (!data && !error) {
    return <div className={styles.page}><div className={styles.loadingState}>Loading session…</div></div>;
  }
  if (!data) {
    return (
      <div className={styles.page}>
        <p className={styles.detailPlaceholder}>
          {error}{' '}
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
            onClick={() => { setError(''); load(); }}>
            Try again
          </button>
        </p>
      </div>
    );
  }

  const { session, roster, types, entries, canWrite } = data;
  const activeTypes = types.filter(t => t.isActive);
  const selectedType = activeTypes.find(t => t.id === selectedTypeId) ?? null;
  const draftKey = (playerId: string) => `${playerId}:${selectedTypeId}`;

  // One reading per (player, selected test) IN THIS SESSION drives the grid state
  // (uniqueness is DB-enforced per the partial index; first-wins here is display order).
  const entryByPlayer = new Map<string, RepPlayerMeasurable>();
  if (selectedType) {
    for (const e of entries) {
      if (e.measurableTypeId === selectedType.id && !entryByPlayer.has(e.playerId)) entryByPlayer.set(e.playerId, e);
    }
  }
  // Count only CURRENT roster members — a since-deactivated player's reading must not
  // produce "15 of 14 entered".
  const enteredCount = roster.filter(p => entryByPlayer.has(p.id)).length;

  async function logDraft(player: SessionRosterRow) {
    if (!selectedType || !canWrite) return;
    if (savingIds.has(player.id)) return;
    const key = draftKey(player.id);
    const raw = (drafts[key] ?? '').trim();
    if (raw === '') return; // leaving a row empty = an honest skip, never a fabricated 0
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 99999) {
      setRowErr(`${player.playerFirstName}: the value needs to be a number between 0 and 99,999.`);
      return;
    }
    setRowErr('');
    setSavingIds(ids => new Set(ids).add(player.id));
    try {
      const res = await fetch(`${apiBase}/roster/${player.id}/development/measurables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurableTypeId: selectedType.id,
          value,
          // Readings belong to the SESSION's date, not the moment of typing.
          recordedOn: session.sessionDate,
          sessionId: session.id,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not log it — try again.');
      setData(d => d ? { ...d, entries: [json.entry, ...d.entries] } : d);
      setDrafts(dr => { const next = { ...dr }; delete next[key]; return next; });
    } catch (e) {
      setRowErr(`${player.playerFirstName}: ${e instanceof Error ? e.message : 'could not log it — try again.'}`);
    } finally {
      setSavingIds(ids => { const next = new Set(ids); next.delete(player.id); return next; });
    }
  }

  async function removeEntry(player: SessionRosterRow, entry: RepPlayerMeasurable) {
    if (!canWrite || savingIds.has(player.id)) return;
    const ok = await confirm({
      title: 'Remove this reading?',
      message: `${player.playerFirstName}'s ${selectedType?.name ?? 'reading'} from this session — for fixing a mis-entry.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setSavingIds(ids => new Set(ids).add(player.id));
    try {
      const res = await fetch(`${apiBase}/roster/${player.id}/development/measurables/${entry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setData(d => d ? { ...d, entries: d.entries.filter(e => e.id !== entry.id) } : d);
    } catch {
      setRowErr(`Couldn't remove ${player.playerFirstName}'s reading — try again.`);
    } finally {
      setSavingIds(ids => { const next = new Set(ids); next.delete(player.id); return next; });
    }
  }

  async function saveNote(raw: string) {
    const note = raw.trim();
    if (note === (session.note ?? '')) return;
    const res = await fetch(`${apiBase}/development/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || null }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json) {
      setData(d => d ? { ...d, session: json.session } : d);
    } else {
      setRowErr(json?.error ?? "Couldn't save the session note — try again.");
    }
  }

  async function addType() {
    if (!newTypeName.trim() || !newTypeUnit.trim()) {
      setRowErr('Give the test a name and a unit (like seconds).');
      return;
    }
    setRowErr('');
    const res = await fetch(`${apiBase}/development/measurable-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTypeName, unit: newTypeUnit }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      setRowErr(json?.error ?? 'Could not add the test — try again.');
      return;
    }
    setNewTypeName('');
    setNewTypeUnit('');
    setNewTypeOpen(false);
    setData(d => d ? { ...d, types: [...d.types, json.type] } : d);
    setSelectedTypeId(json.type.id);
  }

  return (
    <div className={styles.page}>
      <Link href={`${base}/development`} className={styles.lineupBackLink}>← Development</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><ClipboardCheck size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Evaluation session</h1>
            <p className={styles.pageSub}>{formatSessionDate(session.sessionDate)}</p>
          </div>
        </div>
      </div>

      {/* Session note — a label like "post-break testing"; saves on blur/Enter. */}
      {canWrite ? (
        <div className={styles.field} style={{ maxWidth: 420, margin: '0 0 0.7rem' }}>
          <label className={styles.label} htmlFor="dev-session-note">Session note (optional)</label>
          <input id="dev-session-note" className={styles.input} type="text" maxLength={200}
            defaultValue={session.note ?? ''} placeholder='e.g. "post-break testing"'
            onBlur={e => saveNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        </div>
      ) : session.note ? (
        <p className={styles.devCardNote} style={{ marginBottom: '0.7rem' }}>{session.note}</p>
      ) : null}

      {/* Test picker — worded select-one chips (lime-tint active, never solid primary) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', margin: '0.2rem 0 0.6rem' }}>
        {activeTypes.map(t => (
          <button key={t.id} type="button"
            className={`${styles.badge} ${selectedTypeId === t.id ? styles.badgeActive : styles.badgeDraft}`}
            style={{ cursor: 'pointer', minHeight: 'var(--tap-min, 44px)' }}
            onClick={() => { setSelectedTypeId(t.id); setRowErr(''); }}>
            {t.name}
          </button>
        ))}
        {canWrite && (
          <button type="button" className={`${styles.badge} ${styles.badgeDraft}`}
            style={{ cursor: 'pointer', minHeight: 'var(--tap-min, 44px)' }}
            onClick={() => setNewTypeOpen(o => !o)}>
            + New test…
          </button>
        )}
      </div>
      {canWrite && (newTypeOpen || activeTypes.length === 0) && (
        <div style={{ margin: '0 0 0.8rem' }}>
          <NewTypeFields idPrefix="dev-session-newtype" name={newTypeName} unit={newTypeUnit}
            onName={setNewTypeName} onUnit={setNewTypeUnit} onAdd={addType} />
        </div>
      )}

      {selectedType ? (
        roster.length === 0 ? (
          <p className={styles.detailPlaceholder}>No active roster for this season — add players from the Roster page first.</p>
        ) : (
          <>
            <p className={styles.devCardNote} style={{ marginBottom: '0.4rem' }}>
              {enteredCount} of {roster.length} entered — {selectedType.name} ({selectedType.unit}).
              Leave a player blank to skip them.
            </p>
            {rowErr && <p className={styles.errorText} role="alert">{rowErr}</p>}
            <div className={styles.detailSection} style={{ padding: '0.25rem 0' }}>
              {/* ROSTER ORDER ONLY — the grid never re-sorts by result (binding). */}
              {roster.map(p => {
                const entry = entryByPlayer.get(p.id);
                const name = [p.playerFirstName, p.playerLastName].filter(Boolean).join(' ');
                return (
                  <div key={p.id} className={styles.devRow}>
                    {p.playerNumber && <span className={styles.devRowNum}>#{p.playerNumber}</span>}
                    <span className={styles.devRowName}>{name}</span>
                    {entry ? (
                      <>
                        <span className={styles.devRowVal}>{formatValue(entry.value)} {entry.unit} ✓</span>
                        {canWrite && (
                          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}
                            aria-label={`Remove ${p.playerFirstName}'s reading`} onClick={() => removeEntry(p, entry)}>
                            <X size={11} />
                          </button>
                        )}
                      </>
                    ) : canWrite ? (
                      <input
                        className={`${styles.input} ${styles.devRowInput}`}
                        type="text"
                        inputMode="decimal"
                        placeholder={savingIds.has(p.id) ? 'saving…' : selectedType.unit}
                        disabled={savingIds.has(p.id)}
                        aria-label={`${name} — ${selectedType.name} (${selectedType.unit})`}
                        value={drafts[draftKey(p.id)] ?? ''}
                        onChange={e => setDrafts(dr => ({ ...dr, [draftKey(p.id)]: e.target.value }))}
                        onBlur={() => logDraft(p)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    ) : (
                      <span className={`${styles.devRowVal} ${styles.devRowDash}`}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : (
        <p className={styles.detailPlaceholder}>
          {canWrite ? 'Set up your first test above — then work down the roster.' : 'No tests set up yet.'}
        </p>
      )}
    </div>
  );
}
