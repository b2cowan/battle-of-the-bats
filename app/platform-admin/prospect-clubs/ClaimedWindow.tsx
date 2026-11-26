'use client';
/**
 * A claimed preview's window (Club Website Track P, Session P3; owner rulings T10, T15; drawing tab 2). Who claimed it
 * (masked, so the owner can check it against the person met), when, and its plan; the way into Clubs & portals, where a
 * claimed club now lives like any other; and Undo the claim, offered until a plan starts (read narrowly: the database
 * refuses once the club has a plan, reached checkout, has other people or anything added, mig 540).
 */
import { useState } from 'react';
import Link from 'next/link';
import { Undo2 } from 'lucide-react';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import { repKit } from '@/components/admin/kit/club/RepKit';
import { CLAIMED_WORDS } from '@/lib/preview-claim';
import type { ProspectRow } from '@/lib/prospect-clubs';
import type { ClaimedFacts } from './ProspectClubsScreen';
import kit from '../console.module.css';
import styles from './room.module.css';

export default function ClaimedWindow({ row, facts, onClose, onUndone }: {
  row: ProspectRow; facts: ClaimedFacts | null; onClose: () => void; onUndone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function undo() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/platform-admin/prospect-clubs/${row.orgId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'undo' }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; kind?: string };
      if (res.ok) { setDone(true); setAsking(false); onUndone(); }
      else setError(data.kind === 'not_undoable' ? CLAIMED_WORDS.undoGone : data.error ?? 'That didn’t save. Try again.');
    } catch {
      setError('That didn’t save. Try again.');
    }
    setBusy(false);
  }

  if (asking) {
    return (
      <KitDialog kind="question" title={CLAIMED_WORDS.undoAsk(row.name)} onClose={() => setAsking(false)} busy={busy}
        footer={<>
          <DialogCancel>Keep the claim</DialogCancel>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void undo()}>{CLAIMED_WORDS.undoConfirm}</button>
        </>}>
        {error && <DialogReason className={kit.fieldError}>{error}</DialogReason>}
        <p>{CLAIMED_WORDS.undoBody}</p>
      </KitDialog>
    );
  }

  return (
    <KitDialog kind="form" title={row.name} onClose={onClose}>
      <div className={styles.body}>
        {!facts ? (
          <p className={kit.hint}>{CLAIMED_WORDS.deleted}</p>
        ) : done ? (
          <p className={`${kit.notice} ${kit.noticeGood}`} role="status">{CLAIMED_WORDS.undoDone}</p>
        ) : (
          <>
            <p>
              {row.claimed}{facts?.claimant ? ` ${CLAIMED_WORDS.by(facts.claimant)}` : ''}
              <span className={kit.sub}>{facts?.plan ?? CLAIMED_WORDS.noPlan}</span>
            </p>
            <Link href={`/platform-admin/orgs/${row.orgId}`} className={`${kit.door} ${styles.doorTap}`}>{CLAIMED_WORDS.openRecord} ›</Link>
            {error && <p className={kit.fieldError} role="alert">{error}</p>}
            {facts?.planStarted ? (
              <p className={kit.hint}>{CLAIMED_WORDS.undoGone}</p>
            ) : (
              <div className={styles.end}>
                {/* The record Delete's look with an undo arrow: it takes the club off the claimant, but deletes nothing. */}
                <button type="button" className={repKit.recordDelete} onClick={() => setAsking(true)} data-record-door="">
                  <Undo2 size={13} aria-hidden /> {CLAIMED_WORDS.undo}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </KitDialog>
  );
}
