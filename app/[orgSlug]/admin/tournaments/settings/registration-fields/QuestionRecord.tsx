'use client';
/**
 * A REGISTRATION QUESTION, AS A RECORD — Tournament admin redesign Stage 5 (E6, A50; hub v45, ruled as drawn
 * 2026-10-10), the same shape as a division's. It reads first (its type, its choices, required or not); the pencil
 * edits it, saving as you go with the floating pill; Archive ends the body and asks in the product's window — today's
 * sentence, kept: questions are archived, not deleted, because answers already given stay with each registration. The
 * browser's confirm box went. The same window, asking, adds a question.
 */
import { useCallback, useRef, useState } from 'react';
import { Archive } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { RecordAction, SavePill } from '@/components/admin/kit/club/RepKit';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { useRecordWindow } from '@/components/admin/tournament/useRecordWindow';
import {
  QUESTION_TYPES, QUESTION_WORDS as W, archiveQuestion, questionCaption,
} from '@/lib/tournament-settings-words';
import type { TournamentRegistrationField, TournamentRegistrationFieldType } from '@/lib/types';
import styles from './questions.module.css';

type Draft = { label: string; fieldType: TournamentRegistrationFieldType; optionsText: string; required: boolean };

const draftOf = (f: TournamentRegistrationField | null): Draft => ({
  label: f?.label ?? '',
  fieldType: f?.fieldType ?? 'short_text',
  optionsText: (f?.options ?? []).join('\n'),
  required: f?.required ?? false,
});
export const choicesOf = (text: string) => text.split(/\r?\n|,/).map(o => o.trim()).filter(Boolean);
const bodyOf = (d: Draft) => ({
  label: d.label.trim(),
  fieldType: d.fieldType,
  options: d.fieldType === 'dropdown' ? choicesOf(d.optionsText) : [],
  required: d.required,
});

/** A 4xx's own sentence (the route's mistakes and the plan's words); anything else, ours. */
async function failureOf(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null) as { error?: string } | null;
  return res.status >= 400 && res.status < 500 && data?.error ? data.error : fallback;
}

