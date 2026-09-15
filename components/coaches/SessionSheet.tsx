'use client';
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import MetricDefinitionSheet from '@/components/coaches/MetricDefinitionSheet';
import MetricPickerCombobox from '@/components/coaches/MetricPickerCombobox';
import { aimSentence } from '@/lib/measurable-definition';
import { formatWeekdayDate, todayLocal } from '@/lib/measurable-format';
import { orderEventsByAnchor } from '@/lib/development-session-view';
import { MAX_ATTEMPTS } from '@/lib/development-input';
import { orgDayKey } from '@/lib/timezone';
import type { RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './DevelopmentSession.module.css';

export interface SessionRosterRow { id: string; playerFirstName: string; playerLastName: string | null; playerNumber: string | null }
export interface SessionEventOption { id: string; name: string; eventType: string; startsAt: string }
export interface SessionPlan { metricIds: string[]; playerIds: string[]; attempts: Record<string, number> | null }
export interface SessionFacts { sessionDate: string; eventId: string | null; note: string; scope: SessionPlan }

/**
 * ═══ THE SESSION SHEET — one sheet for a session's facts (development lifecycle re-evaluation
 * stage 2, owner rulings C1 · C4 · C9 · C10, 2026-09-15) ═══
 *
 * A session's facts open as a sheet over the screen — the dues drawer's precedent: a record over
 * its list. "+ Start session" opens it empty (`mode: 'start'`); the session page's when-line
 * *Change ›* opens it filled (`mode: 'change'`), where the footer's left also carries Delete session.
 * In a coach's words, four questions:
 *   · WHEN? — one question, not two (C10, reversing Practice Plans §10.2 ruling 1 on its reason):
 *     AT A PRACTICE (pick one — the session takes the practice's date; no date field) or ON A DATE
 *     (typed). It can no longer say "taken at Tuesday's practice, on Thursday".
 *   · NOTE.
 *   · WHAT ARE WE RUNNING? — ⚠ THE PLAN IS A LIST YOU BUILD, NOT A LIST YOU PRUNE (C11, owner ruling
 *     2026-09-15, raised on the built sheet: "in the event we have a lot of metrics… this select
 *     list could become quite large"). Only tonight's plan is listed — each test with how many
 *     attempts tonight ("× 2 attempts" — C1, the count is the session's fact, pre-filled with the
 *     last time's count by the host), each skill with "one observation", each row with a ✕ that
 *     takes it off. Nothing is ticked: being listed IS being planned. A new session opens as the
 *     team's LAST plan (the host reads it — `lastPlanIds`); a first session, with nothing to copy,
 *     opens as the whole library. The last row is the add field (`MetricPickerCombobox`): type to
 *     narrow the library, pick to add (with its last count), "+ New test…" as the list's last row
 *     opening the whole definition sheet (stage 1) stacked — a saved test joins the plan with one
 *     attempt. Everything · Nothing beside the question, as Everyone · No one sit beside the next.
 *     The default was the defect the length only showed: at twenty-four metrics "everything
 *     ticked" was a claim the coach took back twenty times, and a missed one was a test nobody
 *     ran on the record. At four metrics this is today's sheet with ✕ where the ticks were.
 *   · WHO'S HERE? — two columns on a desktop so a twelve-player roster fits without an inner
 *     scroll; one column on a phone. Everyone · No one.
 * The plan needs at least one metric and one player — the readers and the route say the same.
 *
 * ⚠ Dropping a test that already has results here asks once (C9): keep them (the default) or delete
 * them too — deleting a whole session keeps its results, and a plan change must not be more
 * destructive than that. The answer rides the submit as `dropResultsFor`.
 */
export default function SessionSheet({
  mode, orgSlug, teamId, types, roster, events, initial, defaultCounts, lastPlanIds = null, lastRun = {}, recordedCounts = {}, busy, error,
  onSubmit, onClose, onDelete, onTypeDefined,
}: {
  mode: 'start' | 'change';
  orgSlug: string;
  teamId: string;
  /** Active definitions only — a retired one cannot be in a plan. */
  types: RepTeamMeasurableType[];
  roster: SessionRosterRow[];
  /** The season's events for "At a practice" (may be empty). */
  events: SessionEventOption[];
  /** Change mode: the session as it stands. */
  initial?: { sessionDate: string; eventId: string | null; note: string | null; scope: SessionPlan | null } | null;
  /** The pre-fill per test (C1): last time's count, else the definition's, else one. */
  defaultCounts: Record<string, number>;
  /** Start mode's opening plan (C11): the team's last plan, or null — the whole library. */
  lastPlanIds?: string[] | null;
  /** The picker's caption per metric (C11): when it was last on a plan, or null — "never run". */
  lastRun?: Record<string, string | null>;
  /** Change mode: results already saved here, per metric — what a drop would touch (C9). */
  recordedCounts?: Record<string, { results: number; notAssessed: number }>;
  busy: boolean;
  error: string;
  onSubmit: (v: SessionFacts & { dropResultsFor: string[] }) => void;
  onClose: () => void;
  /** Change mode: the footer's Delete session (the host confirms and deletes). */
  onDelete?: () => void;
  /** A test defined from the sheet's "+ New test…" — the host adds it to the library it holds. */
  onTypeDefined?: (type: RepTeamMeasurableType) => void;
}) {
  const confirm = useConfirm();
  const today = todayLocal();
  const eventDay = (e: SessionEventOption) => orgDayKey(e.startsAt);

  // "When?" — at a practice (the event's day IS the date) or on a date. A new session opens on
  // today's practice when there is one (the fence is where a session starts), else on today's date.
  const initialEvent = initial?.eventId ?? (mode === 'start'
    ? (orderEventsByAnchor(events, today).find(e => eventDay(e) === today)?.id ?? null)
    : null);
  const [whenMode, setWhenMode] = useState<'practice' | 'date'>(initialEvent ? 'practice' : 'date');
  const [eventId, setEventId] = useState<string>(initialEvent ?? '');
  const [sessionDate, setSessionDate] = useState(initial?.sessionDate ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  // Tonight starts as last time (C11): the session's own plan in change mode; a new session takes the
  // team's last plan; a first session (nothing to copy) takes the whole library.
  const [metricIds, setMetricIds] = useState<Set<string>>(() => new Set(initial?.scope?.metricIds ?? lastPlanIds ?? types.map(t => t.id)));
  const [counts, setCounts] = useState<Record<string, number>>(() => ({ ...defaultCounts, ...(initial?.scope?.attempts ?? {}) }));
  const [playerIds, setPlayerIds] = useState<Set<string>>(() => new Set(initial?.scope?.playerIds ?? roster.map(p => p.id)));
  const [localErr, setLocalErr] = useState('');
  const [defineOpen, setDefineOpen] = useState(false);

  const toggle = (set: Set<string>, id: string) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; };
  const setCount = (id: string, n: number) => setCounts(c => ({ ...c, [id]: Math.min(MAX_ATTEMPTS, Math.max(1, n)) }));

  // Ordered around the chosen day (§10.2 ruling 2): practices first, then nearest.
  const anchor = whenMode === 'practice' && eventId ? (events.find(e => e.id === eventId) ? eventDay(events.find(e => e.id === eventId)!) : sessionDate) : sessionDate;
  const eventOptions = useMemo(() => orderEventsByAnchor(events, anchor), [events, anchor]);
  const chosenEvent = events.find(e => e.id === eventId) ?? null;

  function typeDefined(t: RepTeamMeasurableType) {
    setDefineOpen(false);
    onTypeDefined?.(t);
    // Joins the plan with one attempt (C3) — the "+ New test…" row's promise.
    setMetricIds(s => new Set(s).add(t.id));
    if (t.kind === 'test') setCounts(c => ({ ...c, [t.id]: 1 }));
  }

  async function submit() {
    if (metricIds.size === 0) { setLocalErr('Choose at least one test or skill to record.'); return; }
    if (playerIds.size === 0) { setLocalErr('Choose at least one player who is here.'); return; }
    if (whenMode === 'practice' && !chosenEvent) { setLocalErr('Choose the practice — or “On a date” to set one yourself.'); return; }
    if (whenMode === 'date' && !sessionDate) { setLocalErr('Pick the session’s date.'); return; }
    setLocalErr('');
    const chosen = types.filter(t => metricIds.has(t.id));
    // C9 — a test with results here, dropped from the plan: keep (default) or delete them too.
    const dropResultsFor: string[] = [];
    for (const t of types) {
      if (metricIds.has(t.id) || !(initial?.scope?.metricIds ?? []).includes(t.id)) continue;
      const { results: n, notAssessed: m } = recordedCounts[t.id] ?? { results: 0, notAssessed: 0 };
      if (n === 0 && m === 0) continue;
      const has = [
        n > 0 ? `${n} result${n === 1 ? '' : 's'}` : '',
        m > 0 ? `${m} not-assessed mark${m === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join(' and ');
      const del = await confirm({
        title: `Drop ${t.name} from the plan?`,
        message: `${t.name} has ${has} recorded in this session. Drop it from the plan and keep them, or delete them too?`,
        confirmText: 'Delete them too',
        cancelText: 'Keep them',
        tone: 'danger',
      });
      if (del) dropResultsFor.push(t.id);
    }
    const attempts: Record<string, number> = {};
    for (const t of chosen) if (t.kind === 'test') attempts[t.id] = Math.min(MAX_ATTEMPTS, Math.max(1, counts[t.id] ?? 1));
    onSubmit({
      // At a practice the date is the practice's day (the route derives it too); on a date, the typed one.
      sessionDate: whenMode === 'practice' && chosenEvent ? eventDay(chosenEvent) : sessionDate,
      eventId: whenMode === 'practice' && chosenEvent ? chosenEvent.id : null,
      note: note.trim(),
      // In the order they are listed — roster order for players, library order for metrics.
      scope: { metricIds: chosen.map(t => t.id), playerIds: roster.filter(p => playerIds.has(p.id)).map(p => p.id), attempts },
      dropResultsFor,
    });
  }

  const title = mode === 'start' ? 'New session' : 'This session';
  const count = (t: RepTeamMeasurableType) => counts[t.id] ?? 1;

  return (
    <>
      <QuestionShell open onClose={onClose} ariaLabel={title} title={title} busy={busy} scroll wide>
        {/* Four plain labelled groups on the sheet's white — the definition sheet's shape, and the
            frame's. (The first build boxed each question in a tinted `.formSection`; the frame draws
            no boxes — owner, 2026-09-15.) */}
        <div className={`${styles.formBody} ${styles.scrollPane}`}>
          {/* ── When? ── */}
          <div className={`${styles.field} ${css.group}`} role="group" aria-labelledby="session-when">
            <span id="session-when" className={styles.label}>When?</span>
            <div className={css.when} role="group" aria-label="At a practice or on a date">
              <button type="button" className={`${css.whenChoice} ${whenMode === 'practice' ? css.whenChoiceOn : ''}`} aria-pressed={whenMode === 'practice'}
                onClick={() => setWhenMode('practice')}>At a practice</button>
              <button type="button" className={`${css.whenChoice} ${whenMode === 'date' ? css.whenChoiceOn : ''}`} aria-pressed={whenMode === 'date'}
                onClick={() => setWhenMode('date')}>On a date</button>
            </div>
            {whenMode === 'practice' ? (
              <>
                <label className={styles.field}>
                  <span className={styles.srOnly}>Which practice</span>
                  <select className={styles.select} value={eventId} onChange={e => setEventId(e.target.value)} disabled={events.length === 0}>
                    <option value="">{events.length === 0 ? 'Nothing on the schedule yet' : 'Choose a practice…'}</option>
                    {eventOptions.map(ev => (
                      <option key={ev.id} value={ev.id}>{formatWeekdayDate(eventDay(ev), 'short')} — {ev.name}</option>
                    ))}
                  </select>
                </label>
                <p className={styles.formHint}>The session takes the practice’s date. Choose “On a date” for a testing day with no practice on the calendar.</p>
              </>
            ) : (
              <label className={styles.field}>
                <span className={styles.srOnly}>Date</span>
                <input className={styles.input} type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
              </label>
            )}
          </div>

          {/* ── Note ── */}
          <label className={styles.field}>
            <span className={styles.label}>Note</span>
            <input className={styles.input} type="text" maxLength={200} value={note} placeholder='e.g. "post-break testing"'
              onChange={e => setNote(e.target.value)} />
          </label>

          {/* ── What are we running? — tonight's plan as a list you build (C11), the count per test (C1) ── */}
          <div className={`${styles.field} ${css.group}`} role="group" aria-labelledby="session-running">
            <span className={css.whoHead}>
              <span id="session-running" className={styles.label}>What are we running?</span>
              <span className={css.pickAll}>
                <button type="button" className={css.pickLink} onClick={() => setMetricIds(new Set(types.map(t => t.id)))}>Everything</button>
                <span aria-hidden>·</span>
                <button type="button" className={css.pickLink} onClick={() => setMetricIds(new Set())}>Nothing</button>
              </span>
            </span>
            <ul className={css.pickList} aria-label="Tonight’s plan">
              {/* Library order among the chosen — the order the grid's chips will take. */}
              {types.filter(t => metricIds.has(t.id)).map(t => (
                <li key={t.id} className={css.pickRow}>
                  <span className={css.pickName}>
                    <span>{t.name} {t.kind === 'skill' ? <small>· skill</small> : <small className={css.pickDetail}>· {t.unit} · {aimSentence(t)}</small>}</span>
                  </span>
                  {t.kind === 'skill' ? (
                    <small className={css.pickAside}>one observation</small>
                  ) : (
                    <span className={css.stepper} role="group" aria-label={`${t.name} — attempts tonight`}>
                      <button type="button" className={css.stepBtn} aria-label={`One fewer attempt of ${t.name}`} disabled={count(t) <= 1}
                        onClick={() => setCount(t.id, count(t) - 1)}>−</button>
                      <span className={css.stepValue} aria-live="polite">× {count(t)}<span className={css.stepWord}>&nbsp;attempt{count(t) === 1 ? '' : 's'}</span></span>
                      <button type="button" className={css.stepBtn} aria-label={`One more attempt of ${t.name}`} disabled={count(t) >= MAX_ATTEMPTS}
                        onClick={() => setCount(t.id, count(t) + 1)}>+</button>
                    </span>
                  )}
                  <button type="button" className={css.pickRemove} aria-label={`Take ${t.name} off tonight’s plan`} onClick={() => setMetricIds(s => toggle(s, t.id))}>
                    <X size={15} aria-hidden />
                  </button>
                </li>
              ))}
              <li className={css.addRow}>
                <MetricPickerCombobox types={types} chosenIds={metricIds} lastRun={lastRun} onPick={id => setMetricIds(s => new Set(s).add(id))} onDefineNew={() => setDefineOpen(true)} disabled={busy} />
              </li>
            </ul>
          </div>

          {/* ── Who's here? — two columns on a desktop (C4); Everyone · No one beside the label ── */}
          <div className={`${styles.field} ${css.group}`} role="group" aria-labelledby="session-who">
            <span className={css.whoHead}>
              <span id="session-who" className={styles.label}>Who’s here?</span>
              <span className={css.pickAll}>
                <button type="button" className={css.pickLink} onClick={() => setPlayerIds(new Set(roster.map(p => p.id)))}>Everyone</button>
                <span aria-hidden>·</span>
                <button type="button" className={css.pickLink} onClick={() => setPlayerIds(new Set())}>No one</button>
              </span>
            </span>
            {/* Roster order runs DOWN the left column, then the right (#1–#6 · #7–#12), as drawn —
                two lists side by side, so each column's first row is a real first child; a phone
                stacks the two. */}
            <div className={css.pickColumns}>
              {[roster.slice(0, Math.ceil(roster.length / 2)), roster.slice(Math.ceil(roster.length / 2))].map((half, i) => (
                <ul key={i} className={css.pickList}>
                  {half.map(p => (
                    <li key={p.id} className={css.pickRow}>
                      <label className={css.pickMain}>
                        <input type="checkbox" checked={playerIds.has(p.id)} onChange={() => setPlayerIds(s => toggle(s, p.id))} />
                        <span>{p.playerNumber && <small>#{p.playerNumber} </small>}{[p.playerFirstName, p.playerLastName].filter(Boolean).join(' ')}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
          {(localErr || error) && <p className={styles.errorText} role="alert">{localErr || error}</p>}
        </div>
        <div className={`${styles.modalFooter} ${css.sheetFoot}`}>
          {mode === 'change' && onDelete && (
            <button type="button" className={styles.btnGhost} disabled={busy} onClick={onDelete}>Delete session</button>
          )}
          <span className={css.footSpacer} />
          <button type="button" className={styles.btnSecondary} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.btnPrimary} disabled={busy} onClick={() => void submit()}>
            {busy ? 'Saving…' : mode === 'start' ? 'Start recording' : 'Save changes'}
          </button>
        </div>
      </QuestionShell>
      {/* "+ New test…" — the whole definition, stacked over the sheet (stage 1's precedent). */}
      {defineOpen && (
        <MetricDefinitionSheet orgSlug={orgSlug} teamId={teamId} typeId={null} onClose={() => setDefineOpen(false)} onSaved={typeDefined} />
      )}
    </>
  );
}
