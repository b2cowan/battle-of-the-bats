import { supabaseAdmin } from './supabase-admin';

/**
 * A COACHES PORTAL'S OWN CANCELLATION RECORDS COME BACK (its reason tag, `coaches_portal_cancellation`).
 *
 * Cancelling Premium archives the portal's tournaments and files an account record in `billing_retained_records`. Two doors give
 * them back: the portal buying Premium again (lib/team-checkout.ts) and — Plan & billing Stage 4b — the portal buying Club and
 * becoming the club (`applyPlanChangeSideEffects`, lib/plan-move.ts); without the second, the retention sweep would warn and then
 * purge a paying club's tournaments. Idempotent: only rows still retained are touched, so a retried event restores nothing twice.
 * A club's own cancellation records carry other reasons and are restored by lib/billing-reactivation.ts, never here.
 *
 * Its own module so the unit tests can load it: lib/team-checkout.ts imports `server-only`.
 */

type RetainedRecordRow = {
  id: string;
  record_type: string;
  record_id: string | null;
  metadata: {
    previousStatus?: unknown;
    retentionReason?: unknown;
    teamWorkspaceId?: unknown;
  } | null;
};

function restoredTournamentStatus(value: unknown): 'draft' | 'active' | 'completed' {
  return value === 'draft' || value === 'active' || value === 'completed'
    ? value
    : 'completed';
}

export async function restoreCoachesPortalRetainedRecords(orgId: string, workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, record_type, record_id, metadata')
    .eq('org_id', orgId)
    .in('retained_state', ['retained_inactive', 'pending_purge'])
    .eq('metadata->>retentionReason', 'coaches_portal_cancellation');

  if (error) throw error;

  const retained = ((data ?? []) as RetainedRecordRow[]).filter(row => (
    row.record_type === 'tournament' ||
    row.metadata?.teamWorkspaceId === workspaceId
  ));
  if (retained.length === 0) return { restoredCount: 0, restoredTournamentIds: [] as string[] };

  const restoredTournamentIds: string[] = [];
  for (const record of retained.filter(row => row.record_type === 'tournament' && row.record_id)) {
    if (!record.record_id) continue;
    const { error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .update({
        status: restoredTournamentStatus(record.metadata?.previousStatus),
        is_active: restoredTournamentStatus(record.metadata?.previousStatus) === 'active',
      })
      .eq('org_id', orgId)
      .eq('id', record.record_id);

    if (!tournamentError) restoredTournamentIds.push(record.record_id);
  }

  const { error: recordError } = await supabaseAdmin
    .from('billing_retained_records')
    .update({ retained_state: 'restored' })
    .in('id', retained.map(row => row.id));

  if (recordError) throw recordError;
  return { restoredCount: retained.length, restoredTournamentIds };
}
