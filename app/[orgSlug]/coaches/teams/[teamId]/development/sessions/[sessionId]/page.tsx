'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import MetricDefinitionSheet from '@/components/coaches/MetricDefinitionSheet';
import SessionSheet, { type SessionFacts, type SessionPlan, type SessionRosterRow, type SessionEventOption } from '@/components/coaches/SessionSheet';
import RecordObservationDialog from '@/components/coaches/RecordObservationDialog';
import { observationEditPatch } from '@/lib/development-input';
import SessionRecordGrid, {
  emptyDraft, type GridRow, type RowDraft,
} from '@/components/coaches/SessionRecordGrid';
import { recordMeaning } from '@/lib/measurable-definition';
import { skillsAndGoalsHref } from '@/lib/development-address';
import { formatWeekdayDate } from '@/lib/measurable-format';
import { playerName } from '@/lib/coach-roster-name';
import {
  sessionMetricChips, sessionRows, sessionScopeCounts, scopeSentence, chipProgressByType, defaultSessionChip, plannedAttempts,
  lastPlannedCounts, lastRunDates, scopeSummary, sessionReview, sessionTitle, sessionName, planCandidates, type ReviewRow,
} from '@/lib/development-session-view';
import styles from '../../../../../coaches.module.css';
import css from '@/components/coaches/DevelopmentSession.module.css';
import type {
  RepTeamEvaluationSession, RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerObservation, RepEvaluationNotAssessed,
  RepPlayerDevelopmentGoal,
} from '@/lib/types';

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
  /** Every active roster player's goals (any status) — the observation sheet's own "Evidence for"
   *  list, filtered per player when the sheet opens. Gated with observations (showObservations). */
  goals: RepPlayerDevelopmentGoal[];
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
 * ═══ THE RECORD SCREEN (development lifecycle Phase 2, mockup screen 3; re-evaluation stage 2,
 * owner rulings C1–C10, 2026-09-15) ═══
 * The page OPENS ON THE WORK (C6): titled by the session, one when-line under it (the day — or the
 * practice as a door, since a linked session's date IS the practice's (C10) — the plan, Change ›),
 * the chips that ARE the scope with a done-count each (C3), the method as one line with the how-to
 * behind the ?, and the grid on the white card ground. The session's facts — when, the note, what
 * we are running with a count per test, who is here — live in ONE sheet (`SessionSheet`, C4),
 * opened by Change ›; Delete session lives in its footer. "Review session →" reads the counts back
 * as a table and the NAMES a coach acts on (C8), stores nothing, and lets a test that never ran be
 * dropped from the plan where the coach finds out (C9). A skill's row never saves on its own
 * (C12, owner ruling 2026-09-15): a blank row is one door into the observation sheet — the
 * player's own "Record an observation" with the skill and the date fixed here — and Edit on a
 * saved row opens the same sheet; the page owns the save and the sheet holds the form.
 */
