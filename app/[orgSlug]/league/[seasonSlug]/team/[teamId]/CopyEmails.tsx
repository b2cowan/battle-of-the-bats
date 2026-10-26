'use client';
/**
 * Copy emails on a coach's team page (Club Tier 9c, copy §10.2): every family's address on the clipboard at once, so a
 * coach writes to the team from their own mail. Where the clipboard is refused (an older browser, an insecure frame),
 * the addresses appear in a box to select by hand — the fallback the copy names.
 */
import { useState } from 'react';
import kit from '@/components/public/ClubKit.module.css';
import styles from './CoachTeam.module.css';

export default function CopyEmails({ emails }: { emails: string[] }) {
  const [state, setState] = useState<'idle' | 'copied' | 'fallback'>('idle');
  const joined = emails.join(', ');
  async function copy() {
    try {
      await navigator.clipboard.writeText(joined);
      setState('copied');
    } catch {
      setState('fallback');
    }
  }
  return (
    <div className={styles.copyRow}>
      <button type="button" className={`${kit.btn} ${kit.btnSecondary}`} onClick={copy}>Copy emails</button>
      {state === 'copied' && <p className={styles.copied} role="status">Copied {emails.length} {emails.length === 1 ? 'email' : 'emails'}.</p>}
      {state === 'fallback' && (
        <>
          <p className={styles.copied} role="status">Select the emails below to copy them.</p>
          <textarea className={styles.fallback} readOnly value={joined} aria-label="Families’ emails" onFocus={e => e.currentTarget.select()} />
        </>
      )}
    </div>
  );
}
