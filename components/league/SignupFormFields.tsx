'use client';

import { useEffect, useRef, useState } from 'react';
import DateInput from '@/components/shared/DateInput';
import formKit from '@/components/public/ClubForm.module.css';
import styles from './register.module.css';
import { fileRefusal, isPhoto, sizeLine, usesDropdown, type AnswerIn, type SignupDocument, type SignupQuestion } from '@/lib/club-form-signup';
import { FAMILY_FORM_WORDS as W } from '@/lib/club-form-family-words';

/**
 * THE CLUB'S QUESTIONS AND DOCUMENTS, AS A FAMILY FILLS THEM IN (Board Ready Stage 4 Part 2; drawing tab 5). Shared by
 * the sign-up page and Your sign-up's Change, so a question looks and behaves the same in both. The family side never
 * says "form" (ruling 19).
 *
 *   QuestionField   the seven types (one choice: round buttons up to four, a dropdown from five), help text, the plain
 *                   asterisk, the health line under a health question, the field's own red line.
 *   FileField       a file goes up the moment it is chosen (one per request); uploading + Cancel, too big before it
 *                   travels, failed + Try again / Remove. A file question is never required, so none of it blocks.
 *   DocumentBlock   typed text ticks in place; a PDF's tick stays faded (still focusable, with the reason) until the
 *                   family opens it through our server; "Opened. You can now tick." is announced; "Download it instead"
 *                   and the club's contact when a PDF won't open.
 *   ClubPrivacyLink the club's privacy link at the foot of the form, when the club has one.
 */

/** A file as the page holds it. Never kept across a reload (call C3): it lives in memory only. */
type FileDraft =
  | { state: 'uploading'; name: string; size: number; type: string; progress: number }
  | { state: 'done'; name: string; size: number; type: string; id: string }
  | { state: 'failed'; name: string; size: number; type: string; error: string; blob: File }
  | { state: 'refused'; name: string; size: number; type: string; error: string };

export type AnswerDraft = { text?: string; choiceIds?: string[]; bool?: boolean | null; date?: string; file?: FileDraft | null };

/** What the page sends for a question; null when nothing is given. */
export function toAnswerIn(questionId: string, d: AnswerDraft | undefined): AnswerIn | null {
  if (!d) return null;
  if (d.file !== undefined) return d.file?.state === 'done' ? { questionId, fileId: d.file.id } : null;
  if (d.text !== undefined) return d.text.trim() ? { questionId, text: d.text } : null;
  if (d.choiceIds !== undefined) return d.choiceIds.length ? { questionId, choiceIds: d.choiceIds } : null;
  if (d.bool !== undefined) return typeof d.bool === 'boolean' ? { questionId, bool: d.bool } : null;
  if (d.date !== undefined) return d.date ? { questionId, date: d.date } : null;
  return null;
}

/** True while any file of a set of answers is still travelling (Sign up waits on "Uploading…"). */
export const anyUploading = (answers: Record<string, AnswerDraft>) => Object.values(answers).some(a => a.file?.state === 'uploading');

/** True when a set of answers holds anything a family typed or attached (Remove on a child asks first). */
export const anyAnswer = (answers: Record<string, AnswerDraft>) => Object.entries(answers).some(([id, a]) => toAnswerIn(id, a) !== null || a.file?.state === 'uploading');
export const anyFile = (answers: Record<string, AnswerDraft>) => Object.values(answers).some(a => a.file && a.file.state !== 'refused');

type FieldProps = {
  q: SignupQuestion;
  /** Unique on the page: the input's id is `${idBase}-${q.id}`. */
  idBase: string;
  value: AnswerDraft | undefined;
  onChange: (next: AnswerDraft) => void;
  error?: string;
  club: string;
  /** Who the health line names: the child's first name, or "your children" for the sign-up's own. */
  who: string;
  /** The error box's name for this field ("T-shirt size for Leo"). */
  errorName: string;
  orgSlug: string;
  seasonSlug: string;
};

const fieldId = (idBase: string, questionId: string) => `${idBase}-${questionId.slice(0, 8)}`;

/** The marks the error box reads on a field in error: its name ("T-shirt size for Leo") and the input to focus. One
 *  helper for every field on the page, so anything showing a red line can be named and reached. */
export const errorAttrs = (on: unknown, name: string, target: string) =>
  (on ? { 'data-field-error': 'true', 'data-field-name': name, 'data-field-target': target } : {});

