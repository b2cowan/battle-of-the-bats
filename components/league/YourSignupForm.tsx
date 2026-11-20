'use client';

import { useEffect, useRef, useState } from 'react';
import kit from '@/components/public/ClubKit.module.css';
import formKit from '@/components/public/ClubForm.module.css';
import styles from './register.module.css';
import { clubDay } from '@/lib/league-registration-state';
import { answeredCount, answerError, answerName, onceQuestions, perChildQuestions, type AnswerIn, type SignupQuestion } from '@/lib/club-form-signup';
import { YOUR_SIGNUP_FORM_WORDS as Y } from '@/lib/club-form-family-words';
import type { FamilyAnswer, FamilyDocumentAsk, FamilyFormState } from '@/lib/club-form-family';
import { DocumentBlock, QuestionField, anyUploading, toAnswerIn, type AnswerDraft } from './SignupFormFields';

/**
 * YOUR SIGN-UP: THE CLUB'S DOCUMENTS AND QUESTIONS (Board Ready Stage 4 Part 2; rulings 8, 20; drawing tab 7).
 *
 *   SignupRetick    first on the page, only while a document needs a tick: the reason the club gave, Open, the tick.
 *                   Saved at once; "Ticked version N on {day} · Undo" for a few seconds, then a quiet line. A failed save
 *                   leaves the box unticked with "It didn't save. Try again." The children's places aren't affected.
 *   SignupAnswers   each child's answers and the sign-up's own in folded rows with Change, until the child's teams are
 *                   made; then the club's contact. A question added since shows as "Not answered yet". A health answer's
 *                   words are never shown here (the page opens from an emailed link): it reads "Answered", and Change can
 *                   replace or clear it.
 */

type Shared = { orgSlug: string; seasonSlug: string; token: string; club: string; contact: string | null };

export function SignupRetick({ asks, orgSlug, seasonSlug, token, club, contact, childCount }: Shared & { asks: FamilyDocumentAsk[]; childCount: number }) {
  return asks.map(a => <RetickOne key={a.document.id} ask={a} {...{ orgSlug, seasonSlug, token, club, contact, childCount }} />);
}

/** A re-tick's moments: before, saving, a failed save, ticked (Undo offered for a few seconds), then a quiet line. */
type Ticked = { kind: 'ticked' | 'quiet'; tickIds: string[]; at: string; note?: string };
type RetickState = { kind: 'idle' | 'saving' } | { kind: 'failed'; note?: string } | Ticked;

function RetickOne({ ask, orgSlug, seasonSlug, token, club, contact, childCount }: Shared & { ask: FamilyDocumentAsk; childCount: number }) {
  const d = ask.document;
  const [opened, setOpened] = useState(false);
  const [state, setState] = useState<RetickState>({ kind: 'idle' });
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const base = `/api/league/${orgSlug}/${seasonSlug}/form/tick`;

  const tick = async () => {
    setState({ kind: 'saving' });
    try {
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, documentId: d.id, versionId: d.versionId }) });
      const data = await res.json().catch(() => ({}));
      // The route's own sentence when it has one ("Open X and tick it", "reload the page"), else the plain failure.
      if (!res.ok) { setState({ kind: 'failed', note: typeof data.error === 'string' ? data.error : undefined }); return; }
      setState({ kind: 'ticked', tickIds: data.tickIds ?? [], at: data.at ?? new Date().toISOString() });
      timer.current = window.setTimeout(() => setState(s => (s.kind === 'ticked' ? { ...s, kind: 'quiet' } : s)), 8000);
    } catch { setState({ kind: 'failed' }); }
  };
  const undo = async (s: Ticked) => {
    if (timer.current) window.clearTimeout(timer.current);
    try {
      const res = await fetch(base, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, tickIds: s.tickIds }) });
      // An undo that didn't land leaves the tick standing, and says so.
      setState(res.ok ? { kind: 'idle' } : { ...s, kind: 'quiet', note: Y.undoFailed });
    } catch { setState({ ...s, kind: 'quiet', note: Y.undoFailed }); }
  };

  if (state.kind === 'quiet') {
    return <p className={styles.fitDim}>{[state.note, Y.tickedQuiet(d.name, d.versionNo, clubDay(state.at))].filter(Boolean).join(' ')}</p>;
  }
  return (
    <div className={`${kit.card} ${styles.retick}`}>
      <p className={styles.docName}><span className={styles.fileTag}>{d.source === 'pdf' ? 'PDF' : 'TEXT'}</span> {Y.retickTitle(d.name, d.versionNo)}</p>
      <p className={styles.fitDim} style={{ marginTop: 0 }}>
        {ask.state === 'again' ? Y.retickWhy(club, clubDay(ask.since), ask.reason, childCount) : Y.retickNew(club, clubDay(ask.since), childCount)}
      </p>
      {state.kind === 'ticked' ? (
        <p className={styles.removeAsk} role="status">
          <span>{Y.ticked(d.versionNo, clubDay(state.at))}</span>
          <button type="button" className={styles.linkButton} onClick={() => undo(state)}>{Y.undo}</button>
        </p>
      ) : (
        <DocumentBlock d={d} idBase="ys" ticked={state.kind === 'saving'} opened={opened} onOpened={() => setOpened(true)} busy={state.kind === 'saving'}
          onTick={on => { if (on) void tick(); }} orgSlug={orgSlug} seasonSlug={seasonSlug} club={club} contact={contact}
          forLine={Y.retickFor(ask.children.map(c => c.firstName))}
          error={state.kind === 'failed' ? state.note ?? Y.saveFailed : undefined} />
      )}
      {state.kind === 'saving' && <p className={styles.fitDim} role="status">{Y.saving}</p>}
    </div>
  );
}