function SessionView({ orgSlug, teamId, sessionId }: { orgSlug: string; teamId: string; sessionId: string }) {
  const confirm = useConfirm();
  const router = useRouter();
  const { openHelp } = useHelpDrawer();
  /* ≤640, read live. Two things on this page ask: the docked count bar (E4) and the grid's own
     door rows (E2, inside the grid). Both are different DOM, not one shape restyled. */
  const isPhone = useIsPhone();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}`;
  // A session is a room inside Skills & Goals: the subtree's layout answers a coach without the
  // Development grant before this mounts (D5), and the GET refuses the same coach.

  const [data, setData] = useState<SessionWorld | null>(null);
  const [error, setError] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  // Drafts are keyed by player AND metric — a value typed under one test must never pre-fill (or
  // silently post against) another test's row (3B review fix). Each holds every attempt.
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  // The observation sheet (C12): which player's row opened it, and the observation it edits, if any.
  // The skill is CAPTURED at open (not read live from the chip), so a chip that changes under the
  // sheet can never re-title it or re-address its write (/review 2026-09-15).
  const [obsSheet, setObsSheet] = useState<{ player: SessionRosterRow; skill: RepTeamMeasurableType; existing: RepPlayerObservation | null } | null>(null);
  // After a NEW observation saves, its door is gone from the row — the floor's focus restore has
  // nothing to land on. Focus moves on to the next row's door (the grid's own rhythm: Enter → next
  // player), or to the saved row's Edit when there is none; the effect below runs after that commit.
  const [obsFocusAfter, setObsFocusAfter] = useState<string | null>(null);
  useEffect(() => {
    if (!obsFocusAfter) return;
    setObsFocusAfter(null);
    const row = document.querySelector<HTMLElement>(`[data-player-row="${obsFocusAfter}"]`);
    if (!row) return;
    /* ⚠ `matches` AS WELL AS `querySelector`, because at ≤640 the ROW IS THE DOOR (stage 4 · E2):
       the door marker sits on the row element itself, and `querySelector` never matches the element
       it is called on — so the phone would have walked to the end of the list and focused nothing. */
    const doorIn = (el: Element): HTMLElement | null =>
      (el.matches('[data-observation-door]') ? el as HTMLElement : el.querySelector<HTMLElement>('[data-observation-door]'));
    let next: Element | null = row.nextElementSibling;
    while (next && !doorIn(next)) next = next.nextElementSibling;
    const target = (next && doorIn(next)) ?? doorIn(row) ?? row.querySelector<HTMLElement>('button');
    target?.focus();
  }, [obsFocusAfter]);
  const [obsBusy, setObsBusy] = useState(false);
  const [obsErr, setObsErr] = useState('');
  const [rowErr, setRowErr] = useState('');

  // "+ New test…" opens the SAME definition sheet the Metrics tab uses (re-evaluation stage 1,
  // 2026-09-14): a test defined at the fence is a whole test, never the name-and-unit shortcut
  // that used to leave "method not recorded" in every report. Saved, it joins this session's plan
  // with one attempt (stage 2, C3) and becomes the chip on screen.
  const [defineOpen, setDefineOpen] = useState(false);
  // One session mutation in flight at a time — see patchSession.
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetErr, setSheetErr] = useState('');
  // The team's other sessions, read once when the Change sheet first opens: the pre-fill for a test
  // added to the plan here is the count the team used the LAST time it ran it (C1), which this
  // session alone cannot say (/review 2026-09-15). A failed read falls back to this session.
  const [teamSessions, setTeamSessions] = useState<RepTeamEvaluationSession[] | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  /**
   * Sequence guard: a slow earlier response must never stomp a newer one.
   *
   * This reload runs after every sheet save, so two in quick succession can resolve out of order
   * and land the OLDER session on screen — the header would then disagree with what the coach
   * just chose. Same guard the practice-plan drill-in uses.
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
    session, roster, pastParticipants, types, entries, events, notAssessed, observations, goals, showObservations, authors,
    canWrite, canWriteObservations,
  } = data;
  /**
   * The chips ARE the scope (stage 2, C3): the metrics chosen for this session, then anything
   * recorded here outside it ("· outside the scope"), then a retired one that holds a record here
   * ("· retired", read-only — F02). A session with no stated scope offers every active metric.
   */
  const recordedTypeIds = [...observations.map(o => o.measurableTypeId), ...notAssessed.map(n => n.measurableTypeId)];
  const metricChips = sessionMetricChips(types, entries, recordedTypeIds, session.scopeMetricIds);
  // With nothing chosen yet, the session opens on its plan's first chip (`defaultSessionChip`).
  // ⚠ A chosen chip that has since VANISHED resolves to NOTHING, never to the first chip (/review 2026-09-12).
  const selectedChip = selectedTypeId
    ? (metricChips.find(c => c.type.id === selectedTypeId) ?? null)
    : defaultSessionChip(metricChips, !!session.scopeMetricIds);
  const selectedType = selectedChip?.type ?? null;
  const selectedRetired = selectedChip?.retired ?? false;
  const isSkill = selectedType?.kind === 'skill';
  const draftKey = (playerId: string) => `${playerId}:${selectedType?.id ?? ''}`;

  // Roster order, then any past participant with a record under this metric. Counts are per
  // player, measured against the scope when one was stated (Phase 2), else the active roster.
  const rowsFor = (typeId: string): GridRow[] =>
    sessionRows(roster, pastParticipants, entries, typeId, { scopePlayerIds: session.scopePlayerIds, notAssessed, observations });
  const rows: GridRow[] = selectedType ? rowsFor(selectedType.id) : [];
  const counts = sessionScopeCounts(rows, session.scopePlayerIds);
  const pastRows = rows.filter(r => r.pastParticipant).length;
  // The session's planned count for this test (C1) — null on a session from before the count existed.
  const planned = selectedType && !isSkill ? plannedAttempts(session, selectedType.id) : null;
  /** "3 of 5" — every chip's done-count from the ONE rule, one pass per render for the chips AND the phone's dropdown. */
  const progressByType = chipProgressByType(session, metricChips.map(c => c.type.id), roster, entries, notAssessed, observations);
  const progress = (typeId: string) => { const p = progressByType.get(typeId); return p ? `${p.done} of ${p.total}` : ''; };
  const chipLabel = (chip: (typeof metricChips)[number]) =>
    `${chip.type.name}${chip.retired ? ' · retired' : chip.outsideScope ? ' · outside the scope' : ''}`;

  const linkedEvent = events.find(e => e.id === session.eventId) ?? null;
  const plan = scopeSummary(session, types);
  const title = sessionTitle(session);
  /* The page titles itself with the session's NAME; the day lives on the when-line one row down and
     nowhere else (E5). `title` — the long form — is still what the review dialog and the
     observation sheet quote, because there a session is one among many and its date is the fact
     being stated. See `sessionName` for why the pair exists. */
  const pageTitle = sessionName(session);
  // The grid hands back a player id; the row's player object is looked up ONCE here.
  const rowPlayer = (pid: string) => rows.find(r => r.player.id === pid)?.player;

  /**
   * ── "Save & next player" — THE NEXT UNRECORDED ROW, NOT THE NEXT ROW (stage 4 · E3) ──
   * The whole point of the dialog's docked foot: a coach records whoever is in front of them and
   * never walks back to the list. So this skips anyone already accounted for (an observation or a
   * not-assessed mark), anyone OUTSIDE the session's scope, and any past participant whose row is
   * read-only — the scoped fixture is the one that proves it, which is why §10.7 asks for that
   * fixture by name.
   *
   * ⚠ FORWARD ONLY, and it is offered only when there IS someone ahead. It does not wrap: a coach
   * who started at #5 is not silently carried back to #1 by a button that says "next". When nobody
   * is left ahead the offer is absent rather than inert, so the button never means nothing — and
   * the list, which shows every remaining chip, is the honest way back to anyone skipped.
   *
   * ⚠ Read BEFORE the save, not after. The only row the save changes is the current player's, so
   * the answer cannot go stale — and computing it after would mean waiting on the reload.
   */
  const nextUnrecordedAfter = (playerId: string): GridRow['player'] | null => {
    const at = rows.findIndex(r => r.player.id === playerId);
    if (at < 0) return null;
    for (const r of rows.slice(at + 1)) {
      if (!r.inScope || r.pastParticipant) continue;
      if (r.observation || r.notAssessed) continue;
      return r.player;
    }
    return null;
  };
  const obsNext = obsSheet ? nextUnrecordedAfter(obsSheet.player.id) : null;

  // What a drop from the plan would touch, per metric (C9): the results saved here AND the
  // not-assessed marks — "delete them too" removes both, so the question counts both.
  const recordedCounts: Record<string, { results: number; notAssessed: number }> = {};
  const touched = (id: string) => (recordedCounts[id] ??= { results: 0, notAssessed: 0 });
  for (const e of entries) touched(e.measurableTypeId).results += 1;
  for (const n of notAssessed) touched(n.measurableTypeId).notAssessed += 1;

  // ── drafts (per player, per metric) ──
  const rowDraft = (playerId: string) => drafts[draftKey(playerId)] ?? emptyDraft();
  const setRowDraft = (playerId: string, patch: (d: RowDraft) => RowDraft) =>
    setDrafts(dr => ({ ...dr, [draftKey(playerId)]: patch(dr[draftKey(playerId)] ?? emptyDraft()) }));

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
            // Results belong to the SESSION's date, not the moment of typing.
            recordedOn: session.sessionDate, sessionId: session.id, attemptNo,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) { recordMoved = res.status === 409; throw new Error(json?.error ?? 'Could not save it — try again.'); }
        setData(d => d ? { ...d, entries: [...d.entries, json.entry] } : d);
      }
      // A box the "+" opened is spent once its attempt is saved — the saved attempt now holds the row's
      // floor up, so the extra must not linger as a fourth empty box beside it (C2).
      const savedMaxBefore = entries.filter(e => e.playerId === player.id && e.measurableTypeId === selectedType.id).reduce((m, e) => Math.max(m, e.attemptNo), 0);
      const spent = Math.max(0, attemptNo - Math.max(1, planned ?? 1, savedMaxBefore));
      setRowDraft(player.id, d => { const saving = new Set(d.saving); saving.delete(attemptNo); return { ...d, saving, error: null, extra: Math.max(0, d.extra - spent) }; });
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

  /**
   * Mark (or clear) "not assessed" for one player against one metric in this session.
   *
   * ⚠ THE METRIC IS A PARAMETER, not read live from the chip (stage 4 · E3). The row's own link
   * passes the selected chip, which is what it has always done; the observation dialog's fourth
   * answer passes the skill it CAPTURED when it opened — the same discipline the sheet already
   * applies to its title and its write, so a chip that changes cannot re-address someone else's
   * mark. Returns whether it landed, because the dialog has to know before it closes.
   */
  async function markNotAssessed(
    player: SessionRosterRow, mark: boolean, forType?: RepTeamMeasurableType, reason?: string | null,
  ): Promise<boolean> {
    const type = forType ?? selectedType;
    if (!type || !canWrite) return false;
    try {
      const res = await fetch(`${apiBase}/development/sessions/${session.id}/not-assessed`, {
        method: mark ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        /* The REASON is the mark's own field and the row reads it back ("— left early"). The row's
           link has never asked for one, so it stays undefined there; the dialog's fourth answer
           carries whatever the coach typed beside it. */
        body: JSON.stringify({ playerId: player.id, measurableTypeId: type.id, ...(reason ? { reason } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save that — try again.');
      setData(d => {
        if (!d) return d;
        const rest = d.notAssessed.filter(n => !(n.playerId === player.id && n.measurableTypeId === type.id));
        return { ...d, notAssessed: mark ? [...rest, json.notAssessed] : rest };
      });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'could not save that — try again.';
      setRowErr(`${player.playerFirstName}: ${message}`);
      return false;
    }
  }

  /**
   * The observation sheet (C12): opened by a blank skill row's door (a new observation) or by Edit
   * on a saved one. The sheet holds the descriptor and the sentence; this page writes them —
   * a new one POSTs against the session's date, a changed one PATCHes — and the row reads Saved.
   */
  function openObservation(player: SessionRosterRow) {
    if (!selectedType || !isSkill || !canWriteObservations || selectedRetired) return;
    const existing = observations.find(o => o.playerId === player.id && o.measurableTypeId === selectedType.id) ?? null;
    setObsErr('');
    /* ⚠ And clear the page's own banner (/review, 2026-09-22). A failed mark-write inside the dialog
       sets `rowErr`, which renders ABOVE THE GRID — invisible while a full-screen sheet is open, and
       nothing in the dialog's flow cleared it. A coach who retried, or advanced with "Save & next
       player", came back to a stale error attributed to a player they had long since left. */
    setRowErr('');
    setObsSheet({ player, skill: selectedType, existing });
  }
  async function submitObservation(v: {
    observedOn: string; note: string; descriptor: string; goalId: string | null;
    notAssessedToday?: boolean; andNext?: boolean;
  }) {
    if (!obsSheet || obsBusy) return;
    const { player, skill, existing } = obsSheet;
    /* Read the next player BEFORE the write (E3): the only row this save changes is the current
       one, so the answer cannot go stale, and nothing has to wait on the reload. */
    const next = v.andNext ? nextUnrecordedAfter(player.id) : null;
    const marked = notAssessed.find(n => n.playerId === player.id && n.measurableTypeId === skill.id) ?? null;
    const wasMarked = !!marked;
    /**
     * ── "Not assessed today" IS AN ANSWER, AND IT WRITES SOMEWHERE ELSE (stage 4 · E3) ──
     * The fourth answer is not an observation: it is the session's not-assessed mark, the same
     * record the desktop row's "Mark not assessed" link writes, so it goes to that route and not to
     * this one. The sentence a coach typed beside it travels as that mark's REASON — the row reads
     * it back ("— left early") — because the first build dropped it silently (see the dialog).
     *
     * ⚠⚠ THE DESTRUCTIVE HALF GOES **LAST**, AND THAT ORDER IS THE WHOLE POINT (/review, 2026-09-22).
     * The first build cleared the mark FIRST and then wrote the observation, so a coach turning a
     * marked row into a real record could lose both: the DELETE landed, the POST failed on a field
     * network blip, and the dialog said "Not saved — try again" — which reads as *nothing happened*
     * while the mark had already gone. A player deliberately marked not-assessed ended up with
     * neither a mark nor a record, and nothing on screen said so.
     *
     * So: **write the record first; clear the mark only once the record exists.** The two failure
     * modes are then both non-destructive —
     *   · the record fails → the mark is untouched, and the error tells the truth;
     *   · the record lands but the clear fails → the coach has what they asked for, and a stale mark
     *     that is INVISIBLE and harmless, because a record outranks a mark everywhere in this
     *     product: `rowState` tests `hasEntries` first, and the counts only ever score a mark for a
     *     player who has no record (`!r.recorded && r.notAssessed`), so nothing double-counts. The
     *     next save of that row clears it.
     * There is no transaction available across two routes; ordering is the entire mitigation, so do
     * not "tidy" these two steps back together.
     */
    if (v.notAssessedToday) {
      // Setting the mark writes nothing else, so there is no ordering question on this path.
      /* Re-writing the mark is how its REASON is corrected, so the condition is "new mark, or the
         coach changed the sentence" — the dialog seeds the field from the stored reason, so an
         untouched one arrives unchanged and a cleared one is a deliberate clear. */
      if (!wasMarked || v.note.trim() !== (marked?.reason ?? '')) {
        setObsBusy(true); setObsErr('');
        const landed = await markNotAssessed(player, true, skill, v.note.trim() || null);
        setObsBusy(false);
        if (!landed) { setObsErr(rowErr || 'Could not save that — try again.'); return; }
      }
      setObsSheet(null);
      if (next) openObservation(next);
      return;
    }
    // An edit sends ONLY what changed (a descriptor the skill has since dropped is never re-sent
    // untouched); nothing changed closes without a request. The date is fixed here; the goal is not.
    const patch = existing ? observationEditPatch(existing, { ...v, observedOn: existing.observedOn }) : null;
    // Nothing changed: no request. "Save & next player" still means move on, so the walk continues.
    if (existing && !patch) { setObsSheet(null); if (next) openObservation(next); return; }
    setObsBusy(true); setObsErr('');
    try {
      const url = existing
        ? `${apiBase}/roster/${player.id}/development/observations/${existing.id}`
        : `${apiBase}/roster/${player.id}/development/observations`;
      const res = await fetch(url, {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing
          ? patch
          : { measurableTypeId: skill.id, observedOn: session.sessionDate, sessionId: session.id, descriptor: v.descriptor || null, note: v.note.trim() || null, goalId: v.goalId }),
      });
      const json = await res.json().catch(() => null);
      // Another coach recorded this cell meanwhile (409): READ it, never re-send — the row shows theirs.
      if (res.status === 409) { setObsSheet(null); await load(); return; }
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the observation — try again.');
      setData(d => d ? {
        ...d,
        observations: existing ? d.observations.map(o => o.id === existing.id ? json.observation : o) : [...d.observations, json.observation],
      } : d);
      /* ⚠ THE RECORD EXISTS NOW, SO THE MARK MAY GO — and only now (see the ordering note above).
         A failure here leaves the coach with the record they asked for and an invisible stale mark,
         which is the harmless half of the trade; it is surfaced on the row rather than swallowed. */
      if (wasMarked) await markNotAssessed(player, false, skill);
      setObsSheet(null);
      /* "Save & next player": the dialog does not close onto the list, it re-opens on the next
         player who still needs recording (E3) — which is the whole reason the foot has two buttons.
         The focus-restore dance below is for plain Save, where the coach IS returning to the list. */
      if (next) { openObservation(next); return; }
      if (!existing) setObsFocusAfter(player.id);
    } catch (e) {
      setObsErr(e instanceof Error ? e.message : 'Not saved — try again.');
    } finally {
      setObsBusy(false);
    }
  }

  /**
   * ONE session mutation at a time.
   *
   * A date change is a TWO-statement server operation (re-stamp the results, then move the
   * session). Two of those interleaving can land as `re-stamp A → re-stamp B → move B → move A`:
   * the results end on B's date while the session says A's — exactly the "session disagrees with
   * its own contents" corruption the re-stamp exists to prevent, rebuilt one level up. Serialising
   * the writes closes it.
   */
  async function patchSession(
    body: { sessionDate?: string; eventId?: string | null; note?: string | null; scope?: SessionPlan; dropResultsFor?: string[] },
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
        setSheetErr(json?.error ?? failure);
        return false;
      }
      // Reload so any moved results' own dates are re-read rather than assumed. A failed
      // reload is surfaced, not swallowed — the PATCH succeeded but the screen is now stale.
      const reloaded = await load();
      if (!reloaded) setRowErr('Saved, but the screen could not refresh — reload the page.');
      // A plan change drops the drafts of any test it removed — a typed value is already saved or
      // errored by the blur that opened the sheet, but a row's "+" count must not resurface later.
      if (body.scope) {
        const kept = new Set(body.scope.metricIds);
        setDrafts(dr => Object.fromEntries(Object.entries(dr).filter(([k]) => kept.has(k.split(':')[1] ?? ''))));
      }
      return true;
    } finally {
      setSessionBusy(false);
    }
  }

  /**
   * The sheet's Save changes: the facts as one write. ⚠ A date change moves every attempt already
   * entered here (the re-stamp) — the coach is told the exact count BEFORE it happens; with nothing
   * entered yet there is no dialog at all (§10.2 ruling 4). Under C10 a session at a practice takes
   * the practice's day, so "At a practice" on a different day is a date change too.
   */
  async function saveFacts(v: SessionFacts & { dropResultsFor: string[] }) {
    setSheetErr('');
    if (v.sessionDate !== session.sessionDate && entries.length > 0) {
      const moving = `${entries.length} attempt${entries.length === 1 ? '' : 's'}`;
      const ok = await confirm({
        title: 'Move this session?',
        message: `Move this session to ${formatWeekdayDate(v.sessionDate)}? The ${moving} already entered here move with it.`,
        confirmText: 'Move the session',
        cancelText: 'Keep the date',
        tone: 'warning',
      });
      if (!ok) return;
    }
    const ok = await patchSession({
      sessionDate: v.sessionDate, eventId: v.eventId, note: v.note || null, scope: v.scope,
      ...(v.dropResultsFor.length > 0 ? { dropResultsFor: v.dropResultsFor } : {}),
    }, "Couldn't save the session — try again.");
    if (ok) setSheetOpen(false);
  }

  /** Delete session — in the sheet's footer (C4), behind the confirm the list used to carry. */
  async function deleteSession() {
    if (sessionBusy) return;
    const ok = await confirm({
      title: 'Delete this session?',
      message: 'Every result recorded in it stays on the players — they just lose the session grouping.',
      confirmText: 'Delete session',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setSessionBusy(true);
    try {
      const res = await fetch(`${apiBase}/development/sessions/${session.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      router.push(skillsAndGoalsHref(base, 'sessions'));
    } catch {
      setSheetErr("Couldn't delete the session — try again.");
      setSessionBusy(false);
    }
  }

  /** "Didn't run it tonight" (C9) — drop a test with nothing recorded from the plan, from the review. */
  async function dropFromPlan(typeId: string) {
    if (!session.scopeMetricIds || !session.scopePlayerIds) return;
    // A pre-count session stays one (null, never an empty map); a counted one loses the test's count.
    let attempts: Record<string, number> | null = null;
    if (session.scopeAttempts) { attempts = { ...session.scopeAttempts }; delete attempts[typeId]; }
    await patchSession({
      scope: { metricIds: session.scopeMetricIds.filter(id => id !== typeId), playerIds: session.scopePlayerIds, attempts },
    }, "Couldn't change the plan — try again.");
  }

  /** "+ New test…" — a whole test, and it joins tonight's plan with one attempt (C3). */
  async function typeDefined(type: RepTeamMeasurableType) {
    setDefineOpen(false);
    setRowErr('');
    setData(d => d ? { ...d, types: [...d.types, type] } : d);
    setSelectedTypeId(type.id);
    if (session.scopeMetricIds && session.scopePlayerIds && !session.scopeMetricIds.includes(type.id)) {
      await patchSession({
        scope: {
          metricIds: [...session.scopeMetricIds, type.id], playerIds: session.scopePlayerIds,
          attempts: type.kind === 'test' ? { ...(session.scopeAttempts ?? {}), [type.id]: 1 } : (session.scopeAttempts ?? {}),
        },
      }, "Couldn't add the test to the plan — try again.");
    }
  }

  async function openChange() {
    setSheetErr('');
    if (!teamSessions) {
      try {
        const res = await fetch(`${apiBase}/development/sessions`);
        const json = await res.json();
        if (res.ok && Array.isArray(json.sessions)) setTeamSessions(json.sessions);
      } catch { /* pre-fill falls back to this session alone */ }
    }
    setSheetOpen(true);
  }

  const helpRequest = { module: 'coaches' as const, sectionIds: ['premium-development'], subtopicId: 'premium-development-record', label: 'How recording works', fullGuideHref: `/${orgSlug}/coaches/help#premium-development` };
  const activeForSheet = planCandidates(types);

  return (
    <div className={styles.page}>
      <CoachPageHeader
        icon={ClipboardCheck}
        title={pageTitle}
        backTo={{ href: skillsAndGoalsHref(base, 'sessions'), label: 'Skills & Goals' }}
        helpLabel="Skills & Goals"
        help={{ module: 'coaches', sectionIds: ['premium-development'], fullGuideHref: `/${orgSlug}/coaches/help#premium-development` }}
      />

      {/* ── The when-line (C6): the day, the practice as a door (C10), the plan, Change › ──
          The plan's figures on the primary face ("5 players · 4 tests"), as drawn. A session from
          before plans existed says what its counts run against in a coach's words — the whole roster —
          not "no plan stated" (owner review, 2026-09-15). */}
      <p className={css.whenLine}>
        <strong>{formatWeekdayDate(session.sessionDate)}</strong>
        {linkedEvent && (
          <span>at <Link href={`${base}/practice/${linkedEvent.id}`} className={css.whenLink}>{linkedEvent.name}</Link> ›</span>
        )}
        <span className={css.whenSep} aria-hidden>·</span>
        {plan
          ? <span>{plan.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <b key={i}>{part}</b> : part))}</span>
          : <span><b>{roster.length}</b> {roster.length === 1 ? 'player' : 'players'} — the whole roster, no plan set</span>}
        {canWrite && (
          <button type="button" className={css.whenLink} onClick={openChange}>Change ›</button>
        )}
      </p>

      {/* ── The chips ARE the scope (C3), each with its done-count; a dropdown on a phone (C7) ── */}
      <div className={css.chips} role="tablist" aria-label="Tests and skills in this session">
        {metricChips.map(chip => (
          <button key={chip.type.id} type="button" role="tab" aria-selected={selectedType?.id === chip.type.id}
            className={`${styles.badge} ${selectedType?.id === chip.type.id ? styles.badgeActive : styles.badgeDraft} ${css.chip}`}
            title={chip.retired ? 'Retired from new sessions — its saved records stay here' : undefined}
            onClick={() => { setSelectedTypeId(chip.type.id); setRowErr(''); }}>
            {chipLabel(chip)}<small>{progress(chip.type.id)}</small>
          </button>
        ))}
        {canWrite && (
          <button type="button" className={`${styles.badge} ${styles.badgeDraft} ${css.chip} ${css.chipPlus}`} onClick={() => setDefineOpen(true)}>+ New test…</button>
        )}
      </div>
      {metricChips.length > 0 && (
        <label className={css.chipSelect}>
          <span className={styles.srOnly}>Test or skill</span>
          <select className={styles.select} value={selectedType?.id ?? ''} onChange={e => { setSelectedTypeId(e.target.value); setRowErr(''); }}>
            {metricChips.map(chip => (
              <option key={chip.type.id} value={chip.type.id}>{chipLabel(chip)} · {progress(chip.type.id)}</option>
            ))}
          </select>
        </label>
      )}
      {canWrite && metricChips.length === 0 && (
        <p className={styles.devCardNote} style={{ margin: '0 0 0.8rem' }}>No active test to record — define one with “+ New test…”.</p>
      )}
      {defineOpen && (
        <MetricDefinitionSheet orgSlug={orgSlug} teamId={teamId} typeId={null} onClose={() => setDefineOpen(false)} onSaved={t => void typeDefined(t)} />
      )}

      {selectedType ? (
        rows.length === 0 ? (
          <p className={styles.detailPlaceholder}>No active roster for this season — add players from the Roster page first.</p>
        ) : (
          <>
            {/* The method, one line — how the test is run, from the definition; the how-to behind the ? (C6). */}
            <div className={css.methodLine}>
              <span>
                {selectedType.method ?? recordMeaning(selectedType)}
                {selectedRetired && <span className={styles.devRowDash}> · retired — its saved results stay here, read-only</span>}
                {isSkill && !showObservations && <span className={styles.devRowDash}> · observations are read with Internal notes — ask your head coach to turn it on</span>}
                {isSkill && showObservations && !canWriteObservations && <span className={styles.devRowDash}> · recording an observation needs the Development grant and Internal notes</span>}
              </span>
              <button type="button" className={css.methodHelp} onClick={() => openHelp(helpRequest)}>
                How recording works <span className={css.methodHelpMark} aria-hidden>?</span>
              </button>
            </div>
            {rowErr && <p className={styles.errorText} role="alert">{rowErr}</p>}
            {(!isSkill || showObservations) && (
              <div className={css.gridCard}>
                <SessionRecordGrid
                  type={selectedType}
                  planned={planned}
                  rows={rows}
                  draftFor={rowDraft}
                  authors={authors}
                  canWrite={canWrite}
                  canWriteObservations={canWriteObservations}
                  retired={selectedRetired}
                  onAttemptChange={(pid, k, v) => setRowDraft(pid, d => { const values = [...d.values]; values[k - 1] = v; return { ...d, values }; })}
                  onAttemptCommit={(pid, k) => { const p = rowPlayer(pid); if (p) commitAttempt(p, k); }}
                  onAddAttempt={pid => setRowDraft(pid, d => ({ ...d, extra: d.extra + 1 }))}
                  onEdit={pid => { const p = rowPlayer(pid); if (p) editRow(p); }}
                  onRetry={pid => { const p = rowPlayer(pid); if (p) retryRow(p); }}
                  onMarkNotAssessed={pid => { const p = rowPlayer(pid); if (p) markNotAssessed(p, true); }}
                  onUnmarkNotAssessed={pid => { const p = rowPlayer(pid); if (p) markNotAssessed(p, false); }}
                  onRecordObservation={pid => { const p = rowPlayer(pid); if (p) openObservation(p); }}
                  onObservationEdit={pid => { const p = rowPlayer(pid); if (p) openObservation(p); }}
                />
              </div>
            )}
            {obsSheet && (
              <RecordObservationDialog
                key={`${obsSheet.player.id}:${obsSheet.skill.id}`}
                skills={[obsSheet.skill]}
                goals={goals.filter(g => g.playerId === obsSheet.player.id).map(g => ({ id: g.id, focusArea: g.focusArea }))}
                editing={obsSheet.existing}
                fixed={{
                  skill: obsSheet.skill,
                  observedOn: session.sessionDate,
                  playerName: playerName(obsSheet.player),
                  subtitle: `${title} · dated by the session`,
                  enteredBy: obsSheet.existing?.createdBy ? (authors[obsSheet.existing.createdBy] ?? 'a coach') : null,
                }}
                /* The fourth answer, and the "& next player" offer — both only a SESSION can
                   answer, which is why the dialog takes them from here rather than deciding
                   (E3). `marked` opens the dialog on the answer the row already holds, so the
                   mark has a way back now that its link has left the row's edge (E2). */
                notAssessed={(() => {
                  const m = notAssessed.find(n => n.playerId === obsSheet.player.id && n.measurableTypeId === obsSheet.skill.id) ?? null;
                  return { marked: !!m, reason: m?.reason ?? null };
                })()}
                nextLabel={obsNext ? playerName(obsNext) : null}
                busy={obsBusy}
                error={obsErr}
                onSubmit={v => void submitObservation(v)}
                onClose={() => { if (!obsBusy) setObsSheet(null); }}
              />
            )}
            {/* ── ≤640: the count and the way out DOCK above the bottom nav (stage 4 · E4, owner
                2026-09-22 — "build as drawn, knowingly a NEW idiom") ──
                The count is what a coach checks between players and it was 1,747px down the page.
                Docked, the figure that moves with every tap is under the thumb that moves it, and
                the bar earns its place the way the standing ruling asks — real content that
                changes, plus the way out — rather than being a save pill in disguise.

                ⚠ THE FIGURE IS THE CHIP'S OWN, by the same rule, so the screen cannot show two
                counts that disagree. `progress()` is what the chip dropdown already reads:
                accounted for — a result, an observation OR a mark — of those in the plan. The word
                "recorded" alone would then be claiming a MARK is a record, so a session that holds
                any mark says so in a second clause and the common case reads exactly as drawn.

                ⚠ The past-participant note is NOT on the bar. It is a footnote about the LIST, it
                never changes while a coach records, and the bar has room for the count and the way
                out and nothing else — so on a phone it stays with the list it describes. */}
            {isPhone ? (
              <>
                {pastRows > 0 && (
                  <p className={css.pastNote}>
                    {pastRows} record{pastRows === 1 ? '' : 's'} from {pastRows === 1 ? 'a player' : 'players'} no longer on the roster {pastRows === 1 ? 'is' : 'are'} listed above.
                  </p>
                )}
                <div className={`${css.foot} ${css.dock}`}>
                  <span className={css.dockCount}>
                    <b>
                      {progress(selectedType.id)} recorded
                      {counts.notAssessed > 0 && ` · ${counts.notAssessed} not assessed`}
                    </b>
                    <small>{selectedType.name}</small>
                  </span>
                  <button type="button" className={`${styles.btnPrimary} ${css.dockPill}`} onClick={() => setReviewOpen(true)}>Review session →</button>
                </div>
              </>
            ) : (
              <div className={css.foot}>
                <p className={styles.devCardNote} style={{ margin: 0 }}>
                  {scopeSentence(counts)} · {selectedType.name}{selectedType.unit ? ` (${selectedType.unit})` : ''}.
                  {pastRows > 0 && ` ${pastRows} record${pastRows === 1 ? '' : 's'} from ${pastRows === 1 ? 'a player' : 'players'} no longer on the roster ${pastRows === 1 ? 'is' : 'are'} listed above.`}
                </p>
                <button type="button" className={`${styles.btnPrimary} ${css.dockPill}`} onClick={() => setReviewOpen(true)}>Review session →</button>
              </div>
            )}
          </>
        )
      ) : (
        <p className={styles.detailPlaceholder}>
          {metricChips.length > 0
            ? 'Pick a test or skill above.'
            : canWrite ? 'Set up your first test above — then work down the roster.' : 'No tests set up yet.'}
        </p>
      )}

      {sheetOpen && (
        <SessionSheet
          mode="change"
          orgSlug={orgSlug}
          teamId={teamId}
          types={activeForSheet}
          roster={roster}
          events={events}
          initial={{
            sessionDate: session.sessionDate, eventId: session.eventId, note: session.note,
            scope: session.scopeMetricIds && session.scopePlayerIds
              ? { metricIds: session.scopeMetricIds, playerIds: session.scopePlayerIds, attempts: session.scopeAttempts }
              : null,
          }}
          defaultCounts={lastPlannedCounts([session, ...(teamSessions ?? []).filter(s => s.id !== session.id)], activeForSheet)}
          // The add field's captions (C11): the team's sessions newest-first (this one among them —
          // it counts as a run of its own plan); this session alone if the list is not here.
          lastRun={lastRunDates(teamSessions ?? [session], activeForSheet)}
          recordedCounts={recordedCounts}
          busy={sessionBusy}
          error={sheetErr}
          onSubmit={v => void saveFacts(v)}
          onClose={() => { if (!sessionBusy) setSheetOpen(false); }}
          onDelete={() => void deleteSession()}
          onTypeDefined={t => setData(d => d ? { ...d, types: [...d.types, t] } : d)}
        />
      )}
      {reviewOpen && selectedType && (
        <SessionReviewDialog
          title={title}
          plan={plan}
          rows={sessionReview({ session, types, roster, pastParticipants, entries, notAssessed, observations, name: p => playerName(p) })}
          busy={sessionBusy}
          canWrite={canWrite}
          onDrop={typeId => void dropFromPlan(typeId)}
          onClose={() => setReviewOpen(false)}
          onBack={() => router.push(skillsAndGoalsHref(base, 'sessions'))}
        />
      )}
    </div>
  );
}

