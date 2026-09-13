'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { NewTypeFields } from '@/components/coaches/NewTypeFields';
import SessionScopeDialog from '@/components/coaches/SessionScopeDialog';
import SessionRecordGrid, {
  emptyDraft, emptyObservationDraft, type GridRow, type RowDraft, type ObservationDraft,
} from '@/components/coaches/SessionRecordGrid';
import { isMeasuredTest, recordMeaning } from '@/lib/measurable-definition';
import { skillsAndGoalsHref } from '@/lib/development-address';
import { formatShortDate, formatWeekdayDate } from '@/lib/measurable-format';
import {
  sessionMetricChips, sessionRows, sessionScopeCounts, scopeSentence, defaultSessionChip, orderEventsByAnchor,
} from '@/lib/development-session-view';
import styles from '../../../../../coaches.module.css';
import css from '@/components/coaches/DevelopmentSession.module.css';
import type {
  RepTeamEvaluationSession, RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerObservation, RepEvaluationNotAssessed,
} from '@/lib/types';

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
  /** No longer on the active roster, but a record was saved here (F02). Read-only rows. */
  pastParticipants: SessionRosterRow[];
  types: RepTeamMeasurableType[];
  entries: RepPlayerMeasurable[];
  events: SessionEventOption[];
  notAssessed: RepEvaluationNotAssessed[];
  observations: RepPlayerObservation[];
  showObservations: boolean;
  authors: Record<string, string>;
  canWrite: boolean;
  canWriteObservations: boolean;
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

/**
 * ═══ THE RECORD SCREEN (development lifecycle Phase 2, mockup screen 3) ═══
 * Date, "Taken at" and the note are UNCHANGED (Phase 0 / Practice Plans rulings: the re-stamp,
 * the event pre-fill). New: the scope line, tests AND skills as chips, one field per attempt with
 * a live headline, per-row states with Edit / Retry / Mark not assessed, an observation from a
 * skill chip, and "Review session →" which reads the counts back against the scope and never
 * invents a zero or marks anything complete.
 */
