'use client';
/**
 * THE DELETION REQUEST — ONE WINDOW, ONE TEXT (Settings in both workspaces Session 1, drawing tab 6; owner "as recommended",
 * 2026-11-20). Opened from the last section of Plan & billing (Premium Coaches Portal, Tournament, Tournament Plus) and from
 * the club's Settings card (gate 4: its card and place unchanged). Words: `lib/org-deletion-words.ts` (/legal v0.2).
 *
 * `useDeletionRequest` reads the owner-only route once: the open request (the "Request sent" line, kept until staff close
 * it — mig 514), how many owners the reply goes to, and the online-payments part. A failed read says it couldn't check,
 * never offers a door that might send a second request.
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import KitDialog, { DialogCancel } from '@/components/shared/KitDialog';
import PaymentsEndingSection from './PaymentsEndingSection';
import {
  ORG_DELETION_WORDS as W, deletionReplyTo,
  type DeletionExportFrom, type DeletionWorkspace, type OpenDeletionRequest,
} from '@/lib/org-deletion-words';
import type { EndingSection } from '@/lib/online-payment-endings';
import styles from './Billing.module.css';

export type DeletionFacts = {
  request: OpenDeletionRequest | null;
  ownerCount: number;
  viewerEmail: string;
  onlinePayments: EndingSection | null;
  exportFrom: DeletionExportFrom;
};
export type DeletionRead = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: DeletionFacts };

const route = (orgSlug: string) => `/api/admin/org/request-deletion?orgSlug=${encodeURIComponent(orgSlug)}`;

/** The owner's read of the request route. `sent` puts the new (or already-open) request in place without a reload. */
export function useDeletionRequest(orgSlug: string) {
  // Keyed by the organization, as the billing reads are: another organization's answer never paints.
  const [state, setState] = useState<{ slug: string; read: DeletionRead } | null>(null);
  useEffect(() => {
    if (!orgSlug) return;
    const abort = new AbortController();
    fetch(route(orgSlug), { credentials: 'same-origin', cache: 'no-store', signal: abort.signal })
      .then(async res => { if (!res.ok) throw new Error('Read failed'); return res.json() as Promise<DeletionFacts>; })
      .then(data => { if (!abort.signal.aborted) setState({ slug: orgSlug, read: { status: 'ready', data } }); })
      .catch(() => { if (!abort.signal.aborted) setState({ slug: orgSlug, read: { status: 'error' } }); });
    return () => abort.abort();
  }, [orgSlug]);
  const sent = useCallback((request: OpenDeletionRequest) =>
    setState(s => s && s.read.status === 'ready' ? { slug: s.slug, read: { status: 'ready', data: { ...s.read.data, request } } } : s), []);
  const read: DeletionRead = state?.slug === orgSlug ? state.read : { status: 'loading' };
  return { read, sent };
}

/** "Request sent {date}. We'll reply to {owner email | name's owners} within 30 days." — the olive check line. */
export function DeletionSentLine({ request, orgName, ownerCount }: { request: OpenDeletionRequest; orgName: string; ownerCount: number }) {
  return <p className={styles.sentLine} role="status">
    <CheckCircle2 size={16} aria-hidden />
    <span>{W.section.sent(request.sentAt, deletionReplyTo(orgName, ownerCount, request.requesterEmail))}</span>
  </p>;
}

export function DeletionRequestWindow({ orgSlug, orgName, workspace, facts, paid, onClose, onSent }: {
  orgSlug: string;
  orgName: string;
  workspace: DeletionWorkspace;
  facts: DeletionFacts;
  /** L-A: only while a paid period runs (`deletionPaidUntil`). */
  paid: { plan: string; until: string } | null;
  onClose: () => void;
  onSent: (request: OpenDeletionRequest) => void;
}) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setFailed(null);
    try {
      const res = await fetch(route(orgSlug), {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => ({})) as { request?: OpenDeletionRequest; error?: string };
      if (!res.ok || !body.request) throw new Error(body.error ?? W.window.sendFailed);
      onSent(body.request);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : W.window.sendFailed);
      setSending(false);
    }
  }

  const reasonId = `delete-reason-${orgSlug}`;
  return (
    <KitDialog
      kind="form"
      title={W.window.title(orgName)}
      onClose={onClose}
      busy={sending}
      dirty={reason.trim().length > 0}
      footer={<>
        <DialogCancel>{W.window.dismiss}</DialogCancel>
        <button type="button" className="btn btn-danger" onClick={() => void send()} disabled={sending}>
          {sending ? W.window.sending : W.window.send}
        </button>
      </>}
    >
      <div className={styles.deleteParts}>
        <p className={styles.deleteLead}>{facts.ownerCount > 1 ? W.window.replyOwners(orgName) : W.window.reply(facts.viewerEmail)}</p>
        <div className={`${styles.deletePart} ${styles.deleteGone}`}>
          <h3 className={styles.deletePartHeading}>{W.window.deletedHeading}</h3>
          <p>{W.window.deleted[workspace]}</p>
          <p className={styles.muted}>{W.window.keepFirst}</p>
        </div>
        <div className={`${styles.deletePart} ${styles.deleteKept}`}>
          <h3 className={styles.deletePartHeading}>{W.window.keptHeading}</h3>
          <ul>
            <li>{W.window.signIns(W.window.people[workspace], orgName)}</li>
            <li>{W.window.records(orgName)}</li>
            <li>{W.window.backups}</li>
            {workspace === 'club' && <li>{W.window.coachPortalStays(orgName)}</li>}
          </ul>
        </div>
        {paid && <div className={styles.deletePart}><p>{W.window.paid(paid.plan, paid.until, orgName)}</p></div>}
        <PaymentsEndingSection section={facts.onlinePayments} ending={{ kind: 'delete', exportFrom: facts.exportFrom }} />
        <div className={styles.field}>
          <label className={styles.label} htmlFor={reasonId}>{W.window.reasonLabel} <span className={styles.muted}>{W.window.reasonOptional}</span></label>
          <textarea id={reasonId} className={styles.textarea} value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={1000} aria-describedby={`${reasonId}-hint`} />
          <p id={`${reasonId}-hint`} className={styles.hint}>{W.window.reasonHint}</p>
        </div>
        {failed && <p role="alert" className={`${styles.waitCallout} ${styles.calloutDanger}`}>{failed}</p>}
      </div>
    </KitDialog>
  );
}