/**
 * "Review session →" (C8, C9): a table to the standard — Test · Recorded · Not assessed · Not
 * recorded, figures right — then under each test the NAMES a coach acts on before leaving the
 * field: who is not assessed (with the reason — accounted for, done), who is not recorded (still
 * to do), who ran fewer than tonight's plan. A test with nothing recorded offers "Didn't run it
 * tonight — drop it from the plan ›". Stores nothing (station 4, as ruled): the counts are read
 * from what was recorded, by the ONE rule the grid's foot and the list read.
 */
function SessionReviewDialog({
  title, plan, rows, busy, canWrite, onDrop, onClose, onBack,
}: {
  title: string;
  plan: string | null;
  rows: ReviewRow<RepTeamMeasurableType>[];
  busy: boolean;
  canWrite: boolean;
  onDrop: (typeId: string) => void;
  onClose: () => void;
  onBack: () => void;
}) {
  const names = (r: ReviewRow<RepTeamMeasurableType>) => {
    const parts: React.ReactNode[] = [];
    if (r.names.notAssessed.length > 0) parts.push(<span key="na" className={css.reviewNameLine}><b>Not assessed:</b> {r.names.notAssessed.join(', ')}</span>);
    if (r.names.notRecorded.length > 0) parts.push(<span key="nr" className={css.reviewNameLine}><b>Not recorded:</b> {r.names.notRecorded.join(', ')}</span>);
    if (r.names.fewer.length > 0) parts.push(<span key="fw" className={css.reviewNameLine}><b>Fewer than planned:</b> {r.names.fewer.join(', ')}</span>);
    return parts;
  };
  return (
    <QuestionShell open onClose={onClose} ariaLabel="Review this session" title="Review this session" subtitle={plan ? `${title} · ${plan}` : title} busy={busy} scroll wide>
      <div className={`${styles.formBody} ${styles.scrollPane}`}>
        {rows.length === 0 ? (
          <p className={styles.detailPlaceholder}>Nothing recorded yet.</p>
        ) : (
          /* The portal's list recipe — the same table the Sessions list and the money tabs stand on,
             reflowed to cards @640 (`.tableAsCards`) exactly like that list; the names are the row's
             caption (`.listRowSub`), each category its own line (`.reviewNameLine`) rather than one
             run-on paragraph, so a long "not recorded" roster wraps as a clean block instead of
             stranding a lone separator at the line break. `.reviewTable` top-aligns every cell so a
             tall name list never drags the row's own numbers down to its middle — they stay beside
             the test name, where the header above them says what they mean; the header stays pinned
             while the body scrolls so that reading never breaks. */
          <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
            <table className={`${styles.table} ${css.reviewTable}`} aria-label="What was recorded, by test">
              <thead>
                <tr>
                  <th className={styles.th}>Test</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Recorded</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Not assessed</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Not recorded</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const lines = names(r);
                  return (
                    <tr key={r.type.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.cardStackCell}`}>
                        <span className={css.reviewTest}>
                          {r.type.name}
                          {r.type.kind === 'skill' && <small> · skill</small>}
                          {r.retired && <small> · retired</small>}
                          {r.outsideScope && <small> · outside the scope</small>}
                        </span>
                        {(lines.length > 0 || (canWrite && r.droppable)) && (
                          <span className={`${styles.listRowSub} ${css.reviewNames}`}>
                            {lines}
                            {canWrite && r.droppable && (
                              <button type="button" className={`${css.rowLink} ${css.reviewNameLine}`} disabled={busy} onClick={() => onDrop(r.type.id)}>Didn’t run it tonight — drop it from the plan ›</button>
                            )}
                          </span>
                        )}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Recorded">{r.counts.recorded}</td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Not assessed">{r.counts.notAssessed}</td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Not recorded">{r.counts.notRecorded}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className={css.reviewLegend}>
          <b>Not assessed</b> — you said why (absent, hurt); nothing left to do. <b>Not recorded</b> — nothing yet. Nothing is stored here; the counts are read from what you recorded.
        </p>
      </div>
      <div className={styles.modalFooter}>
        <button type="button" className={styles.btnSecondary} onClick={onBack}>Done — back to Sessions</button>
        <button type="button" className={styles.btnPrimary} onClick={onClose}>Keep recording</button>
      </div>
    </QuestionShell>
  );
}
