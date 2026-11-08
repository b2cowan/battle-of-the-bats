'use client';

import { useId, useRef, useState } from 'react';
import KitDialog, { DialogReason } from '@/components/shared/KitDialog';
import DateInput from '@/components/shared/DateInput';
import { WORKSHEET_LINES, type Worksheet } from '@/lib/gst-return-worksheet';
import { filingBlock, linesKey } from '@/lib/gst-return-filing';
import { FILING, lineFigure, RETURN_LINES, refusalWords } from '@/lib/gst-return-worksheet-text';
import kit from '../console.module.css';
import styles from './bookkeeping.module.css';
import view from './ReportsGstReturn.module.css';

type Refusal = { field?: 'filedOn' | 'reason'; error: string };

/**
 * "Mark … as filed?" (GST/HST Stage 4b Session C). Not drawn: the house reason question (KitDialog `question`, 416px, two quiet
 * answers, as GstRegistrationQuestion and Void), with the lines it saves shown. The SERVER recomputes the worksheet and freezes
 * that: this sends only the dates, the filed-on date, a reason and the revision on screen, never a figure. A period that can't
 * be marked (a line not known, the period not over) says why and offers only "Keep it open".
 */
export default function GstReturnFilingQuestion({ worksheet, revision, today, notice, onClose, onSaved, onStale }: {
  worksheet: Worksheet; revision: number; today: string;
  /** Why the question reopened on fresh figures (a "this changed" refusal), shown at its head. */
  notice: string | null;
  onClose: () => void; onSaved: () => void;
  /** The server said the screen is out of date (409): the caller reads the period again and reopens this on the new figures. */
  onStale: (why: string) => void;
}) {
  const id = useId();
  const again = revision > 0;
  const [filedOn, setFiledOn] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const blocked = filingBlock(worksheet, today);
  const open = worksheet.unresolved.filter(u => u.affects.length > 0).length;

  async function save() {
    if (sending.current || blocked) return; // a ref, not state: a fast second press must not send twice
    if (again && !reason.trim()) { setRefusal({ field: 'reason', error: refusalWords({ why: 'reason_missing' }) }); return; }
    sending.current = true;
    setBusy(true); setRefusal(null);
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/gst-return/filings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: worksheet.period.from, to: worksheet.period.to, filedOn, reason: reason.trim(), expectedRevision: revision, shownLines: linesKey(worksheet) }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) { onSaved(); onClose(); return; }
      if (response.status === 409 && body.why !== 'busy') { onStale(body.error ?? 'Something changed. Check the lines, then mark it again.'); return; }
      setRefusal({ field: body.field === 'filedOn' || body.field === 'reason' ? body.field : undefined, error: body.error ?? 'Unable to save the filing' });
    } catch { setRefusal({ error: 'Unable to save. Check your connection and try again.' }); }
    finally { sending.current = false; setBusy(false); }
  }

  const invalid = (field: Refusal['field']) => refusal?.field === field ? { 'aria-invalid': true as const } : {};
  const clear = (field: Refusal['field']) => { if (refusal?.field === field) setRefusal(null); };
  return <KitDialog kind="question" eyebrow={FILING.eyebrow} title={FILING.title(worksheet.period, again)} busy={busy} onClose={onClose}
    footer={<><button type="button" className={styles.quietButton} disabled={busy} onClick={onClose}>{again ? FILING.keepAgain : FILING.keep}</button>
      {!blocked && <button type="submit" form={id} className={styles.quietButton} disabled={busy}>{busy ? FILING.saving : FILING.confirm}</button>}</>}>
    {notice && <DialogReason inPlace>{notice}</DialogReason>}
    {blocked ? <DialogReason inPlace>{refusalWords(blocked)}</DialogReason> : <>
      <p>{again ? FILING.leadAgain : FILING.lead}</p>
      <ul className={view.filingLines}>{WORKSHEET_LINES.map(line => <li key={line}>
        <span className={view.ln}>{line}</span><span>{RETURN_LINES[line].caption}</span><b>{lineFigure(worksheet, line)}</b>
      </li>)}</ul>
      {open > 0 && <p className={kit.caption}>{FILING.openWarning(open)}</p>}
      {worksheet.partial && <p className={kit.caption}>{FILING.partialWarning}</p>}
      <form id={id} className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
        <label>{FILING.dateLabel}<DateInput className={kit.field} value={filedOn} {...invalid('filedOn')}
          onChange={value => { setFiledOn(value); clear('filedOn'); }} /></label>
        {refusal?.field === 'filedOn' && <DialogReason inPlace className={kit.fieldError}>{refusal.error}</DialogReason>}
        {again && <label>{FILING.reasonLabel}<textarea className={kit.textarea} maxLength={500} value={reason} {...invalid('reason')}
          onChange={event => { setReason(event.target.value); clear('reason'); }} /></label>}
        {refusal?.field === 'reason' && <DialogReason inPlace className={kit.fieldError}>{refusal.error}</DialogReason>}
        {refusal && !refusal.field && <DialogReason>{refusal.error}</DialogReason>}
      </form>
    </>}
  </KitDialog>;
}