export default function QuestionRecord({
  question, apiBase, orgQuery, canWrite, prev, next, position, onStep, onClose, onChanged,
}: {
  /** null = Add a question (the same window, asking). */
  question: TournamentRegistrationField | null;
  /** `/api/admin/tournaments/{id}/registration-fields` */
  apiBase: string;
  orgQuery: string;
  canWrite: boolean;
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  position: string;
  onStep: (id: string) => void;
  onClose: () => void;
  /** Re-reads the list; false when it didn't load. */
  onChanged: () => Promise<boolean>;
}) {
  const creating = question === null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(question));
  const [seededFor, setSeededFor] = useState(question?.id ?? 'new');
  const changed = useRef(false);

  const held = !draft.label.trim() ? W.questionHeld
    : draft.fieldType === 'dropdown' && choicesOf(draft.optionsText).length === 0 ? W.choicesHeld
      : null;

  const write = useCallback(async (signal: AbortSignal) => {
    if (!question) return;
    const res = await fetch(`${apiBase}/${encodeURIComponent(question.id)}${orgQuery}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(bodyOf(draft)),
    });
    if (!res.ok) throw new Error(await failureOf(res, W.saveFailed));
    changed.current = true;
  }, [question, apiBase, orgQuery, draft]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canWrite && editing && !creating, loading: false, sig: JSON.stringify(draft), blocked: editing ? held : null, write, failText: W.saveFailed,
  });
  // Leaving, stepping and ✓ (one rule for every record window): a held or refused edit holds the window once.
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
      const res = await fetch(`${apiBase}${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyOf(draft)),
      });
      if (!res.ok) { setCreateError(await failureOf(res, W.addFailed)); return; }
      await onChanged();
      onClose();
    } catch {
      setCreateError(W.addFailed);
    } finally {
      setBusy(false);
    }
  }

  // ── Archive: asks first ──
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  async function doArchive() {
    if (!question) return;
    setBusy(true);
    setAskError('');
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(question.id)}${orgQuery}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('archive');
      setAsking(false);
      await onChanged();
      onClose();
    } catch {
      setAskError(W.archiveFailed);
    } finally {
      setBusy(false);
    }
  }

  const fields = (
    <>
      <TextField id="question-label" label={W.question} required value={draft.label} maxLength={200} onChange={v => change({ label: v })} />
      <label className={ck.field} htmlFor="question-type">
        <span className={ck.label}>{W.type}</span>
        <select id="question-type" className={ck.select} value={draft.fieldType}
          onChange={e => change({ fieldType: e.target.value as TournamentRegistrationFieldType })}>
          {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      {draft.fieldType === 'dropdown' && (
        <label className={ck.field} htmlFor="question-choices">
          <span className={ck.label}>{W.choices}<span className={styles.req} aria-hidden>*</span></span>
          <textarea id="question-choices" className={ck.textarea} rows={4} value={draft.optionsText}
            onChange={e => change({ optionsText: e.target.value })} />
          <p className={ck.hint}>{W.choicesHint}</p>
        </label>
      )}
      <div className={`${ck.switchRow}${draft.required ? '' : ` ${ck.switchRowOff}`}`}>
        <div className={ck.switchText}>
          <span className={ck.switchName} id="question-required">{W.required}</span>
          <p className={ck.hint}>{W.requiredHint}</p>
        </div>
        <button type="button" role="switch" aria-checked={draft.required} aria-labelledby="question-required" className={ck.switch}
          onClick={() => change({ required: !draft.required })} />
      </div>
    </>
  );

  if (creating) {
    return (
      <KitDialog
        kind="form"
        title={W.add}
        identity={W.lede}
        onClose={() => { if (!busy) onClose(); }}
        busy={busy}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => void create()} disabled={busy}>{busy ? W.adding : W.addAction}</button>
          </>
        )}
      >
        <FormError>{createError}</FormError>
        {fields}
      </KitDialog>
    );
  }

  const q = question!;
  const ask = archiveQuestion(q.label);
  const typeLabel = QUESTION_TYPES.find(t => t.value === q.fieldType)?.label ?? q.fieldType;
  return (
    <>
      <KitDialog
        kind="form"
        title={editing ? (draft.label.trim() || q.label) : q.label}
        ariaLabel={q.label}
        identity={questionCaption(q.fieldType, q.options.length, q.required)}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={held} onRetry={() => void handleSave()} /> : undefined}
        edit={canWrite ? { editing, onToggle: () => void toggleEdit(), label: W.edit(q.label) } : undefined}
        onClose={() => void leave(onClose)}
        busy={busy}
        steps={{
          prev: prev ? { name: prev.name, onStep: () => void leave(() => onStep(prev.id)) } : null,
          next: next ? { name: next.name, onStep: () => void leave(() => onStep(next.id)) } : null,
          position,
          positionWide: position,
          noun: W.noun,
        }}
        levelKey={q.id}
      >
        {editing ? fields : (
          <dl className={screenParts.recordFacts}>
            <div><dt>{W.type}</dt><dd>{typeLabel}</dd></div>
            {q.fieldType === 'dropdown' && <div><dt>{W.choices}</dt><dd>{q.options.join(' · ')}</dd></div>}
            <div><dt>{W.required}</dt><dd>{q.required ? `${W.yes}. ${W.requiredHint}` : W.no}</dd></div>
          </dl>
        )}
        {canWrite && (
          <RecordSection>
            <RecordAction icon={<Archive size={13} aria-hidden />} onClick={() => void leave(() => { setAskError(''); setAsking(true); })} disabled={busy}>
              {W.archive}
            </RecordAction>
          </RecordSection>
        )}
      </KitDialog>

      {asking && (
        <KitDialog
          kind="question"
          title={ask.title}
          onClose={() => { if (!busy) setAsking(false); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Keep it</button>
              <button type="button" className="btn btn-danger" onClick={() => void doArchive()} disabled={busy}>{ask.action}</button>
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
