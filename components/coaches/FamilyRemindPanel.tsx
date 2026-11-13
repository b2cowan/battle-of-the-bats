'use client';
import { useState } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { FAMILY_REMIND_COACH_WORDS as RW } from '@/lib/family-availability-words';
import type { RemindPreview, RemindReport } from '@/lib/family-availability-remind';
import { remindAgainAt } from '@/lib/family-availability-rules';

/**
 * REMIND, inside the room's Families card (Signed-in family accounts Stage 4b, Part 7; drawing tab 4).
 *
 * "Remind N" turns into its own confirm IN PLACE (the dues reminder's pattern): who gets it and the message, how many get the app
 * note only, who isn't reminded and why, the 24-hour rule; one full-width "Send to N parents", with "See what they'll get" and
 * "Cancel" as links. Then the report (parents reached and the players it was about, never who received what). The server re-derives everything; what this panel shows
 * comes from the server's own preview, read when the coach presses Remind.
 *
 * Only while the event is open (not started, not cancelled). Once used, nobody on the staff can remind for 24 hours: the line
 * says when it was used and when it comes back.
 */

// Type-only: erased at build, so the server module is never pulled into the browser bundle.
type Preview = RemindPreview;
type Report = RemindReport;

type Step =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'confirm'; preview: Preview; showSample: boolean; sending: boolean; error: string }
  | { kind: 'report'; report: Report }
  | { kind: 'error'; text: string };

export default function FamilyRemindPanel({ endpoint, count, remindedAt, nowMs, saveFirst, onReminded }: {
  /** The event's Remind address (GET = the confirm's facts, POST = the send). */
  endpoint: string;
  /** Players whose parents Remind would reach now (`remindPlan`), from the room's own read. */
  count: number;
  /** When Remind was last used on this event, by anyone on the staff. */
  remindedAt: string | null;
  /** The sheet's clock (it ticks), so the button returns once the 24 hours have passed. */
  nowMs: number;
  /** Saves a mark the coach tapped but the autosave hasn't sent yet (the server reads the book to decide who is reminded). */
  saveFirst: () => Promise<boolean>;
  /** The send went: the sheet records the time so the card reads it after a reopen. */
  onReminded: (at: string) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  // The 24-hour line says when Remind comes back; the button returns once that time has passed.
  const waiting = remindedAt && Date.parse(remindAgainAt(remindedAt)) > nowMs ? remindedAt : null;

  async function openConfirm() {
    setStep({ kind: 'loading' });
    try {
      if (!(await saveFirst())) { setStep({ kind: 'error', text: RW.readFailed }); return; }
      const res = await fetch(endpoint);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStep({ kind: 'error', text: json.code === 'closed' ? RW.closed : RW.readFailed });
        return;
      }
      const preview = json.preview as Preview;
      if (preview.againAt && preview.remindedAt) { onReminded(preview.remindedAt); setStep({ kind: 'idle' }); return; }
      if (preview.players.length === 0) { setStep({ kind: 'error', text: RW.nobody }); return; }
      setStep({ kind: 'confirm', preview, showSample: false, sending: false, error: '' });
    } catch {
      setStep({ kind: 'error', text: RW.readFailed });
    }
  }

  async function send(preview: Preview) {
    setStep({ kind: 'confirm', preview, showSample: false, sending: true, error: '' });
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const report = json.report as Report;
        onReminded(report.remindedAt);
        setStep({ kind: 'report', report });
        return;
      }
      if (json.code === 'too_soon' && json.remindedAt) { onReminded(json.remindedAt); setStep({ kind: 'idle' }); return; }
      if (json.code === 'closed') { setStep({ kind: 'error', text: RW.closed }); return; }
      if (json.code === 'nobody') { setStep({ kind: 'error', text: RW.nobody }); return; }
      setStep({ kind: 'confirm', preview, showSample: false, sending: false, error: RW.failed });
    } catch {
      setStep({ kind: 'confirm', preview, showSample: false, sending: false, error: RW.failed });
    }
  }

  if (step.kind === 'report') {
    const appOnly = RW.reportAppOnly(step.report.appOnly);
    return (
      <div className={styles.attRemindReport} role="status">
        <p className={styles.attFamiliesToast}><strong>{RW.report(step.report.players, step.report.parents)}</strong></p>
        {appOnly && <p className={styles.attFamiliesLine}>{appOnly}</p>}
        <p className={styles.attFamiliesLine}>{RW.when(step.report.remindedAt, remindAgainAt(step.report.remindedAt), nowMs)}</p>
      </div>
    );
  }

  if (waiting) return <p className={styles.attFamiliesLine}>{RW.when(waiting, remindAgainAt(waiting), nowMs)}</p>;

  if (step.kind === 'confirm') {
    const p = step.preview;
    const lines = [
      RW.who({ players: p.players, parents: p.parents, label: p.label, date: p.date }),
      RW.appOnly(p.appOnly, p.parents, p.clubName),
      RW.capped(p.capped),
      RW.marked(p.marked),
      RW.noParent(p.noParent),
      RW.limit(p.isPractice),
    ].filter((l): l is string => !!l);
    return (
      <div className={styles.attRemindConfirm} role="group" aria-label={RW.ask(p.players)}>
        <p className={styles.attRemindAsk}>{RW.ask(p.players)}</p>
        {lines.map(l => <p key={l} className={styles.attFamiliesLine}>{l}</p>)}
        {step.showSample && p.sample && (
          <div className={styles.attRemindSample}>
            <p className={styles.attFamiliesLine}>{RW.sampleSubject} {p.sample.subject}</p>
            <p className={styles.attRemindSampleTitle}>{p.sample.title}</p>
            <p className={styles.attRemindSampleBody}>{p.sample.body}</p>
            <p className={styles.attFamiliesLine}><u>{p.sample.button}</u></p>
          </div>
        )}
        {step.error && <p className={styles.errorText} role="alert">{step.error}</p>}
        <button type="button" className={`${styles.btnPrimary} ${styles.attRemindSend}`} disabled={step.sending} onClick={() => void send(p)}>
          {step.sending ? RW.sending : RW.send(p.parents)}
        </button>
        <p className={styles.attRemindLinks}>
          {p.sample && (
            <button type="button" className={styles.attFamiliesLinkBtn} disabled={step.sending}
              onClick={() => setStep({ ...step, showSample: !step.showSample })} aria-expanded={step.showSample}>
              {step.showSample ? RW.hide : RW.see}
            </button>
          )}
          <button type="button" className={styles.attFamiliesLinkBtn} disabled={step.sending} onClick={() => setStep({ kind: 'idle' })}>
            {RW.cancel}
          </button>
        </p>
      </div>
    );
  }

  if (count === 0) return null;
  return (
    <>
      {step.kind === 'error' && <p className={styles.errorText} role="alert">{step.text}</p>}
      <div className={styles.attendanceBulkActions}>
        <button type="button" className={styles.btnGhost} disabled={step.kind === 'loading'} onClick={() => void openConfirm()}>
          {step.kind === 'loading' ? RW.loading : RW.button(count)}
        </button>
      </div>
    </>
  );
}