/** A saved answer as the editor's starting draft (a hidden health answer starts blank: it is kept unless replaced). */
function draftOf(a: FamilyAnswer | undefined): AnswerDraft | undefined {
  if (!a || a.hidden || a.file) return undefined;
  if (a.text !== undefined) return { text: a.text };
  if (a.choiceIds) return { choiceIds: a.choiceIds };
  if (a.bool !== undefined) return { bool: a.bool };
  if (a.date) return { date: a.date };
  return undefined;
}

/** The folded row's line: "3 answered · T-shirt size YM", "2 answered · 1 not answered yet". Never a health answer. */
function rowLine(questions: SignupQuestion[], answers: FamilyAnswer[]): string {
  const got = new Set(answers.map(a => a.questionId));
  const { answered, notYet } = answeredCount(questions, got);
  const sample = questions.flatMap(q => {
    const a = answers.find(x => x.questionId === q.id);
    if (!a || a.hidden || q.health || !a.choiceIds?.length || q.type !== 'one_choice') return [];
    const c = q.choices.find(x => x.id === a.choiceIds![0]);
    return c ? [`${q.label} ${c.label}`] : [];
  })[0] ?? null;
  return Y.answeredLine(answered, notYet, sample);
}

export function SignupAnswers({ state: first, orgSlug, seasonSlug, token, club, contact }: Shared & { state: FamilyFormState }) {
  const [state, setState] = useState(first);
  const per = perChildQuestions(state.form);
  const once = onceQuestions(state.form);
  const rows = [
    ...(per.length ? state.children.map(c => ({ key: c.child, child: c.child as string | null, title: Y.childAnswers(c.firstName), who: c.firstName, open: c.open, questions: per, answers: c.answers })) : []),
    ...(once.length ? [{ key: 'once', child: null as string | null, title: Y.onceAnswers, who: state.children.length === 1 ? state.children[0].firstName : 'your children', open: state.once.open, questions: once, answers: state.once.answers }] : []),
  ];
  if (rows.length === 0) return null;
  const anyOpen = rows.some(r => r.open);
  return (
    <div>
      <ul className={kit.list} style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Your answers">
        {rows.map(({ key, ...r }, i) => (
          <AnswerRow key={key} first={i === 0} {...r} orgSlug={orgSlug} seasonSlug={seasonSlug} token={token} club={club} onSaved={setState} />
        ))}
      </ul>
      <p className={styles.fitDim}>{anyOpen ? Y.untilTeams(club, contact) : Y.afterTeams(club, contact)}</p>
    </div>
  );
}

