'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RequiresAccess from '@/components/platform-admin/RequiresAccess';
import HelpCallout from '@/components/help/HelpCallout';
import { fmtAbsoluteDate } from '@/lib/format-date';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import styles from './retention.module.css';

type RetentionRow = {
  id: string;
  orgId: string;
  orgName: string;
  recordType: string;
  displayName: string;
  retainedState: string;
  retentionUntil: string;
  warningSentAt: string | null;
  pendingPurgeAt: string | null;
  purgeNoticeSentAt: string | null;
  daysRemaining: number;
  extensionCount: number;
  lastExtensionReason: string | null;
};

const fmtDate = (iso: string) => fmtAbsoluteDate(iso);

function noticeLabel(row: RetentionRow) {
  const notices: string[] = [];
  if (row.warningSentAt) notices.push(`Warning ${fmtDate(row.warningSentAt)}`);
  if (row.purgeNoticeSentAt) notices.push(`Pending ${fmtDate(row.purgeNoticeSentAt)}`);
  if (row.pendingPurgeAt && !row.purgeNoticeSentAt) notices.push(`Pending ${fmtDate(row.pendingPurgeAt)}`);
  return notices.length ? notices.join(' / ') : 'None';
}

export default function RetentionQueueClient({ rows, canManageBilling }: { rows: RetentionRow[]; canManageBilling: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function startExtend(row: RetentionRow) {
    setExtendId(row.id);
    setReason(row.lastExtensionReason ?? '');
    setMessage('');
    setError('');
  }

  async function extend(row: RetentionRow) {
    if (!reason.trim()) {
      setError('Reason is required to extend retention.');
      return;
    }

    setBusyId(row.id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/platform-admin/retention/${row.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30, reason }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to extend retention');
      setMessage(`Extended ${row.displayName} by 30 days.`);
      setExtendId(null);
      setReason('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to extend retention');
    } finally {
      setBusyId(null);
    }
  }

  async function processExpiry() {
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/platform-admin/retention/process', { method: 'POST' });
      const data = await res.json() as {
        error?: string;
        warningEmailsSent?: number;
        warningRecordsTagged?: number;
        pendingPurgeEmailsSent?: number;
        pendingPurgeRecords?: number;
      };
      if (!res.ok) throw new Error(data.error ?? 'Failed to process retention expiry');
      setMessage([
        `Warning emails sent: ${data.warningEmailsSent ?? 0}`,
        `Records warning-tagged: ${data.warningRecordsTagged ?? 0}`,
        `Pending-purge emails sent: ${data.pendingPurgeEmailsSent ?? 0}`,
        `Records moved to pending purge: ${data.pendingPurgeRecords ?? 0}`,
      ].join(' / '));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process retention expiry');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className={kit.page}>
      <AdminPageHeader
        title="Retention queue"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={processExpiry}
            disabled={processing || !canManageBilling}
            title={!canManageBilling ? 'Requires billing access' : undefined}
          >
            {processing ? 'Processing...' : 'Process expiry'}
          </button>
        }
      />

      <HelpCallout
        variant="warning"
        title="Records approaching purge"
        body="This queue shows retained billing records with a purge deadline in the next 30 days, plus records that have already moved into pending purge. Process expiry to send owner notices, then extend retention when support needs more time to resolve a billing or restoration case."
      />

      <p className={`${kit.caption} ${styles.hintLine}`}>
        Sends 14-day warnings and moves expired records into pending purge.
        {!canManageBilling && <RequiresAccess permission="billing access" role="billing" />}
      </p>

      {(message || error) && (
        <div className={`${kit.callout} ${error ? kit.calloutBad : ''}`}>
          <span>{error || message}</span>
          <span className={kit.calloutEnd}>
            <button
              className={kit.door}
              onClick={() => { setMessage(''); setError(''); }}
              type="button"
            >
              Dismiss
            </button>
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <HelpCallout
          variant="tip"
          title="Nothing approaching purge"
          body="No retained records are approaching their purge deadline. Accounts appear here after cancellation or downgrade as their retention window counts down."
        />
      ) : (
        <section className={kit.section}>
          <div className={kit.card}>
            <div className={kit.toolbar}>
              <span className={kit.count}>{rows.length} records</span>
            </div>
            <div className={`${kit.tableWrap} table-cards`}>
              <table className={`${kit.comfortable} ${styles.queueTable}`}>
                <thead>
                  <tr>
                    <th>Org</th>
                    <th>Record</th>
                    <th>Type</th>
                    <th>State</th>
                    <th>Retention deadline</th>
                    <th>Days</th>
                    <th>Notices</th>
                    <th>Extensions</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td className="table-cards-title">
                        <Link href={`/platform-admin/orgs/${row.orgId}?tab=billing`} className={kit.nameLink}>
                          {row.orgName}
                        </Link>
                      </td>
                      <td data-label="Record">{row.displayName}</td>
                      <td data-label="Type">{row.recordType}</td>
                      <td data-label="State" className={kit.nowrap}><span className={kit.code}>{row.retainedState}</span></td>
                      <td data-label="Retention deadline" className={kit.nowrap}>{fmtDate(row.retentionUntil)}</td>
                      <td data-label="Days" className={kit.nowrap}>
                        <span className={styles.days}>{row.daysRemaining}</span>
                        {row.daysRemaining <= 0 ? (
                          <span className={`${kit.chip} ${kit.chipBad} ${styles.daysChip}`}>Past deadline</span>
                        ) : row.daysRemaining <= 3 ? (
                          <span className={`${kit.chip} ${kit.chipWarn} ${styles.daysChip}`}>Urgent</span>
                        ) : null}
                      </td>
                      <td data-label="Notices">{noticeLabel(row)}</td>
                      <td data-label="Extensions">
                        {row.extensionCount}
                        {row.lastExtensionReason && (
                          <span className={kit.muted} title={row.lastExtensionReason}> - reason</span>
                        )}
                      </td>
                      <td data-label="Action">
                        {extendId === row.id ? (
                          <div className={styles.inlineForm}>
                            <textarea
                              className={kit.textarea}
                              value={reason}
                              onChange={event => setReason(event.target.value)}
                              rows={2}
                              placeholder="Reason for support extension"
                              aria-label="Reason for support extension"
                            />
                            <div className={kit.formActions}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => extend(row)}
                                disabled={busyId === row.id}
                                type="button"
                              >
                                {busyId === row.id ? 'Extending...' : 'Save'}
                              </button>
                              <button
                                className={kit.door}
                                onClick={() => { setExtendId(null); setReason(''); }}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => startExtend(row)}
                            disabled={busyId === row.id || !canManageBilling}
                            title={!canManageBilling ? 'Requires billing access' : undefined}
                            type="button"
                          >
                            +30 days
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
