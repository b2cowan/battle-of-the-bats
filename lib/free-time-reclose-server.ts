import 'server-only';

/**
 * The database half of lib/free-time-reclose.ts (free time on an ended club, owner ruling 2026-11-18). The rules live
 * there; this file only reads and writes, through the code paths that already exist: the restore an operator's plan
 * change runs, and THE ending (`applyEnding` with the real `endingDeps`). It writes no second cancellation.
 */
import { supabaseAdmin } from './supabase-admin';
import { effectiveOrgFactsForId } from './entitlement-grants';
import { restoreAfterReactivation } from './billing-reactivation';
import { CANCELLATION_REASONS } from './billing-cancellation-policy';
import { applyEnding } from './plan-ending';
import { endingDeps, readEndingAccount } from './plan-ending-server';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { REOPENED_ENDED_CLUB } from './free-time';
import {
  CLOSE_AGAIN_FAILED_WARNING, FREE_TIME_ENDED_REASON, closeAgainExpiredFreeTime, closeAgainIfFreeTimeOver, reopenOnGive,
  type CloseAgainResult, type GrantFacts, type ReopenActor, type ReopenDeps,
} from './free-time-reclose';

export const reopenDeps: ReopenDeps = {
  now: () => new Date(),

  async readFacts(orgId) {
    const [{ data: org, error }, { data: grants, error: grantsError }, door] = await Promise.all([
      supabaseAdmin.from('organizations').select('subscription_status, billing_suspended_at, account_kind, plan_id').eq('id', orgId)
        .maybeSingle<{ subscription_status: string | null; billing_suspended_at: string | null; account_kind: string | null; plan_id: string | null }>(),
      supabaseAdmin.from('org_overrides').select('type, target, starts_at, expires_at, revoked_at').eq('org_id', orgId).eq('type', 'subscription_status'),
      effectiveOrgFactsForId(orgId),
    ]);
    if (error) throw error;
    if (grantsError) throw grantsError;
    if (!org) return null;
    return {
      storedStatus: org.subscription_status,
      suspended: !!org.billing_suspended_at,
      isCoachesPortal: isTeamWorkspaceOrg({ accountKind: org.account_kind, planId: org.plan_id }),
      doorStatus: door?.subscriptionStatus ?? null,
      grants: (grants ?? []) as GrantFacts[],
    };
  },

  async restore(orgId) {
    // The plan's own tournament limit (billing-status free time leaves the plan as it is).
    const facts = await effectiveOrgFactsForId(orgId);
    await restoreAfterReactivation(orgId, facts?.tournamentLimit ?? 1);
  },

  async endAgain(orgId, actor) {
    const account = await readEndingAccount(orgId);
    if (!account) throw new Error('The club could not be read.');
    const ended = await applyEnding(account, {
      actor,
      reason: FREE_TIME_ENDED_REASON,
      notifyOwner: true, // owner ruling 2026-11-18: the date they were told the first time is no longer true
      origin: 'request',
      freeTimeEnded: true,
      note: 'Free time ended and the club had not paid',
    }, endingDeps);
    return { applied: ended.applied, retentionUntil: ended.retentionUntil };
  },

  async extendKept(orgId, retentionUntil) {
    // Only the cancellation's own records, and only ever LATER: the fresh 90 days never shortens a window.
    const { data, error } = await supabaseAdmin
      .from('billing_retained_records')
      .update({ retention_until: retentionUntil, retained_state: 'retained_inactive', warning_sent_at: null, pending_purge_at: null, purge_notice_sent_at: null })
      .eq('org_id', orgId)
      .in('retained_state', ['retained_inactive', 'pending_purge'])
      .in('metadata->>retentionReason', CANCELLATION_REASONS)
      .lt('retention_until', retentionUntil)
      .select('id');
    if (error) throw error;
    return data?.length ?? 0;
  },

  async candidates(now) {
    const { data, error } = await supabaseAdmin
      .from('org_overrides')
      .select('org_id, expires_at, revoked_at, organizations!inner(subscription_status, billing_suspended_at)')
      .eq('type', 'subscription_status')
      .eq(`target->>${REOPENED_ENDED_CLUB}`, 'true')
      .eq('organizations.subscription_status', 'canceled')
      .is('organizations.billing_suspended_at', null);
    if (error) throw error;
    const over = ((data ?? []) as Array<{ org_id: string; expires_at: string | null; revoked_at: string | null }>)
      .filter(r => r.revoked_at || (r.expires_at && new Date(r.expires_at) <= now));
    return [...new Set(over.map(r => r.org_id))];
  },
};

/** On give: reopen an ended club. Null, or the warning staff see. */
export function reopenEndedClub(orgId: string): Promise<string | null> {
  return reopenOnGive(orgId, reopenDeps);
}

/** After free time was ended by staff: close the club again if it still has not paid. Null, or the warning staff see. */
export async function closeAgainAfterEnd(orgId: string, actorEmail: string): Promise<string | null> {
  const actor: ReopenActor = { door: 'operator', userId: null, email: actorEmail };
  try {
    await closeAgainIfFreeTimeOver(orgId, actor, reopenDeps);
    return null;
  } catch (error) {
    console.error('[free-time] closing an ended club again failed:', error);
    return CLOSE_AGAIN_FAILED_WARNING;
  }
}

/** The daily job's step (app/api/platform-admin/stripe-fees-daily). */
export function closeAgainEndedFreeTime(): Promise<{ checked: number; closed: number }> {
  return closeAgainExpiredFreeTime(reopenDeps);
}

export type { CloseAgainResult };
