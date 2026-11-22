'use client';
/**
 * THE RECORD'S TWO NEW SECTIONS (Board Ready Stage 4 Part 3; drawing tab 6 · B and tab 8 · B): "Sign-up answers" and
 * "Documents", after Fee and before History, so the money and the actions don't move down. Read when the record opens, from
 * the one route that returns a health answer (the list never holds one, ruling 5); a reader the Registrations gate refuses
 * never mounts the record at all.
 *
 * Reads only: the club doesn't edit a family's answers (ruling 20, the family changes them on Your sign-up), and a tick is
 * never editable. A file opens through a one-hour DOWNLOAD link made when it is pressed, and each opening is recorded in the
 * club's activity log. A PDF's hand-over reads "link opened {time}", never "read" or "viewed" (/legal).
 */
import { useCallback, useEffect, useState } from 'react';
import { RepChip, repKit } from '../../RepKit';
import ck from '../../ClubKit.module.css';
import facts from '@/components/coaches/kit/Ledger.module.css';
import { moneyFetch } from '../../money/MoneyKit';
import { STAFF_FORM_WORDS as W, cellWords, type RecordAnswer, type RecordAnswers } from '@/lib/club-form-staff-words';
import { sizeLine } from '@/lib/club-form-signup';
import css from './Registrations.module.css';

function AnswerValue({ a, open }: { a: RecordAnswer; open: (fileId: string) => Promise<void> }) {
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const c = a.cell;
  const dim = c.state !== 'answered';
  const sub: string[] = [];
  if (a.once) sub.push(W.onceFor(a.once));
  if (c.state === 'removed') sub.push(a.type === 'file' ? W.fileRemovedNote : W.removedNote);
  if (a.changedAt) sub.push(W.changedByFamily(a.changedAt));

  return (
    <>
      {a.file ? (
        <>
          {/* The name and its size on one line; the hour-long link and audit-log sentence is said once, under the section. */}
          <span className={css.answerFileLine}>
            <button type="button" className={`${ck.link} ${css.answerFile}`} disabled={opening}
              aria-label={W.fileOpenName(a.file.name)}
              onClick={async () => { setOpening(true); setFailed(false); try { await open(a.file!.id); } catch { setFailed(true); } setOpening(false); }}>
              {opening ? W.fileOpening : `${a.file.name} ↗`}
            </button>
            <span className={css.answerSub}>{sizeLine(a.file.size)}</span>
          </span>
          {failed && <span className={repKit.formError} role="alert">{W.fileFailed}</span>}
        </>
      ) : <span className={dim ? css.answerNone : css.answerText}>{cellWords(c, a.type)}</span>}
      {sub.map((s, i) => <span key={i} className={css.answerSub}>{s}</span>)}
    </>
  );
}

function AnswerRows({ rows, open, childName }: { rows: readonly RecordAnswer[]; open: (fileId: string) => Promise<void>; childName?: string }) {
  return (
    <div className={facts.facts}>
      {rows.map(a => (
        <div key={a.questionId} className={css.answerRow}>
          <div className={css.answerHead}>
            <div className={css.answerQ}>{a.label}</div>
            {a.health && <span className={css.answerChip}><RepChip tone="warn">{W.health}</RepChip></span>}
          </div>
          <div className={css.answerA}>
            <AnswerValue a={a} open={open} />
            {a.archivedAt && childName && <span className={css.answerSub}>{W.archivedLine(a.archivedAt, childName)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecordFormSections({ seasonId, regId, orgQuery, childName }: {
  seasonId: string; regId: string; orgQuery: string; childName: string;
}) {
  const [form, setForm] = useState<RecordAnswers | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const r = await moneyFetch<{ form: RecordAnswers | null }>(`/api/admin/house-league/seasons/${seasonId}/registrations/${regId}/answers${orgQuery}`).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setForm(r.data.form ?? null);
  }, [seasonId, regId, orgQuery]);
  useEffect(() => { void load(); }, [load]);

  const open = useCallback(async (fileId: string) => {
    // A tab made on the press itself: a browser blocks one opened after the wait for the link (Safari above all).
    const tab = window.open('about:blank', '_blank');
    const r = await moneyFetch<{ url?: string }>(`/api/admin/house-league/seasons/${seasonId}/registrations/${regId}/files/${fileId}${orgQuery}`, { method: 'POST' }).catch(() => null);
    if (!r?.ok || !r.data.url) { tab?.close(); throw new Error('not opened'); }
    if (tab) { tab.opener = null; tab.location.href = r.data.url; } else window.location.assign(r.data.url);
  }, [seasonId, regId, orgQuery]);

  if (failed) {
    return (
      <section className={css.recordSection}>
        <h3 className={css.recordHead}>{W.answersHead}</h3>
        <p className={ck.hint} role="alert">{W.answersFailed}{' '}
          <button type="button" className={ck.link} onClick={() => void load()}>{W.tryAgain}</button>
        </p>
      </section>
    );
  }
  if (form === undefined) {
    return (
      <section className={css.recordSection} aria-busy="true">
        <h3 className={css.recordHead}>{W.answersHead}</h3>
        <p className={ck.hint}>{W.answersLoading}</p>
      </section>
    );
  }
  // A season with no form, or a form with nothing on it, adds nothing to the record.
  if (!form || (form.answers.length === 0 && form.archived.length === 0 && form.documents.length === 0)) return null;

  // The link's one-hour life and the audit log are said once, and only when a file can be opened.
  const hasFile = [...form.answers, ...form.archived].some(a => a.file);

  return (
    <>
      {(form.answers.length > 0 || form.archived.length > 0) && (
        <section className={css.recordSection}>
          <h3 className={css.recordHead}>{W.answersHead}</h3>
          {form.answers.length > 0 ? <AnswerRows rows={form.answers} open={open} /> : <p className={ck.hint}>{W.noQuestions}</p>}
          {form.archived.length > 0 && (
            <>
              <h4 className={css.answerSubHead}>{W.noLongerAsked}</h4>
              <AnswerRows rows={form.archived} open={open} childName={childName} />
            </>
          )}
          {hasFile && <p className={ck.hint}>{W.fileNote}</p>}
        </section>
      )}
      {form.documents.length > 0 && (
        <section className={css.recordSection}>
          <h3 className={css.recordHead}>{W.documentsHead}</h3>
          <div className={facts.facts}>
            {form.documents.map(d => (
              <div key={d.documentId} className={css.answerRow}>
                <div className={css.answerHead}>
                  <div className={css.answerQ}>{d.name}</div>
                  {(d.state === 'again' || d.state === 'none') && <span className={css.answerChip}><RepChip tone="warn">{W.needsNewTick}</RepChip></span>}
                </div>
                <div className={css.answerA}>
                  {d.state !== 'again' && d.state !== 'none' && <span className={`${css.answerText} ${css.answerSentence}`}>{`“${d.sentence}”`}</span>}
                  <span className={css.answerSub}>{W.tickLine(d)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
