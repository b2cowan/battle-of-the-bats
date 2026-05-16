import HelpCallout from '@/components/help/HelpCallout';
import { supabaseAdmin } from '@/lib/supabase-admin';
import RetentionQueueClient from './RetentionQueueClient';
import styles from '../audit/audit.module.css';

type RetentionRowDb = {
  id: string;
  org_id: string;
  record_type: string;
  display_name: string;
  retained_state: string;
  retention_until: string;
  warning_sent_at: string | null;
  pending_purge_at: string | null;
  purge_notice_sent_at: string | null;
  extension_count: number | null;
  last_extension_reason: string | null;
  organizations: { name: string } | { name: string }[] | null;
};

function daysRemaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

async function getRetentionRows() {
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 30);

  const { data, error } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, org_id, record_type, display_name, retained_state, retention_until, warning_sent_at, pending_purge_at, purge_notice_sent_at, extension_count, last_extension_reason, organizations(name)')
    .in('retained_state', ['retained_inactive', 'pending_purge'])
    .lte('retention_until', windowEnd.toISOString())
    .order('retention_until', { ascending: true });

  if (error || !data) return [];

  return ((data as unknown) as RetentionRowDb[]).map(row => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return {
      id: row.id,
      orgId: row.org_id,
      orgName: org?.name ?? 'Unknown org',
      recordType: row.record_type,
      displayName: row.display_name,
      retainedState: row.retained_state,
      retentionUntil: row.retention_until,
      warningSentAt: row.warning_sent_at,
      pendingPurgeAt: row.pending_purge_at,
      purgeNoticeSentAt: row.purge_notice_sent_at,
      daysRemaining: daysRemaining(row.retention_until),
      extensionCount: row.extension_count ?? 0,
      lastExtensionReason: row.last_extension_reason,
    };
  });
}

export default async function RetentionQueuePage() {
  const rows = await getRetentionRows();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>FieldLogicHQ</div>
        <h1 className={styles.title}>Retention Queue</h1>
        <div className={styles.count}>{rows.length} records</div>
      </header>

      <HelpCallout
        variant="warning"
        title="Records approaching purge"
        body="This queue shows retained billing records with a purge deadline in the next 30 days, plus records that have already moved into pending purge. Process expiry to send owner notices, then extend retention when support needs more time to resolve a billing or restoration case."
      />

      <RetentionQueueClient rows={rows} />
    </div>
  );
}
