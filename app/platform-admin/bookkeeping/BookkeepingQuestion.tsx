'use client';

import { useId, useState, type ReactNode } from 'react';
import KitDialog, { DialogReason } from '@/components/shared/KitDialog';
import kit from '../console.module.css';
import styles from './bookkeeping.module.css';

/** The shared reason-question recipe: two quiet answers, refusal beside the answer. */
export default function BookkeepingQuestion({ title, lead, confirm, keep = 'Keep it', onClose, submit }: {
  title: string; lead?: ReactNode; confirm: string; keep?: string; onClose: () => void;
  submit: (reason: string) => Promise<string | null>;
}) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    if (busy) return;
    if (!reason.trim()) { setError('Say why before continuing.'); return; }
    setBusy(true); setError('');
    try { const refusal = await submit(reason.trim()); if (refusal) setError(refusal); else onClose(); }
    catch { setError('Unable to save. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <KitDialog kind="question" title={title} busy={busy} onClose={onClose}
    footer={<><button type="button" className={styles.quietButton} disabled={busy} onClick={onClose}>{keep}</button>
      <button type="submit" form={id} className={styles.quietButton} disabled={busy}>{busy ? 'Saving…' : confirm}</button></>}>
    {lead && <p>{lead}</p>}
    <form id={id} className={styles.form} onSubmit={event => { event.preventDefault(); void go(); }}>
      <label>Reason<textarea className={kit.textarea} maxLength={500} value={reason} onChange={event => { setReason(event.target.value); setError(''); }} /></label>
      <DialogReason>{error}</DialogReason>
    </form>
  </KitDialog>;
}