function AnswerRow({ first, child, title, who, open, questions, answers, orgSlug, seasonSlug, token, club, onSaved }: {
  first: boolean; child: string | null; title: string; who: string; open: boolean; questions: SignupQuestion[]; answers: FamilyAnswer[];
  orgSlug: string; seasonSlug: string; token: string; club: string; onSaved: (s: FamilyFormState) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const saved0 = new Map(answers.map(a => [a.questionId, a]));

  const start = () => {
    setDrafts(Object.fromEntries(questions.flatMap(q => { const d = draftOf(saved0.get(q.id)); return d ? [[q.id, d]] : []; })));
    setCleared(new Set());
    setErrors({});
    setFailed(null);
    setSaved(false);
    setEditing(true);
  };
  const save = async () => {
    const send: AnswerIn[] = [];
    const clear: string[] = [];
    // A file that failed or was refused is named, never quietly left out of what is saved.
    const unsent: Record<string, string> = {};
    for (const q of questions) {
      const f = drafts[q.id]?.file;
      if (f && (f.state === 'failed' || f.state === 'refused')) unsent[q.id] = answerError(q, child ? who : null, 'invalid');
    }
    if (Object.keys(unsent).length) { setErrors(unsent); return; }
    for (const q of questions) {
      const out = toAnswerIn(q.id, drafts[q.id]);
      const had = saved0.get(q.id);
      if (out) send.push(out);
      else if (cleared.has(q.id) || (had && !had.hidden && !had.file && drafts[q.id] !== undefined)) clear.push(q.id);
    }
    setSaving(true);
    setFailed(null);
    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/form/answers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, child, answers: send, clear }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data.errors) {
        setErrors(Object.fromEntries(Object.entries(data.errors as Record<string, string>).map(([k, v]) => [k.replace(/^q\./, ''), v])));
        return;
      }
      if (!res.ok) { setFailed(data.error ?? Y.saveFailed); return; }
      onSaved(data.state as FamilyFormState);
      setEditing(false);
      setSaved(true);
    } catch { setFailed(Y.saveFailed); } finally { setSaving(false); }
  };

  return (
    <li style={{ padding: '12px 16px', borderTop: first ? 0 : '1px solid var(--club-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', minHeight: '32px' }}>
        <div>
          <strong style={{ color: 'var(--club-text)' }}>{title}</strong>
          <p className={styles.fitDim} style={{ marginTop: 0 }}>{rowLine(questions, answers)}</p>
        </div>
        {open && !editing && <button type="button" className={styles.linkButton} onClick={start}>{Y.change}</button>}
      </div>
      {saved && !editing && <p className={styles.fitDim} role="status">{Y.saved}</p>}
      {editing && (
        <div className={styles.clubBlock}>
          {questions.map(q => {
            const had = saved0.get(q.id);
            const isCleared = cleared.has(q.id);
            const keptLine = had && !isCleared && (had.hidden || had.file) && !toAnswerIn(q.id, drafts[q.id])
              ? (had.file ? Y.fileKept(had.file.name) : Y.healthKept) : null;
            return (
              <div key={q.id}>
                <QuestionField q={q} idBase={`ys-${child ?? 'once'}`} value={drafts[q.id]} onChange={next => { setDrafts(d => ({ ...d, [q.id]: next })); setErrors(e => { const c = { ...e }; delete c[q.id]; return c; }); }}
                  error={errors[q.id]} club={club} who={who} errorName={answerName(q, child ? who : null)} orgSlug={orgSlug} seasonSlug={seasonSlug} />
                {!had && <p className={styles.fitDim} style={{ marginTop: '-0.5rem' }}>{Y.notAnsweredYet}</p>}
                {keptLine && (
                  <p className={styles.removeAsk} style={{ marginTop: '-0.5rem' }}>
                    <span className={styles.fitDim} style={{ margin: 0 }}>{keptLine}</span>
                    {!q.required && <button type="button" className={styles.linkButton} onClick={() => setCleared(s => new Set(s).add(q.id))}>{had?.file ? Y.fileClear : Y.healthClear}</button>}
                  </p>
                )}
              </div>
            );
          })}
          {errors.files && <p className={formKit.errorMsg}>{errors.files}</p>}
          {failed && <div className={formKit.globalError} role="alert">{failed}</div>}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button type="button" className={`${kit.btn} ${kit.btnPrimary}`} disabled={saving || anyUploading(drafts)} onClick={save}>{saving ? Y.saving : Y.save}</button>
            <button type="button" className={styles.linkButton} onClick={() => setEditing(false)}>{Y.cancel}</button>
          </div>
        </div>
      )}
    </li>
  );
}
