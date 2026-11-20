'use client';
/**
 * A CLUB QUESTION, AS A RECORD — and "Add a question" (Board Ready Stage 4 Part 1; drawing tabs 2 and 7; rulings 1, 5, 7,
 * 9, 12). The tournament question window's shape (QuestionRecord): it reads first, the pencil turns the whole record into
 * its form and back, edits save as you go (the pill in the head), Previous / Next step through the list. Archive ends the
 * body (answers kept under "No longer asked"); Delete shows only while nobody has answered.
 *
 * Seven types; Help text; "Asked" (each child / once per sign-up); Required (never for a file); Health or medical (its
 * answers stay out of lists, the board, emails and the plain exports — a suggestion when the words look medical, never a
 * block); Show on the draft board (never for health). Once anyone has answered, Type and Asked are locked and say why.
 */
import { useCallback, useRef, useState } from 'react';
import { Archive } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { RecordAction, RecordDelete, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { jsonInit } from '@/lib/money-fetch';
import { readRefusal } from '@/lib/schedule-words';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useRecordWindow } from '@/components/admin/tournament/useRecordWindow';
import {
  FORM_LIMITS, asksForTyping, canBeRequired, canDeleteQuestion, hasChoices, isAnswered, linesToChoices, looksLikeHealth, offeredChoices,
  type FormQuestion, type QuestionAsked, type QuestionType,
} from '@/lib/club-form';
import { ASKED_WORDS, FORM_WORDS as W, QUESTION_TYPE_WORDS, askedLabel, typeLabel } from '@/lib/club-form-words';
import f from './SignupForm.module.css';

type Draft = {
  label: string; helpText: string; type: QuestionType; asked: QuestionAsked; choicesText: string;
  required: boolean; health: boolean; onBoard: boolean;
};

const draftOf = (q: FormQuestion | null): Draft => ({
  label: q?.label ?? '',
  helpText: q?.helpText ?? '',
  type: q?.type ?? 'short_answer',
  asked: q?.asked ?? 'per_subject',
  choicesText: q ? offeredChoices(q).map(c => c.label).join('\n') : '',
  required: q?.required ?? false,
  health: q?.health ?? false,
  onBoard: q?.onBoard ?? false,
});

const bodyOf = (d: Draft, q: FormQuestion | null) => ({
  label: d.label.trim(),
  helpText: d.helpText.trim(),
  type: d.type,
  asked: d.asked,
  // Each line keeps its choice's id where it can, so a renamed choice renames its answers (lib/club-form.ts).
  choices: hasChoices(d.type) ? linesToChoices(d.choicesText, q ? offeredChoices(q) : []) : [],
  required: canBeRequired(d.type) && d.required,
  health: d.health,
  onBoard: !d.health && d.onBoard,
});

function Switch({ id, name, hint, on, disabled = false, onChange }: {
  id: string; name: string; hint: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={`${ck.switchRow}${on ? '' : ` ${ck.switchRowOff}`}`}>
      <div className={ck.switchText}>
        <span className={ck.switchName} id={id}>{name}</span>
        <p className={ck.hint} id={`${id}-hint`}>{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} aria-describedby={`${id}-hint`}
        className={ck.switch} disabled={disabled} onClick={() => onChange(!on)} />
    </div>
  );
}