export function QuestionField({ q, idBase, value, onChange, error, club, who, errorName, orgSlug, seasonSlug }: FieldProps) {
  const id = fieldId(idBase, q.id);
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const describedBy = [q.helpText ? helpId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  const label = <>{q.label}{q.required && <> <span className={formKit.required}>*</span></>}</>;
  const inputClass = `${formKit.input}${error ? ` ${formKit.inputError}` : ''}`;
  // Round buttons and boxes are a group (a fieldset, its legend); every other type is one labelled control.
  const grouped = q.type === 'many_choices' || q.type === 'yes_no' || (q.type === 'one_choice' && !usesDropdown(q));

  let control: React.ReactNode;
  if (q.type === 'short_answer') {
    control = <input id={id} className={inputClass} type="text" value={value?.text ?? ''} maxLength={300} aria-describedby={describedBy}
      aria-invalid={!!error} onChange={e => onChange({ text: e.target.value })} />;
  } else if (q.type === 'long_answer') {
    control = <textarea id={id} className={`${formKit.textarea}${error ? ` ${formKit.inputError}` : ''}`} rows={3} value={value?.text ?? ''} maxLength={5000}
      aria-describedby={describedBy} aria-invalid={!!error} onChange={e => onChange({ text: e.target.value })} />;
  } else if (q.type === 'date') {
    control = <DateInput id={id} className={inputClass} value={value?.date ?? ''} onChange={v => onChange({ date: v })} />;
  } else if (q.type === 'one_choice' && !grouped) {
    control = (
      <select id={id} className={inputClass} value={value?.choiceIds?.[0] ?? ''} aria-describedby={describedBy} aria-invalid={!!error}
        onChange={e => onChange({ choiceIds: e.target.value ? [e.target.value] : [] })}>
        <option value="">{W.choose}</option>
        {q.choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    );
  } else if (grouped) {
    const many = q.type === 'many_choices';
    const options = q.type === 'yes_no' ? [{ id: 'yes', label: W.yes }, { id: 'no', label: W.no }] : q.choices;
    const isOn = (c: string) => (q.type === 'yes_no' ? (c === 'yes' ? value?.bool === true : value?.bool === false) : !!value?.choiceIds?.includes(c));
    const pick = (c: string, on: boolean) => {
      if (q.type === 'yes_no') return onChange({ bool: c === 'yes' });
      const had = value?.choiceIds ?? [];
      onChange({ choiceIds: many ? (on ? [...had, c] : had.filter(x => x !== c)) : [c] });
    };
    control = (
      <div className={styles.choiceList}>
        {options.map((c, i) => (
          <label key={c.id} className={styles.choiceRow}>
            <input type={many ? 'checkbox' : 'radio'} name={id} id={i === 0 ? id : undefined} checked={isOn(c.id)}
              onChange={e => pick(c.id, e.target.checked)} />
            <span>{c.label}</span>
          </label>
        ))}
        {/* An optional round-button question can go back to unanswered; a required one can't (it needs an answer). */}
        {!many && !q.required && (q.type === 'yes_no' ? typeof value?.bool === 'boolean' : !!value?.choiceIds?.length) && (
          <button type="button" className={styles.linkButton} onClick={() => onChange(q.type === 'yes_no' ? { bool: null } : { choiceIds: [] })}>{W.choiceClear}</button>
        )}
      </div>
    );
  } else {
    control = <FileField id={id} value={value?.file ?? null} onChange={file => onChange({ file })} orgSlug={orgSlug} seasonSlug={seasonSlug}
      questionId={q.id} describedBy={describedBy} />;
  }

  const Wrap = grouped ? 'fieldset' : 'div';
  return (
    <Wrap className={grouped ? `${formKit.field} ${styles.choiceSet}` : formKit.field} aria-describedby={grouped ? describedBy : undefined}
      {...errorAttrs(error, errorName, id)}>
      {grouped ? <legend className={formKit.label}>{label}</legend> : <label className={formKit.label} htmlFor={id}>{label}</label>}
      {q.helpText && <p id={helpId} className={formKit.hint} style={grouped ? undefined : { marginTop: 0 }}>{q.helpText}</p>}
      {control}
      {q.type === 'file' && <p className={formKit.hint}>{W.fileHint}</p>}
      {q.health && <p className={styles.healthLine}>{W.healthLine(club, who)}</p>}
      {error && <p id={errId} className={formKit.errorMsg}>{error}</p>}
    </Wrap>
  );
}

/** One file, uploaded on choose (ruling 9). The XHR gives progress and Cancel, which fetch can't. */
function FileField({ id, value, onChange, orgSlug, seasonSlug, questionId, describedBy }: {
  id: string; value: FileDraft | null; onChange: (f: FileDraft | null) => void; orgSlug: string; seasonSlug: string; questionId: string; describedBy?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const base = `/api/league/${orgSlug}/${seasonSlug}/form/files`;
  // A file still travelling when the field leaves the page is stopped (a removed child, a reload).
  useEffect(() => () => xhr.current?.abort(), []);

  const send = (file: File) => {
    const meta = { name: file.name, size: file.size, type: file.type };
    const refused = fileRefusal(file);
    if (refused) {
      onChange({ state: 'refused', ...meta, error: refused === 'too_big' ? W.fileTooBig(sizeLine(file.size), isPhoto(file)) : W.fileWrongType });
      return;
    }
    onChange({ state: 'uploading', ...meta, progress: 0 });
    const body = new FormData();
    body.set('questionId', questionId);
    body.set('file', file);
    const req = new XMLHttpRequest();
    xhr.current = req;
    req.open('POST', base);
    req.upload.onprogress = e => { if (e.lengthComputable) onChange({ state: 'uploading', ...meta, progress: e.loaded / e.total }); };
    req.onload = () => {
      xhr.current = null;
      let data: { id?: string; name?: string; error?: string } = {};
      try { data = JSON.parse(req.responseText); } catch { /* the words below */ }
      if (req.status === 201 && data.id) onChange({ state: 'done', ...meta, name: data.name ?? meta.name, id: data.id });
      else if (req.status === 413 || req.status === 415) onChange({ state: 'refused', ...meta, error: data.error ?? W.fileWrongType });
      else onChange({ state: 'failed', ...meta, error: data.error ?? W.fileFailed, blob: file });
    };
    req.onerror = () => { xhr.current = null; onChange({ state: 'failed', ...meta, error: W.fileFailed, blob: file }); };
    req.onabort = () => { xhr.current = null; };
    req.send(body);
  };
  const clearField = () => { onChange(null); if (input.current) input.current.value = ''; };
  const remove = () => {
    if (value?.state === 'done') void fetch(`${base}/${value.id}`, { method: 'DELETE' }).catch(() => { /* swept within a day */ });
    clearField();
  };
  const cancel = () => { xhr.current?.abort(); clearField(); };
  const tag = (v: { type: string; name: string }) => (isPhoto(v) ? 'IMG' : 'PDF');

  return (
    <>
      {/* Once a file row replaces the Choose button, the buttons in the row are the way in: the hidden input leaves the tab order. */}
      <input ref={input} id={id} type="file" className={styles.fileInput} aria-describedby={describedBy} tabIndex={value ? -1 : undefined}
        accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.heic,.heif"
        onChange={e => { const f = e.target.files?.[0]; if (f) send(f); }} />
      {!value ? (
        <label htmlFor={id} className={styles.fileChoose}>
          <span className={styles.fileChooseDesk}>{W.fileChoose}</span>
          <span className={styles.fileChoosePhone}>{W.fileChoosePhone}</span>
        </label>
      ) : (
        <div className={`${styles.fileRow}${value.state === 'refused' || value.state === 'failed' ? ` ${styles.fileRowBad}` : ''}`}>
          <span className={styles.fileTag}>{tag(value)}</span>
          <span className={styles.fileName}>{value.name}{value.state === 'done' || value.state === 'refused' ? ` · ${sizeLine(value.size)}` : ''}</span>
          {value.state === 'uploading' && (
            <>
              <span className={styles.fileBar} role="progressbar" aria-label={W.fileUploading(value.name)} aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.round(value.progress * 100)}><span style={{ width: `${Math.round(value.progress * 100)}%` }} /></span>
              <button type="button" className={styles.linkButton} onClick={cancel}>{W.fileCancel}</button>
            </>
          )}
          {value.state === 'done' && <button type="button" className={styles.linkButton} onClick={remove}>{W.fileRemove}</button>}
          {value.state === 'refused' && (
            <>
              <button type="button" className={styles.linkButton} onClick={() => input.current?.click()}>{W.fileChooseAnother}</button>
              <button type="button" className={styles.linkButton} onClick={remove}>{W.fileRemove}</button>
            </>
          )}
          {value.state === 'failed' && (
            <>
              <button type="button" className={styles.linkButton} onClick={() => send(value.blob)}>{W.fileTryAgain}</button>
              <button type="button" className={styles.linkButton} onClick={remove}>{W.fileRemove}</button>
            </>
          )}
        </div>
      )}
      {(value?.state === 'refused' || value?.state === 'failed') && <p className={formKit.errorMsg} role="alert">{value.error}</p>}
    </>
  );
}

/** The season's document routes: Open (in the tab) and "Download it instead". */
const openHref = (orgSlug: string, seasonSlug: string, d: Pick<SignupDocument, 'id' | 'versionId'>, download = false) =>
  `/api/league/${orgSlug}/${seasonSlug}/form/documents/${d.id}/open?v=${d.versionId}${download ? '&download=1' : ''}`;

/**
 * One document: typed text in its box with the tick enabled; a PDF with Open, its tick faded until opened. `opened` is
 * the page's own memory that the family pressed Open (the server holds the proof, the receipt it handed over).
 */
export function DocumentBlock({ d, ticked, onTick, opened, onOpened, error, orgSlug, seasonSlug, club, contact, idBase, forLine, busy }: {
  d: SignupDocument; ticked: boolean; onTick: (on: boolean) => void; opened: boolean; onOpened: () => void; error?: string;
  orgSlug: string; seasonSlug: string; club: string; contact: string | null; idBase: string;
  /** Your sign-up: "For Maya and Leo." before the reason. */
  forLine?: string; busy?: boolean;
}) {
  const id = `${idBase}-doc-${d.id.slice(0, 8)}`;
  const reasonId = `${id}-why`;
  const pdf = d.source === 'pdf';
  const locked = pdf && !opened;
  const [said, setSaid] = useState('');
  const waiting = useRef(false);
  // "Opened. You can now tick." when the family comes back to the page (the PDF opened in a new tab), or a moment after
  // Open if the page never left the screen.
  const announce = () => { if (waiting.current && document.visibilityState === 'visible') { waiting.current = false; setSaid(W.opened); } };
  useEffect(() => {
    document.addEventListener('visibilitychange', announce);
    return () => document.removeEventListener('visibilitychange', announce);
  }, []);
  const open = () => {
    onOpened();
    waiting.current = true;
    window.setTimeout(announce, 1500);
  };
  const size = sizeLine(d.fileSize ?? 0);

  return (
    <div className={styles.docItem} {...errorAttrs(error, d.name, id)}>
      <p className={styles.docName}><span className={styles.fileTag}>{pdf ? 'PDF' : 'TEXT'}</span> {d.name}</p>
      {pdf ? (
        <p className={styles.docOpenRow}>
          <a className={styles.docOpen} href={openHref(orgSlug, seasonSlug, d)} target="_blank" rel="noopener" aria-label={W.openName(d.name, size)} onClick={open} onAuxClick={e => { if (e.button === 1) open(); }}>
            {W.open(d.name)} <span aria-hidden="true">↗</span>
          </a>
          <span className={styles.fitDim} style={{ margin: 0 }}>{W.pdfMeta(size)}</span>
        </p>
      ) : (
        <div className={styles.waiverBox} role="document" aria-label={d.name}>{d.text}</div>
      )}
      <div className={`${styles.checkRow}${locked ? ` ${styles.checkRowOff}` : ''}`}>
        <input type="checkbox" id={id} checked={ticked && !locked} disabled={busy}
          aria-disabled={locked || undefined} aria-describedby={[locked || forLine ? reasonId : null, error ? `${id}-err` : null].filter(Boolean).join(' ') || undefined}
          onClick={e => { if (locked) e.preventDefault(); }}
          onChange={e => { if (!locked) onTick(e.target.checked); }} />
        <label htmlFor={id}>
          {d.sentence}
          {(locked || forLine) && <span id={reasonId} className={styles.fitDim} style={{ display: 'block' }}>{[forLine, locked ? W.openFirst : null].filter(Boolean).join(' ')}</span>}
        </label>
      </div>
      <p className={styles.srOnly} aria-live="polite">{said}</p>
      {pdf && opened && (
        <p className={styles.fitDim}>
          {W.wontOpen} <a href={openHref(orgSlug, seasonSlug, d, true)}>{W.downloadInstead}</a>, {W.orContact(club)}{contact ? <>: <a href={`mailto:${contact}`}>{contact}</a></> : ''}.
        </p>
      )}
      {error && <p id={`${id}-err`} className={`${formKit.errorMsg} ${styles.checkError}${locked || forLine || (pdf && opened) ? ` ${styles.checkErrorAfterLine}` : ''}`}>{error}</p>}
    </div>
  );
}

/** The club's privacy link at the foot of the form, only when the club has one (published Terms §4). */
export function ClubPrivacyLink({ club, privacyUrl }: { club: string; privacyUrl: string | null }) {
  if (!privacyUrl) return null;
  return (
    <p className={styles.privacyLink}>
      <a href={privacyUrl} target="_blank" rel="noopener">{W.privacyLink(club)} <span aria-hidden="true">↗</span></a>
    </p>
  );
}

/** The input of a set's first file question: where "Go to it" lands for "You can attach 5 files…". */
export const firstFileFieldId = (questions: readonly SignupQuestion[], idBase: string) => {
  const q = questions.find(x => x.type === 'file');
  return q ? fieldId(idBase, q.id) : '';
};
