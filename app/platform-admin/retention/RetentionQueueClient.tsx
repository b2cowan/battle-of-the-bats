'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../audit/audit.module.css';

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function noticeLabel(row: RetentionRow) {
  const notices: string[] = [];
  if (row.warningSentAt) notices.push(`Warning ${fmtDate(row.warningSentAt)}`);
  if (row.purgeNoticeSentAt) notices.push(`Pending ${fmtDate(row.purgeNoticeSentAt)}`);
  if (row.pendingPurgeAt && !row.purgeNoticeSentAt) notices.push(`Pending ${fmtDate(row.pendingPurgeAt)}`);
  return notices.length ? notices.join(' / ') : 'None';
}

export default function RetentionQueueClient({ rows }: { rows: RetentionRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function extend(row: RetentionRow) {
    const reason = window.prompt(`Reason for extending retention for ${row.displayName}?`);
    if (!reason?.trim()) return;

    setBusyId(row.id);
    try {
      const res = await fetch(`/api/platform-admin/retention/${row.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30, reason }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to extend retention');
      router.refresh();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Failed to extend retention');
    } finally {
      setBusyId(null);
    }
  }

  async function processExpiry() {
    setProcessing(true);
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
      window.alert([
        `Warning emails sent: ${data.warningEmailsSent ?? 0}`,
        `Records warning-tagged: ${data.warningRecordsTagged ?? 0}`,
        `Pending-purge emails sent: ${data.pendingPurgeEmailsSent ?? 0}`,
        `Records moved to pending purge: ${data.pendingPurgeRecords ?? 0}`,
      ].join('\n'));
      router.refresh();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Failed to process retention expiry');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <div className={styles.filterBar}>
        <button
          className={styles.filterBtn}
          onClick={processExpiry}
          disabled={processing}
        >
          {processing ? 'Processing...' : 'Process expiry'}
        </button>
        <span className={styles.dimText}>
          Sends 14-day warnings and moves expired records into pending purge.
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Org</th>
              <th>Record</th>
              <th>Type</th>
              <th>State</th>
              <th>Retention Deadline</th>
              <th>Days</th>
              <th>Notices</th>
              <th>Extensions</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.emptyCell}>No retained records are approaching purge.</td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row.id}>
                <td>
                  <Link href={`/platform-admin/orgs/${row.orgId}`} className={styles.orgLink}>
                    {row.orgName}
                  </Link>
                </td>
                <td>{row.displayName}</td>
                <td className={styles.actionCell}>{row.recordType}</td>
                <td className={styles.dimText}>{row.retainedState}</td>
                <td className={styles.tsCell}>{fmtDate(row.retentionUntil)}</td>
                <td>{row.daysRemaining}</td>
                <td className={styles.tsCell}>{noticeLabel(row)}</td>
                <td>
                  {row.extensionCount}
                  {row.lastExtensionReason && (
                    <span className={styles.dimText} title={row.lastExtensionReason}> - reason</span>
                  )}
                </td>
                <td>
                  <button
                    className={styles.filterBtn}
                    onClick={() => extend(row)}
                    disabled={busyId === row.id}
                  >
                    {busyId === row.id ? 'Extending...' : '+30 days'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