export default function QuestionWindow({
  question, apiBase, orgQuery, canEdit, counts, prev, next, position, onStep, onClose, onChanged,
}: {
  /** null = Add a question (the same window, asking). */
  question: FormQuestion | null;
  /** `/api/admin/house-league/seasons/{id}/form/questions` */
  apiBase: string;
  orgQuery: string;
  canEdit: boolean;
  /** Sign-ups so far: the Add window's foot names who will read "Not asked". */
  counts: { children: number; signups: number };
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  position: string;
  onStep: (id: string) => void;
  onClose: () => void;
  onChanged: () => Promise<boolean>;
}) {
  const creating = question === null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(question));
  const [seededFor, setSeededFor] = useState(question?.id ?? 'new');
  const changed = useRef(false);
  const answered = !!question && isAnswered(question);

  const held = !draft.label.trim() ? W.questionHeld
    : hasChoices(draft.type) && linesToChoices(draft.choicesText, []).length === 0 ? W.choicesHeld
      : null;

  const write = useCallback(async (signal: AbortSignal) => {
    if (!question) return;
    const res = await fetch(`${apiBase}/${encodeURIComponent(question.id)}${orgQuery}`, { ...jsonInit('PATCH', bodyOf(draft, question)), signal });
    if (!res.ok) throw new Error(await readRefusal(res, W.saveFailed));
    changed.current = true;
    // A choice saved now gets its id on the server: re-read so the next save names it (the draft's text is kept).
    if (hasChoices(draft.type)) await onChanged();
  }, [question, apiBase, orgQuery, draft, onChanged]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canEdit && editing && !creating, loading: false, sig: JSON.stringify(draft), blocked: editing ? held : null, write, failText: W.saveFailed,
  });
  const { resetRefused, leave, toggleEdit } = useRecordWindow({
    editing, setEditing, dirty, held, handleSave, settle, onChanged,
    consumeChanged: () => { const was = changed.current; changed.current = false; return was; },
    onAfterSave: reread => { if (reread) setSeededFor(''); },
  });
  if (seededFor !== (question?.id ?? 'new')) {
    setSeededFor(question?.id ?? 'new');
    setEditing(false);
    setDraft(draftOf(question));
    resetRefused();
  }
  const change = (patch: Partial<Draft>) => { setDraft(d => ({ ...d, ...patch })); if (!creating) touch(); resetRefused(); };

  // ── Add a question ──
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  async function create() {
    if (busy) return;
    if (held) { setCreateError(held); return; }
    setBusy(true);
    setCreateError('');
    try {
      const res = await fetch(`${apiBase}${orgQuery}`, jsonInit('POST', bodyOf(draft, null)));
      if (!res.ok) { setCreateError(await readRefusal(res, W.addFailed)); return; }
      await onChanged();
      onClose();
    } catch {
      setCreateError(W.addFailed);
    } finally {
      setBusy(false);
    }
  }

  // ── Archive / Delete: each asks first ──
  const [asking, setAsking] = useState<'archive' | 'delete' | null>(null);
  const [askError, setAskError] = useState('');
  async function doEnd() {
    if (!question || !asking) return;
    setBusy(true);
    setAskError('');
    try {
      const url = `${apiBase}/${encodeURIComponent(question.id)}${orgQuery}`;
      const res = asking === 'delete'
        ? await fetch(url, { method: 'DELETE' })
        : await fetch(url, jsonInit('PATCH', { archived: true }));
      if (!res.ok) { setAskError(await readRefusal(res, asking === 'delete' ? W.deleteFailed : W.archiveFailed)); return; }
      setAsking(null);
      await onChanged();
      onClose();
    } catch {
      setAskError(asking === 'delete' ? W.deleteFailed : W.archiveFailed);
    } finally {
      setBusy(false);
    }
  }

  const missed = draft.asked === 'once' ? counts.signups : counts.children;
  const suggestHealth = !draft.health && looksLikeHealth(draft.label, draft.helpText);

  const fields = (
    <>
      <TextField id="cq-label" label={W.question} required value={draft.label} maxLength={FORM_LIMITS.label} onChange={v => change({ label: v })} />
      <TextField id="cq-help" label={W.helpText} value={draft.helpText} maxLength={FORM_LIMITS.help} hint={W.helpHint} onChange={v => change({ helpText: v })} />
      <div className={f.two}>
        {answered ? (
          <>
            <div className={ck.field}><span className={ck.label}>{W.type}</span><span className={repKit.readonlyValue}>{typeLabel(question!.type)}</span></div>
            <div className={ck.field}><span className={ck.label}>{W.asked}</span><span className={repKit.readonlyValue}>{askedLabel(question!.asked)}</span></div>
          </>
        ) : (
          <>
            <label className={ck.field} htmlFor="cq-type">
              <span className={ck.label}>{W.type}</span>
              <select id="cq-type" className={ck.select} value={draft.type}
                onChange={e => { const type = e.target.value as QuestionType; change({ type, required: canBeRequired(type) && draft.required }); }}>
                {QUESTION_TYPE_WORDS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className={ck.field} htmlFor="cq-asked">
              <span className={ck.label}>{W.asked}</span>
              <select id="cq-asked" className={ck.select} value={draft.asked} onChange={e => change({ asked: e.target.value as QuestionAsked })}>
                {ASKED_WORDS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
          </>
        )}
      </div>
      {answered && <p className={ck.hint}>{W.lockedWhy(question!.answers, question!.asked)}</p>}
      {asksForTyping(draft.type) && <p className={ck.hint}>{W.healthCard}</p>}
      {hasChoices(draft.type) && (
        <label className={ck.field} htmlFor="cq-choices">
          <span className={ck.label}>{W.choices}<span className={ck.required} aria-hidden>*</span></span>
          <textarea id="cq-choices" className={ck.textarea} rows={5} value={draft.choicesText} onChange={e => change({ choicesText: e.target.value })} />
          <p className={ck.hint}>{W.choicesHint}</p>
        </label>
      )}
      <div>
        <Switch id="cq-required" name={W.required} hint={canBeRequired(draft.type) ? W.requiredHint : W.requiredFile}
          on={canBeRequired(draft.type) && draft.required} disabled={!canBeRequired(draft.type)} onChange={v => change({ required: v })} />
        <Switch id="cq-health" name={W.health} hint={W.healthHint} on={draft.health}
          onChange={v => change({ health: v, onBoard: v ? false : draft.onBoard })} />
        <Switch id="cq-board" name={W.board} hint={W.boardHint} on={!draft.health && draft.onBoard} disabled={draft.health}
          onChange={v => change({ onBoard: v })} />
      </div>
      {draft.health ? (
        <p className={f.nudge}>{W.healthOn}</p>
      ) : suggestHealth ? (
        <div className={`${f.nudge} ${f.nudgeRow}`}>
          <span>{W.healthAsk}</span>
          <button type="button" className="btn btn-outline" onClick={() => change({ health: true, onBoard: false })}>{W.healthTurnOn}</button>
        </div>
      ) : null}
    </>
  );

  if (creating) {
    return (
      <KitDialog
        kind="form"
        title={W.addQuestion}
        onClose={() => { if (!busy) onClose(); }}
        busy={busy}
        footerStart={missed > 0 ? <span className={repKit.footNote}>{W.notAskedFoot(missed)}</span> : undefined}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy}>{busy ? W.adding : W.addQuestionAction}</button>
          </>
        )}
      >
        <FormError>{createError}</FormError>
        {fields}
      </KitDialog>
    );
  }

  const q = question!;
  const offered = offeredChoices(q);
  const retired = q.choices.filter(c => !c.offered);
  const ask = asking === 'delete' ? W.deleteAsk(q.label) : W.archiveAsk(q.label);
  return (
    <>
      <KitDialog
        kind="form"
        size="medium"
        title={editing ? (draft.label.trim() || q.label) : q.label}
        ariaLabel={q.label}
        identity={`${typeLabel(q.type)} · ${askedLabel(q.asked).toLowerCase()}`}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={held} onRetry={() => void handleSave()} /> : undefined}
        edit={canEdit && !q.archivedAt ? { editing, onToggle: () => void toggleEdit(), label: W.edit(q.label) } : undefined}
        onClose={() => void leave(onClose)}
        busy={busy}
        steps={position ? {
          prev: prev ? { name: prev.name, onStep: () => void leave(() => onStep(prev.id)) } : null,
          next: next ? { name: next.name, onStep: () => void leave(() => onStep(next.id)) } : null,
          position,
          positionWide: position,
          noun: W.noun,
        } : undefined}
        levelKey={q.id}
      >
        {editing ? fields : (
          <dl className={screenParts.recordFacts}>
            <div><dt>{W.type}</dt><dd>{typeLabel(q.type)}</dd></div>
            {hasChoices(q.type) && (
              <div><dt>{W.choices}</dt><dd>{offered.map(c => c.label).join(' · ')}
                {retired.length > 0 && <span className={ck.hint} style={{ display: 'block' }}>{W.retiredChoices(retired.map(c => c.label))}</span>}
              </dd></div>
            )}
            {q.helpText && <div><dt>{W.helpText}</dt><dd>{q.helpText}</dd></div>}
            <div><dt>{W.asked}</dt><dd>{askedLabel(q.asked)}</dd></div>
            <div><dt>{W.required}</dt><dd>{q.required ? W.yes : W.no}</dd></div>
            {q.health && <div><dt>{W.health}</dt><dd>{W.yes}</dd></div>}
            <div><dt>{W.boardFact}</dt><dd>{q.onBoard ? W.shown : W.notShown}</dd></div>
            <div><dt>{W.answers}</dt><dd>{q.answers > 0 ? W.answersCount(q.answers, q.asked) : W.answersNone}</dd></div>
          </dl>
        )}
        {canEdit && !q.archivedAt && (
          <RecordSection>
            <div className={f.doors}>
              <RecordAction icon={<Archive size={13} aria-hidden />} onClick={() => void leave(() => { setAskError(''); setAsking('archive'); })} disabled={busy}>
                {W.archive}
              </RecordAction>
              {canDeleteQuestion(q) && (
                <RecordDelete onClick={() => void leave(() => { setAskError(''); setAsking('delete'); })} disabled={busy}>
                  {W.delete}
                </RecordDelete>
              )}
            </div>
            <p className={ck.hint}>{canDeleteQuestion(q) ? W.deleteNote : W.archiveNote}</p>
          </RecordSection>
        )}
      </KitDialog>

      {asking && (
        <KitDialog
          kind="question"
          title={ask.title}
          onClose={() => { if (!busy) setAsking(null); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(null)} disabled={busy}>{W.keep}</button>
              <button type="button" className="btn btn-danger" onClick={() => void doEnd()} disabled={busy}>{ask.action}</button>
            </>
          )}
        >
          <p>{ask.body}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}
    </>
  );
}
