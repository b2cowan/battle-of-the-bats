import { supabaseAdmin } from './supabase-admin';

/**
 * REACTIVATION RESTORES EVERYTHING CANCELLATION TOOK (A07, Club Tier Stage 1b).
 *
 * An organization's cancellation — the in-app cancel, the platform-admin cancel, or Stripe ending
 * the subscription — does four things: suspends the account (`billing_suspended_at` + reason) and
 * takes the public site offline (`is_public = false`); archives the tournaments into
 * `billing_retained_records`; files an account record there too; and writes a cancellation intent.
 * Until this existed, coming back undid none of them. Resubscribing restored only a DOWNGRADE's
 * retained tournaments, so the site stayed dark, the tournaments stayed archived, the retention
 * sweep later emailed a PAYING customer that their "window expired", and the old cancellation
 * intent stayed `applied` — which the webhook reads as "this deletion was already handled", so a
 * genuine later Stripe-side end would skip suspension entirely.
 *
 * This undoes all four, idempotently, for an ORGANIZATION account. A Coaches Portal workspace has
 * its own restore (`restoreCoachesPortalRetainedRecords`, lib/team-checkout.ts) and its own reason
 * tag; this never touches those records.
 *
 * Tournaments come back up to the plan's tournament limit (as the downgrade restore does); any
 * beyond it stay retained and visible on the billing page, exactly like a downgrade's remainder.
 */

const CANCELLATION_REASONS = ['account_cancellation', 'stripe_subscription_deleted'];

export type ReactivationResult = {
  /** The account had been suspended by a cancellation, and is not any more. */
  unsuspended: boolean;
  /** The public site was taken offline by the cancellation and is back online. */
  siteBackOnline: boolean;
  restoredTournamentIds: string[];
  /** Retained tournaments left archived because the plan's tournament limit is full. */
  stillRetainedTournaments: number;
  /** Cancellation intents closed ('restored'), so the webhook no longer reads them as live. */
  closedIntents: number;
};

type RetainedRow = {
  id: string;
  record_type: string;
  record_id: string | null;
  metadata: { previousStatus?: string } | null;
};

type RestoredStatus = 'draft' | 'active' | 'completed';

// The same rule as the downgrade restore (`restoredTournamentStatus`, lib/billing-retention.ts): an
// unknown previous status comes back `completed`. Two restores that disagree on it would bring
// the same tournament back differently depending on how it was taken away.
function restoredStatus(previous: string | undefined): RestoredStatus {
  return previous === 'draft' || previous === 'active' || previous === 'completed' ? previous : 'completed';
}

export async function restoreAfterReactivation(orgId: string, tournamentLimit: number): Promise<ReactivationResult> {
  const result: ReactivationResult = {
    unsuspended: false, siteBackOnline: false, restoredTournamentIds: [], stillRetainedTournaments: 0, closedIntents: 0,
  };

  // 1. The account: only an org a cancellation SUSPENDED is un-suspended and put back online — an
  //    owner who had switched their site off before cancelling is not overruled by a reactivation
  //    that never saw that choice (the suspension stamp is what proves the cancellation did it).
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('billing_suspended_at, is_public')
    .eq('id', orgId)
    .maybeSingle<{ billing_suspended_at: string | null; is_public: boolean | null }>();
  if (orgError) throw orgError;
  if (org?.billing_suspended_at) {
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ billing_suspended_at: null, billing_suspension_reason: null, is_public: true })
      .eq('id', orgId);
    if (error) throw error;
    result.unsuspended = true;
    result.siteBackOnline = org.is_public === false;
  }

  // 2. The retained records a cancellation filed.
  const { data: rows, error: rowsError } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, record_type, record_id, metadata')
    .eq('org_id', orgId)
    .in('retained_state', ['retained_inactive', 'pending_purge'])
    .in('metadata->>retentionReason', CANCELLATION_REASONS)
    .order('retained_at', { ascending: false });
  if (rowsError) throw rowsError;
  const retained = (rows ?? []) as RetainedRow[];

  const { count: liveCount, error: countError } = await supabaseAdmin
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .neq('status', 'archived');
  if (countError) throw countError;
  const freeSlots = tournamentLimit >= 9999 ? Number.POSITIVE_INFINITY : Math.max(0, tournamentLimit - (liveCount ?? 0));

  const closeRecords = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await supabaseAdmin.from('billing_retained_records').update({ retained_state: 'restored' }).in('id', ids);
    if (error) throw error;
  };

  await closeRecords(retained.filter(r => r.record_type === 'account').map(r => r.id));

  // Newest first, up to the free slots; the rest stay retained. A handful of writes whatever the
  // count — one per status the tournaments come back as, then one to close their records.
  const tournaments = retained.filter(r => r.record_type === 'tournament' && r.record_id);
  const toRestore = Number.isFinite(freeSlots) ? tournaments.slice(0, freeSlots) : tournaments;
  const byStatus = new Map<RestoredStatus, RetainedRow[]>();
  for (const row of toRestore) {
    const status = restoredStatus(row.metadata?.previousStatus);
    byStatus.set(status, [...(byStatus.get(status) ?? []), row]);
  }
  const restored: RetainedRow[] = [];
  for (const [status, group] of byStatus) {
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ status, is_active: status === 'active' })
      .eq('org_id', orgId)
      .in('id', group.map(r => r.record_id as string));
    if (!error) restored.push(...group);
  }
  const restoredIds = restored.map(r => r.record_id as string);
  try {
    await closeRecords(restored.map(r => r.id));
  } catch (closeError) {
    // As the downgrade restore does: a tournament whose record could not be closed goes back to
    // archived, so it is never live AND still listed as retained (the sweep would purge it). Then
    // FAIL, loudly: the caller reports it (the operator sees a warning; the webhook logs the error)
    // and the cancellation intents stay open, so the half-finished state is never recorded as done.
    // Nothing re-runs this on its own — the org is no longer 'canceled' — so the report is the fix.
    if (restoredIds.length > 0) {
      await supabaseAdmin.from('tournaments').update({ status: 'archived', is_active: false })
        .eq('org_id', orgId).in('id', restoredIds);
    }
    throw closeError;
  }
  result.restoredTournamentIds = restoredIds;
  result.stillRetainedTournaments = tournaments.length - restoredIds.length;

  // 3. The cancellation intents: closed, so the webhook's "already handled" check (which reads
  //    status = 'applied') is true only for a cancellation that is still in force.
  const { data: closed, error: intentError } = await supabaseAdmin
    .from('billing_retention_intents')
    .update({ status: 'restored' })
    .eq('org_id', orgId)
    .eq('intent_type', 'cancellation')
    .eq('status', 'applied')
    .select('id');
  if (intentError) throw intentError;
  result.closedIntents = closed?.length ?? 0;

  return result;
}
