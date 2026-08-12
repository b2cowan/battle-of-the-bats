'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ClipboardCheck, X } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { NewTypeFields } from '@/components/coaches/TestTypesManager';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import { formatValue } from '@/lib/measurable-format';
import styles from '../../../../../coaches.module.css';
import type { RepTeamEvaluationSession, RepTeamMeasurableType, RepPlayerMeasurable } from '@/lib/types';

interface SessionRosterRow {
  id: string;
  playerFirstName: string;
  playerLastName: string | null;
  playerNumber: string | null;
}

/** The event-picker options (D10) — identity + date only, never a whole event record. */
interface SessionEventOption {
  id: string;
  name: string;
  eventType: string;
  startsAt: string;
}

interface SessionWorld {
  session: RepTeamEvaluationSession;
  roster: SessionRosterRow[];
  types: RepTeamMeasurableType[];
  entries: RepPlayerMeasurable[];
  events: SessionEventOption[];
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
  // The date input's own value while the coach is mid-edit. Null = show the saved date, so a
  // cancelled confirm snaps straight back to the truth rather than leaving a phantom date on screen.
  const [dateDraft, setDateDraft] = useState<string | null>(null);
  // One session mutation in flight at a time — see patchSession.
  const [sessionBusy, setSessionBusy] = useState(false);