function SessionView({ orgSlug, teamId, sessionId }: { orgSlug: string; teamId: string; sessionId: string }) {
  const confirm = useConfirm();
  const router = useRouter();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}`;

  const [data, setData] = useState<SessionWorld | null>(null);
  const [error, setError] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  // Drafts are keyed by player AND metric — a value typed under one test must never pre-fill (or
  // silently post against) another test's row (3B review fix). Each holds every attempt.
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [obsDrafts, setObsDrafts] = useState<Record<string, ObservationDraft>>({});
  const [rowErr, setRowErr] = useState('');

  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeUnit, setNewTypeUnit] = useState('');
  // The date input's own value while the coach is mid-edit. Null = show the saved date, so a
  // cancelled confirm snaps straight back to the truth rather than leaving a phantom date on screen.
  const [dateDraft, setDateDraft] = useState<string | null>(null);
  // One session mutation in flight at a time — see patchSession.
  const [sessionBusy, setSessionBusy] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeErr, setScopeErr] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);

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

  const {
    session, roster, pastParticipants, types, entries, events, notAssessed, observations, showObservations, authors,
    canWrite, canWriteObservations,
  } = data;
  /**
   * F02 (2026-09-11): what this session SHOWS is drawn from what is SAVED in it. Every active
   * metric is a chip (new entry may go under any of them); a retired one is a chip only when this
   * session holds a record for it, labelled and read-only. Phase 2: an observed SKILL is a chip
   * too — it records an observation (mockup screen 3).
   */
  const metricChips = sessionMetricChips(types, entries, [...observations.map(o => o.measurableTypeId), ...notAssessed.map(n => n.measurableTypeId)]);
  const activeTests = metricChips.filter(c => !c.retired).map(c => c.type).filter(isMeasuredTest);
  // With nothing chosen yet, the session opens on the first metric it already holds rows for, else
  // the first active one (`defaultSessionChip`). ⚠ A chosen chip that has since VANISHED resolves
  // to NOTHING, never to the first chip (/review 2026-09-12).
  const selectedChip = selectedTypeId
    ? (metricChips.find(c => c.type.id === selectedTypeId) ?? null)
    : defaultSessionChip(metricChips);
  const selectedType = selectedChip?.type ?? null;
  const selectedRetired = selectedChip?.retired ?? false;
  const isSkill = selectedType?.kind === 'skill';
  const draftKey = (playerId: string) => `${playerId}:${selectedType?.id ?? ''}`;

  // Roster order, then any past participant with a record under this metric. Counts are per
  // player, measured against the scope when one was stated (Phase 2), else the active roster.
  const rows: GridRow[] = selectedType
    ? sessionRows(roster, pastParticipants, entries, selectedType.id, { scopePlayerIds: session.scopePlayerIds, notAssessed })
    : [];
  const counts = sessionScopeCounts(rows, session.scopePlayerIds);
  const pastRows = rows.filter(r => r.pastParticipant).length;
  const scopeSaysMetric = !session.scopeMetricIds || !selectedType || session.scopeMetricIds.includes(selectedType.id);

  const linkedEvent = events.find(e => e.id === session.eventId) ?? null;
  // §10.2 ruling 2 — practices first, then nearest the session's date; the ONE ordering rule.
  const sessionEventOptions = orderEventsByAnchor(events, session.sessionDate);
  // The grid hands back a player id; the row's player object is looked up ONCE here.
  const rowPlayer = (pid: string) => rows.find(r => r.player.id === pid)?.player;

  // ── drafts (per player, per metric) ──
  const rowDraft = (playerId: string) => drafts[draftKey(playerId)] ?? emptyDraft();
  const setRowDraft = (playerId: string, patch: (d: RowDraft) => RowDraft) =>
    setDrafts(dr => ({ ...dr, [draftKey(playerId)]: patch(dr[draftKey(playerId)] ?? emptyDraft()) }));
  const obsDraft = (playerId: string) => obsDrafts[draftKey(playerId)] ?? emptyObservationDraft();
  const setObsDraft = (playerId: string, patch: (d: ObservationDraft) => ObservationDraft) =>
    setObsDrafts(dr => ({ ...dr, [draftKey(playerId)]: patch(dr[draftKey(playerId)] ?? emptyObservationDraft()) }));

  /**
   * Save ONE attempt: a new value POSTs (with its attempt number); a changed saved value PATCHes
   * (a correction — the original stays on the row); a cleared saved value is removed (a blank
   * attempt was not run). A failed value stays in the draft beside its error until Retry.
   */
  async function commitAttempt(player: SessionRosterRow, attemptNo: number) {
    if (!selectedType || !canWrite || selectedRetired || isSkill) return;
    const draft = rowDraft(player.id);
    if (draft.saving.has(attemptNo)) return;
    const raw = (draft.values[attemptNo - 1] ?? '').trim();
    const saved = entries.find(e => e.playerId === player.id && e.measurableTypeId === selectedType.id && e.attemptNo === attemptNo) ?? null;
    if (raw === '' && !saved) return; // never a zero
    if (raw !== '') {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 99999) {
        setRowDraft(player.id, d => ({ ...d, error: 'Enter a number between 0 and 99,999.' }));
        return;
      }
      if (saved && saved.value === value) { setRowDraft(player.id, d => ({ ...d, error: null })); return; }
    }
    setRowDraft(player.id, d => ({ ...d, saving: new Set(d.saving).add(attemptNo), error: null }));
    // The record moved under this write (a retry whose first try landed, another device on the
    // same row, a correction over a corrected value): the server says 409 (or 404 for a removal
    // that already happened), and the answer is to READ the row again, never to re-send — a
    // Retry that re-sent the same stale value would loop on the same refusal forever.
    let recordMoved = false;
    try {
      if (raw === '' && saved) {
        const res = await fetch(`${apiBase}/roster/${player.id}/development/measurables/${saved.id}`, { method: 'DELETE' });
        if (!res.ok) { recordMoved = res.status === 404; throw new Error('Could not remove the attempt — try again.'); }
        setData(d => d ? { ...d, entries: d.entries.filter(e => e.id !== saved.id) } : d);
      } else if (saved) {
        const res = await fetch(`${apiBase}/roster/${player.id}/development/measurables/${saved.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: Number(raw) }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) { recordMoved = res.status === 409; throw new Error(json?.error ?? 'Could not save the correction — try again.'); }
        setData(d => d ? { ...d, entries: d.entries.map(e => e.id === saved.id ? json.entry : e) } : d);
      } else {
        const res = await fetch(`${apiBase}/roster/${player.id}/development/measurables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            measurableTypeId: selectedType.id, value: Number(raw),
            // Readings belong to the SESSION's date, not the moment of typing.
            recordedOn: session.sessionDate, sessionId: session.id, attemptNo,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) { recordMoved = res.status === 409; throw new Error(json?.error ?? 'Could not save it — try again.'); }
        setData(d => d ? { ...d, entries: [...d.entries, json.entry] } : d);
      }
      setRowDraft(player.id, d => { const saving = new Set(d.saving); saving.delete(attemptNo); return { ...d, saving, error: null }; });
    } catch (e) {
      if (recordMoved && await load()) {
        // The row now shows what is on the record; Edit is the door to change it.
        setRowDraft(player.id, d => { const saving = new Set(d.saving); saving.delete(attemptNo); return { ...d, saving, editing: false, error: null }; });
        return;
      }
      setRowDraft(player.id, d => {
        const saving = new Set(d.saving); saving.delete(attemptNo);
        return { ...d, saving, error: e instanceof Error ? e.message : 'Not saved — try again.' };
      });
    }
  }

  /** Edit a saved row: open its fields pre-filled with the saved attempts. An attempt still on its
   *  way to the server (a blur a moment before the tap) keeps what was typed — its save lands into
   *  the record, not the draft, so refilling it from the record now would blank it. */
  function editRow(player: SessionRosterRow) {
    if (!selectedType) return;
    const saved = entries.filter(e => e.playerId === player.id && e.measurableTypeId === selectedType.id);
    setRowDraft(player.id, d => {
      const values = [...d.values];
      for (const e of saved) if (!d.saving.has(e.attemptNo)) values[e.attemptNo - 1] = String(e.value);
      return { ...d, values, editing: true, error: null };
    });
  }

  /** Retry every attempt the row holds a draft for — the typed values never left the screen. */
  async function retryRow(player: SessionRosterRow) {
    const draft = rowDraft(player.id);
    setRowDraft(player.id, d => ({ ...d, error: null }));
    for (let k = 1; k <= draft.values.length; k++) if ((draft.values[k - 1] ?? '').trim() !== '') await commitAttempt(player, k);
  }

  async function markNotAssessed(player: SessionRosterRow, mark: boolean) {
    if (!selectedType || !canWrite) return;
    try {
      const res = await fetch(`${apiBase}/development/sessions/${session.id}/not-assessed`, {
        method: mark ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id, measurableTypeId: selectedType.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save that — try again.');
      setData(d => {
        if (!d) return d;
        const rest = d.notAssessed.filter(n => !(n.playerId === player.id && n.measurableTypeId === selectedType.id));
        return { ...d, notAssessed: mark ? [...rest, json.notAssessed] : rest };
      });
    } catch (e) {
      setRowErr(`${player.playerFirstName}: ${e instanceof Error ? e.message : 'could not save that — try again.'}`);
    }
  }

  /** An observation from the skill chip: descriptor and/or what was seen, dated by the session. */
  async function commitObservation(player: SessionRosterRow) {
    if (!selectedType || !isSkill || !canWriteObservations || selectedRetired) return;
    const draft = obsDraft(player.id);
    if (draft.saving) return;
    const existing = observations.find(o => o.playerId === player.id && o.measurableTypeId === selectedType.id) ?? null;
    const descriptor = draft.descriptor.trim() || null;
    const note = draft.note.trim() || null;
    if (!descriptor && !note) {
      if (existing) setObsDraft(player.id, d => ({ ...d, error: 'Say what you saw, or choose a descriptor.' }));
      return;
    }
    if (existing && existing.descriptor === descriptor && existing.note === note) {
      setObsDraft(player.id, d => ({ ...d, editing: false, error: null }));
      return;
    }
    setObsDraft(player.id, d => ({ ...d, saving: true, error: null }));
    try {
      const url = existing
        ? `${apiBase}/roster/${player.id}/development/observations/${existing.id}`
        : `${apiBase}/roster/${player.id}/development/observations`;
      const res = await fetch(url, {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing
          ? { descriptor, note }
          : { measurableTypeId: selectedType.id, observedOn: session.sessionDate, sessionId: session.id, descriptor, note }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the observation — try again.');
      setData(d => d ? {
        ...d,
        observations: existing ? d.observations.map(o => o.id === existing.id ? json.observation : o) : [...d.observations, json.observation],
      } : d);
      setObsDraft(player.id, d => ({ ...d, saving: false, editing: false, error: null }));
    } catch (e) {
      setObsDraft(player.id, d => ({ ...d, saving: false, error: e instanceof Error ? e.message : 'Not saved — try again.' }));
    }
  }
  function editObservation(player: SessionRosterRow) {
    if (!selectedType) return;
    const existing = observations.find(o => o.playerId === player.id && o.measurableTypeId === selectedType.id);
    setObsDraft(player.id, d => ({ ...d, descriptor: existing?.descriptor ?? '', note: existing?.note ?? '', editing: true, error: null }));
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
    body: { sessionDate?: string; eventId?: string | null; scope?: { metricIds: string[]; playerIds: string[] } },
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
        if (body.scope) setScopeErr(json?.error ?? failure); else setRowErr(json?.error ?? failure);
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

  /**
   * D10 — change the session's date. ⚠ Every reading already entered here moves with it (the
   * re-stamp). The coach is told the exact count BEFORE it happens; with nothing entered yet
   * there is no dialog at all (§10.2 ruling 4).
   */
  async function saveSessionDate(nextDate: string) {
    if (!nextDate || nextDate === session.sessionDate) { setDateDraft(null); return; }
    const readingCount = entries.length;
    if (readingCount > 0) {
      const moving = `${readingCount} reading${readingCount === 1 ? '' : 's'}`;
      const ok = await confirm({
        title: 'Move this session?',
        message: `Move this session to ${formatWeekdayDate(nextDate)}? The ${moving} already entered here move with it.`,
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
   * D10 — link the session to the event its readings were taken at. ⚠ Picking an event
   * PRE-FILLS the date; it never derives it (§10.2 ruling 1). The pre-fill only applies to a
   * session with NOTHING entered yet. The link and the pre-filled date go in ONE request.
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

  async function saveScope(v: { scope: { metricIds: string[]; playerIds: string[] } }) {
    setScopeErr('');
    const ok = await patchSession({ scope: v.scope }, "Couldn't save the scope — try again.");
    if (ok) setScopeOpen(false);
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

  const scopeLine = session.scopePlayerIds && session.scopeMetricIds
    ? `${session.scopePlayerIds.length} selected player${session.scopePlayerIds.length === 1 ? '' : 's'} · ${session.scopeMetricIds.length} metric${session.scopeMetricIds.length === 1 ? '' : 's'}`
    : null;

  return (
    <div className={styles.page}>
      <CoachPageHeader
        icon={ClipboardCheck}
        title="Evaluation session"
        backTo={{ href: `${base}/development`, label: 'Skills & Goals' }}
        helpLabel="Skills & Goals"
        help={{ module: 'coaches', sectionIds: ['premium-development'], fullGuideHref: `/${orgSlug}/coaches/help#premium-development` }}
      />

      {/* Page-header ruling 2026-08-11: the session date moves out of the subtitle into the body.
          A coach who can WRITE already has it in the editable Date field below — printing it twice
          would be the same fact in two places — so the summary strip is the read-only viewer's
          only copy of it. */}
      {!canWrite && (
        <p className={styles.pageSummaryStrip}>{formatWeekdayDate(session.sessionDate)}</p>
      )}

      {/* ── When and where these readings were taken (D10) — UNCHANGED ──
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
              {/* Short date in the OPTIONS: a select is as wide as its longest option, and
                  "Wednesday, September 9 — Throwing stations" spilled the 361px column. */}
              {sessionEventOptions.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {formatShortDate(ev.startsAt.slice(0, 10))} — {ev.name}
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

      {/* Session note — a label like "post-break testing"; saves on blur/Enter. UNCHANGED. */}
      {canWrite ? (
        <div className={`${styles.field} ${styles.devSessionNote}`} style={{ maxWidth: 420, margin: '0 0 0.7rem' }}>
          <label className={styles.label} htmlFor="dev-session-note">Session note (optional)</label>
          <input id="dev-session-note" className={styles.input} type="text" maxLength={200}
            defaultValue={session.note ?? ''} placeholder='e.g. "post-break testing"'
            onBlur={e => saveNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        </div>
      ) : session.note ? (
        <p className={styles.devCardNote} style={{ marginBottom: '0.7rem' }}>{session.note}</p>
      ) : null}

      {/* ── The scope (Phase 2) — what this session is for. A session with no scope claims only
            what was recorded: the counts run against the roster, as Phase 0 made it. ── */}
      <p className={css.scopeLine}>
        <strong>Scope:</strong>{' '}
        {scopeLine ?? 'not stated — counts run against the active roster'}
        {canWrite && (
          <button type="button" className={css.rowLink} onClick={() => { setScopeErr(''); setScopeOpen(true); }}>
            {scopeLine ? 'Change scope' : 'Set the scope'}
          </button>
        )}
      </p>

      {/* Metric picker — worded select-one chips (lime-tint active, never solid primary). Tests
          AND observed skills (Phase 2); a retired one only when it holds rows here (F02). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', margin: '0.2rem 0 0.6rem' }}>
        {metricChips.map(({ type: t, retired }) => (
          <button key={t.id} type="button"
            className={`${styles.badge} ${selectedType?.id === t.id ? styles.badgeActive : styles.badgeDraft}`}
            style={{ cursor: 'pointer', minHeight: 'var(--tap-min, 44px)' }}
            title={retired ? 'Retired from new sessions — its saved records stay here' : undefined}
            onClick={() => { setSelectedTypeId(t.id); setRowErr(''); }}>
            {t.name}{retired && <span className={styles.devRowDash}> · retired</span>}
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
      {canWrite && (newTypeOpen || activeTests.length === 0) && (
        <div style={{ margin: '0 0 0.8rem' }}>
          <NewTypeFields idPrefix="dev-session-newtype" name={newTypeName} unit={newTypeUnit}
            onName={setNewTypeName} onUnit={setNewTypeUnit} onAdd={addType}
            metricsHref={skillsAndGoalsHref(base, 'metrics')} />
        </div>
      )}

      {selectedType ? (
        rows.length === 0 ? (
          <p className={styles.detailPlaceholder}>No active roster for this season — add players from the Roster page first.</p>
        ) : (
          <>
            {/* The method — how the test is run — said where the numbers are typed, from the definition. */}
            <div className={css.method}>
              <strong>{selectedType.method ?? recordMeaning(selectedType)}</strong>
              {isSkill ? (
                showObservations ? (
                  canWriteObservations
                    ? <p>Choose a descriptor and/or say what you saw — saves when you leave a field. Enter moves to the next player.</p>
                    : <p>Recording an observation needs the Development grant and Internal notes — the head coach can turn both on from Staff.</p>
                ) : (
                  <p>Observations are read with Internal notes — ask your head coach to turn it on to see or record them here.</p>
                )
              ) : selectedRetired ? (
                <p>This test is retired — its saved results stay here, read-only.</p>
              ) : (
                <p>Saves when you leave a field. Enter moves to the next attempt, then the next player. A blank attempt was not run — never a zero, never a failed test.</p>
              )}
            </div>
            {!scopeSaysMetric && (
              <p className={styles.devCardNote} style={{ marginBottom: '0.4rem' }}>This metric is outside the session’s scope — anything recorded here is kept, and the counts below say so.</p>
            )}
            {rowErr && <p className={styles.errorText} role="alert">{rowErr}</p>}
            {(!isSkill || showObservations) && (
              <div className={styles.detailSection} style={{ padding: '0.25rem 0' }}>
                <SessionRecordGrid
                  type={selectedType}
                  rows={rows}
                  draftFor={rowDraft}
                  observationDraftFor={obsDraft}
                  observations={observations}
                  authors={authors}
                  canWrite={canWrite}
                  canWriteObservations={canWriteObservations}
                  retired={selectedRetired}
                  onAttemptChange={(pid, k, v) => setRowDraft(pid, d => { const values = [...d.values]; values[k - 1] = v; return { ...d, values }; })}
                  onAttemptCommit={(pid, k) => { const p = rowPlayer(pid); if (p) commitAttempt(p, k); }}
                  onEdit={pid => { const p = rowPlayer(pid); if (p) editRow(p); }}
                  onRetry={pid => { const p = rowPlayer(pid); if (p) retryRow(p); }}
                  onMarkNotAssessed={pid => { const p = rowPlayer(pid); if (p) markNotAssessed(p, true); }}
                  onUnmarkNotAssessed={pid => { const p = rowPlayer(pid); if (p) markNotAssessed(p, false); }}
                  onObservationChange={(pid, patch) => setObsDraft(pid, d => ({ ...d, ...patch }))}
                  onObservationCommit={pid => { const p = rowPlayer(pid); if (p) commitObservation(p); }}
                  onObservationEdit={pid => { const p = rowPlayer(pid); if (p) editObservation(p); }}
                />
              </div>
            )}
            <div className={css.foot}>
              <p className={styles.devCardNote} style={{ margin: 0 }}>
                {scopeSentence(counts)} — {selectedType.name}{selectedType.unit ? ` (${selectedType.unit})` : ''}.
                {pastRows > 0 && ` ${pastRows} record${pastRows === 1 ? '' : 's'} from ${pastRows === 1 ? 'a player' : 'players'} no longer on the roster ${pastRows === 1 ? 'is' : 'are'} listed above.`}
              </p>
              <button type="button" className={styles.btnPrimary} style={{ minHeight: 'var(--tap-min, 44px)' }} onClick={() => setReviewOpen(true)}>Review session →</button>
            </div>
          </>
        )
      ) : (
        <p className={styles.detailPlaceholder}>
          {metricChips.length > 0
            ? 'Pick a metric above.'
            : canWrite ? 'Set up your first test above — then work down the roster.' : 'No tests set up yet.'}
        </p>
      )}

      {scopeOpen && (
        <SessionScopeDialog
          mode="change"
          types={metricChips.filter(c => !c.retired).map(c => c.type)}
          roster={roster}
          events={[]}
          initial={session.scopeMetricIds && session.scopePlayerIds ? { metricIds: session.scopeMetricIds, playerIds: session.scopePlayerIds } : null}
          busy={sessionBusy}
          error={scopeErr}
          onSubmit={saveScope}
          onClose={() => setScopeOpen(false)}
        />
      )}
      {reviewOpen && selectedType && (
        <SessionReviewDialog
          session={session}
          types={metricChips.map(c => c.type)}
          roster={roster}
          pastParticipants={pastParticipants}
          entries={entries}
          observations={observations}
          notAssessed={notAssessed}
          onClose={() => setReviewOpen(false)}
          onBack={() => router.push(skillsAndGoalsHref(base, 'sessions'))}
        />
      )}
    </div>
  );
}

