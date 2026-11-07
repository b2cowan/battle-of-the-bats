'use client';

import { useEffect, useId, useState } from 'react';
import KitDialog, { DialogReason } from '@/components/shared/KitDialog';
import DateInput from '@/components/shared/DateInput';
import { consoleDate } from '@/lib/console-dates';
import { REGISTRATION_QUESTION } from '@/lib/bookkeeping-gst';
import type { GstRegistrationRevision } from '@/lib/bookkeeping-store';
import kit from '../console.module.css';
import styles from './bookkeeping.module.css';

type Refusal = { field?: 'effectiveDate' | 'reason'; error: string };

async function readHistory(): Promise<GstRegistrationRevision[]> {
  const response = await fetch('/api/platform-admin/bookkeeping/gst-registration', { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.schemaReady) throw new Error(body.error ?? 'Unable to load the registration date');
  return body.history ?? [];
}

/**
 * "Change your registration date?" (GST/HST Stage 4a, drawings tab 4 end): the shipped reason-question recipe
 * (BookkeepingQuestion: two quiet answers) with the date field and the Changes list it needs. A save is a new
 * revision with a reason; the caller re-reads, so every credit and Needs attention reason is worked out again.
 */
export default function GstRegistrationQuestion({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const [history, setHistory] = useState<GstRegistrationRevision[] | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const date = typed ?? history?.[0]?.effective_date ?? '';
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  useEffect(() => {
    readHistory().then(setHistory)
      .catch(cause => setRefusal({ error: cause instanceof Error ? cause.message : 'Unable to load the registration date' }));
  }, []);

  async function save() {
    if (busy || !history?.length) return;
    if (!date) { setRefusal({ field: 'effectiveDate', error: REGISTRATION_QUESTION.dateMissing }); return; }
    if (!reason.trim()) { setRefusal({ field: 'reason', error: REGISTRATION_QUESTION.reasonMissing }); return; }
    setBusy(true); setRefusal(null);
    try {
      const response = await fetch('/api/platform-admin/bookkeeping/gst-registration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effectiveDate: date, reason: reason.trim(), expectedRevision: history[0].revision }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) { onSaved(); onClose(); return; }
      // Someone else changed it: show the newer history and keep what was typed, so the save can be repeated.
      if (response.status === 409) await readHistory().then(setHistory).catch(() => undefined);
      setRefusal({ field: body.field === 'effectiveDate' || body.field === 'reason' ? body.field : undefined, error: body.error ?? 'Unable to save the registration date' });
    } catch { setRefusal({ error: 'Unable to save. Check your connection and try again.' }); }
    finally { setBusy(false); }
  }

  const invalid = (field: Refusal['field']) => refusal?.field === field ? { 'aria-invalid': true as const } : {};
  const clear = (field: Refusal['field']) => { if (refusal?.field === field) setRefusal(null); };
  return <KitDialog kind="question" eyebrow={REGISTRATION_QUESTION.eyebrow} title={REGISTRATION_QUESTION.title} busy={busy} onClose={onClose}
    footer={<><button type="button" className={styles.quietButton} disabled={busy} onClick={onClose}>{REGISTRATION_QUESTION.keep}</button>
      <button type="submit" form={id} className={styles.quietButton} disabled={busy || !history?.length}>{busy ? 'Saving…' : REGISTRATION_QUESTION.confirm}</button></>}>
    <p>{REGISTRATION_QUESTION.lead}</p>
    <form id={id} className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
      <label>{REGISTRATION_QUESTION.dateLabel}<DateInput value={date} {...invalid('effectiveDate')}
        onChange={value => { setTyped(value); clear('effectiveDate'); }} /></label>
      {refusal?.field === 'effectiveDate' && <DialogReason inPlace className={kit.fieldError}>{refusal.error}</DialogReason>}
      <label>Reason<textarea className={kit.textarea} maxLength={500} value={reason} {...invalid('reason')}
        onChange={event => { setReason(event.target.value); clear('reason'); }} /></label>
      {refusal?.field === 'reason' && <DialogReason inPlace className={kit.fieldError}>{refusal.error}</DialogReason>}
      {refusal && !refusal.field && <DialogReason>{refusal.error}</DialogReason>}
    </form>
    {history && history.length > 0 && <div className={styles.registrationChanges}>
      <p className={styles.hint}>Changes · {history.length}</p>
      <ul>{history.map(row => <li key={row.revision}>{consoleDate(row.effective_date)} · {row.reason}</li>)}</ul>
    </div>}
  </KitDialog>;
}