  /**
   * Sequence guard: a slow earlier response must never stomp a newer one.
   *
   * This reload runs after every date/event save, so two in quick succession can resolve out of
   * order and land the OLDER session on screen — the header would then disagree with what the
   * coach just chose. Same guard the practice-plan drill-in uses.
   *
   * @returns whether the load actually landed (false = failed, or superseded by a newer one).
   */
  const loadSeqRef = useRef(0);
  const load = useCallback(async (): Promise<boolean> => {
    const seq = ++loadSeqRef.current;
    try {
      const res = await fetch(`${apiBase}/development/sessions/${sessionId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load the session — try again.');
      if (seq !== loadSeqRef.current) return false;
      setData(json);
      setError('');
      setSelectedTypeId(prev => prev || (json.types as RepTeamMeasurableType[]).find(t => t.isActive)?.id || '');
      return true;
    } catch (e) {
      if (seq !== loadSeqRef.current) return false;
      setError(e instanceof Error ? e.message : 'Could not load the session — try again.');
      return false;
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

  const { session, roster, types, entries, events, canWrite } = data;
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

  const linkedEvent = events.find(e => e.id === session.eventId) ?? null;
  /* Practices first, then everything else, each ordered by how close it sits to the session's
     current date (§10.2 ruling 2). A coach who tested at a Saturday scrimmage warm-up must still
     find it, so nothing is filtered out — practices simply lead. */
  const sessionEventOptions = [...events].sort((a, b) => {
    const aPractice = a.eventType === 'practice' ? 0 : 1;
    const bPractice = b.eventType === 'practice' ? 0 : 1;
    if (aPractice !== bPractice) return aPractice - bPractice;
    const anchor = new Date(`${session.sessionDate}T12:00:00Z`).getTime();
    return Math.abs(new Date(a.startsAt).getTime() - anchor) - Math.abs(new Date(b.startsAt).getTime() - anchor);
  });

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

  /**
   * D10 — change the session's date.
   *
   * ⚠ Every reading already entered here moves with it. A reading is stamped with the session's
   * date at the moment it is typed, so leaving them behind would make the session disagree with
   * its own contents and plot every trend line on the wrong day. The coach is told the exact
   * count BEFORE it happens; with nothing entered yet there is no dialog at all (§10.2 ruling 4).
   */
  /**
   * ONE session mutation at a time.
   *
   * Both controls here can fire from a single gesture — clicking the event `<select>` blurs the
   * date `<input>` first — and the date change is a TWO-statement server operation (re-stamp the
   * readings, then move the session). Two of those interleaving can land as
   * `re-stamp A → re-stamp B → move B → move A`: the readings end on B's date while the session
   * says A's. That is exactly the "session disagrees with its own contents" corruption the
   * re-stamp exists to prevent, rebuilt one level up. Serialising the writes closes it.
   */
  async function patchSession(
    body: { sessionDate?: string; eventId?: string | null },
    failure: string,
  ): Promise<boolean> {
    if (sessionBusy) return false;
    setSessionBusy(true);
    try {
      const res = await fetch(`${apiBase}/development/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setDateDraft(null);
        setRowErr(json?.error ?? failure);
        return false;
      }
      // Reload so any moved readings' own dates are re-read rather than assumed. A failed
      // reload is surfaced, not swallowed — the PATCH succeeded but the screen is now stale.
      const reloaded = await load();
      if (!reloaded) setRowErr('Saved, but the screen could not refresh — reload the page.');
      setDateDraft(null);
      return true;
    } finally {
      setSessionBusy(false);
    }
  }

  async function saveSessionDate(nextDate: string) {
    if (!nextDate || nextDate === session.sessionDate) { setDateDraft(null); return; }
    const readingCount = entries.length;
    if (readingCount > 0) {
      const moving = `${readingCount} reading${readingCount === 1 ? '' : 's'}`;
      const ok = await confirm({
        title: 'Move this session?',
        message: `Move this session to ${formatSessionDate(nextDate)}? The ${moving} already entered here move with it.`,
        confirmText: 'Move the session',
        cancelText: 'Keep the date',
        tone: 'warning',
      });
      if (!ok) {
        setDateDraft(null);
        return;
      }
    }
    await patchSession({ sessionDate: nextDate }, "Couldn't move the session — try again.");
  }

  /**
   * D10 — link the session to the event its readings were taken at.
   *
   * ⚠ Picking an event PRE-FILLS the date; it never derives it (§10.2 ruling 1). The two stay
   * separate facts — which practice this belongs to, and when the readings were actually taken —
   * so a practice that gets rescheduled later never drags the measurements with it. The pre-fill
   * only applies to a session with NOTHING entered yet: once real numbers exist, the date they
   * were taken on is the coach's to state, and moving it needs the confirm above.
   *
   * The link and the pre-filled date go in ONE request, deliberately. Sending them as two
   * chained PATCHes raced with itself and could re-stamp readings logged in the gap without ever
   * showing the coach the count.
   */
  async function saveSessionEvent(eventId: string) {
    const chosen = events.find(e => e.id === eventId) ?? null;
    const eventDay = chosen?.startsAt?.slice(0, 10);
    const prefillDate = chosen && eventDay && eventDay !== session.sessionDate && entries.length === 0
      ? eventDay
      : undefined;
    await patchSession(
      { eventId: chosen ? chosen.id : null, ...(prefillDate ? { sessionDate: prefillDate } : {}) },
      "Couldn't link that event — try again.",
    );
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
      <CoachBackLink href={`${base}/development`}>Development</CoachBackLink>
      <CoachPageHeader
        icon={ClipboardCheck}
        title="Evaluation session"
        helpLabel="Development"
        help={{ module: 'coaches', sectionIds: ['premium-development'], fullGuideHref: `/${orgSlug}/coaches/help#premium-development` }}
      />

      {/* Page-header ruling 2026-08-11: the session date moves out of the subtitle into the body.
          A coach who can WRITE already has it in the editable Date field below — printing it twice
          would be the same fact in two places — so the summary strip is the read-only viewer's
          only copy of it. */}
      {!canWrite && (
        <p className={styles.pageSummaryStrip}>{formatSessionDate(session.sessionDate)}</p>
      )}

      {/* ── When and where these readings were taken (D10) ──
          Two SEPARATE facts, deliberately: which practice this belongs to, and when the
          readings were actually taken. Picking a practice pre-fills the date; it never owns it,
          so a practice that gets rescheduled later never drags the measurements with it. */}
      {canWrite && (
        <div className={styles.devSessionWhen}>
          <label className={styles.field}>
            <span className={styles.label}>Date</span>
            <input className={styles.input} type="date" value={dateDraft ?? session.sessionDate}
              disabled={sessionBusy}
              onChange={e => setDateDraft(e.target.value)}
              onBlur={e => saveSessionDate(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Taken at (optional)</span>
            <select className={styles.input} value={session.eventId ?? ''} disabled={sessionBusy}
              onChange={e => saveSessionEvent(e.target.value)}>
              <option value="">Not linked to an event</option>
              {sessionEventOptions.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {formatSessionDate(ev.startsAt.slice(0, 10))} — {ev.name}
                </option>
              ))}
            </select>
          </label>
          {linkedEvent && (
            <Link href={`${base}/practice/${linkedEvent.id}`} className={styles.devSessionEventLink}>
              Open {linkedEvent.eventType === 'practice' ? 'the practice plan' : 'the event'} →
            </Link>
          )}
        </div>
      )}
      {!canWrite && linkedEvent && (
        <p className={styles.devCardNote} style={{ marginBottom: '0.7rem' }}>
          Taken at {linkedEvent.name}.
        </p>
      )}

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