/**
 * "Review session →" — counts what was recorded against the scope for EVERY metric the session
 * touched, never invents a zero, never marks the session complete; offers "Back to Sessions".
 * A legacy session (no scope) reviews against the roster.
 */
function SessionReviewDialog({
  session, types, roster, pastParticipants, entries, observations, notAssessed, onClose, onBack,
}: {
  session: RepTeamEvaluationSession;
  types: RepTeamMeasurableType[];
  roster: SessionRosterRow[];
  pastParticipants: SessionRosterRow[];
  entries: RepPlayerMeasurable[];
  observations: RepPlayerObservation[];
  notAssessed: RepEvaluationNotAssessed[];
  onClose: () => void;
  onBack: () => void;
}) {
  const scoped = !!session.scopeMetricIds;
  // The metrics in scope (or, with no scope, every metric that holds a record here).
  const inScope = types.filter(t => scoped
    ? session.scopeMetricIds!.includes(t.id) || entries.some(e => e.measurableTypeId === t.id) || observations.some(o => o.measurableTypeId === t.id)
    : entries.some(e => e.measurableTypeId === t.id) || observations.some(o => o.measurableTypeId === t.id));
  const lines = inScope.map(t => {
    // An observation is a skill's "entry" for counting — one per player, never a value.
    const asEntries = t.kind === 'skill'
      ? observations.filter(o => o.measurableTypeId === t.id).map(o => ({ id: o.id, playerId: o.playerId, measurableTypeId: t.id, attemptNo: 1 }))
      : entries.filter(e => e.measurableTypeId === t.id);
    const rows = sessionRows(roster, pastParticipants, asEntries, t.id, { scopePlayerIds: session.scopePlayerIds, notAssessed });
    const c = sessionScopeCounts(rows, session.scopePlayerIds);
    const fewer = t.kind === 'test' && t.attemptsPerSession > 1
      ? rows.filter(r => r.entries.length > 0 && r.entries.length < t.attemptsPerSession).length
      : 0;
    return { type: t, sentence: scopeSentence(c), fewer };
  });
  return (
    <QuestionShell open onClose={onClose} ariaLabel="Review this session" title="Review this session">
        <div className={styles.formBody}>
          <p className={css.reviewCounts}>
            {formatWeekdayDate(session.sessionDate)}{session.note ? ` — ${session.note}` : ''}
          </p>
          {lines.length === 0 ? (
            <p className={styles.detailPlaceholder}>Nothing recorded yet.</p>
          ) : (
            <ul className={css.reviewList}>
              {lines.map(l => (
                <li key={l.type.id}>
                  <strong>{l.type.name}</strong> — {l.sentence}
                  {l.fewer > 0 && ` · ${l.fewer} player${l.fewer === 1 ? '' : 's'} with fewer than ${l.type.attemptsPerSession} attempts — recorded with fewer, nothing filled in`}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.formHint}>
            {scoped
              ? 'The scope is the players and metrics you chose. Unrecorded players stay unrecorded; a review never creates a zero and never marks the session “complete” on your behalf.'
              : 'This session has no stated scope, so the counts run against the active roster. A review never creates a zero and never marks the session “complete” on your behalf.'}
          </p>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onBack}>Back to Sessions</button>
          <button type="button" className={styles.btnPrimary} onClick={onClose}>Return to recording</button>
        </div>
    </QuestionShell>
  );
}
