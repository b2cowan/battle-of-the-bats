import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { invitationPurgeCutoff } from './invitation-lapse';
import { WAITING_ROLE_CLEARED } from './waiting-board-role';
import { readAccountKeepFacts } from './member-account-keep-server';
import { writeOrgAudit } from './org-audit';

/**
 * ⚖ THE RUN-OUT INVITATION SWEEP (Board Ready trust close-out 13, open call (b), owner ruling 2026-11-18, queue P2c).
 *
 * An invitation runs out 30 days after it was last sent (lib/invitation-lapse.ts) and stays on Members, run out, for a
 * further 30 so the club can still Resend it. Past that this sweep removes it, as the club's Cancel would, with one
 * difference: nobody pressed anything, so it is CAUTIOUS about the account.
 *
 *   - A board role waiting on a club's coach (P2b): the waiting role is cleared. The coach row is their coaching and is
 *     never deleted.
 *   - A pending row: the row is deleted (its tournament assignments and Rep Teams group scopes go with it, ON DELETE
 *     CASCADE, so nothing is half-removed). Each delete re-checks the row is still pending with the date that was read, so
 *     a Resend or an accept in between leaves it alone.
 *   - The account the invitation made for a new person: deleted ONLY when it was never confirmed AND never signed in to
 *     AND lib/member-account-keep.ts finds no other use (another club, a free coach team, a family link, an account its
 *     owner already had) AND it was created with this club's first invitation (an older one is its owner's own, never
 *     confirmed). All of it is read again just before the delete. Anything else is kept: a doubt, or a read that fails,
 *     never deletes an account.
 *
 * Each removal is a club audit line ("Invitation removed after it ran out"). Called by the nightly scheduled job
 * (POST /api/platform-admin/invitation-sweep-nightly) or by a person with `run_jobs`, by hand. Idempotent.
 */

/** Rows handled per run. A club rarely has more than a few; the next night takes any left over. */
const BATCH = 200;

/** How close the account's creation must sit to the club's first invitation for the invitation to have made it. */
const MADE_BY_INVITATION_WINDOW_MS = 5 * 60 * 1000;

/**
 * Did THIS club's invitation make the account (/review)? The invite route creates a new person's account and then writes
 * its `member_invited` audit line, seconds apart. An account older than the club's first invitation by more than the
 * window was made by its owner (a sign-up they never confirmed), and the keep rule's own-account test cannot see that
 * (an invitation to it stamps the auth invited_at too). No audit line, or no date, is a doubt, and a doubt keeps.
 */
async function madeByThisInvitation(orgId: string, userId: string, accountCreatedAt: string | undefined): Promise<boolean> {
  if (!accountCreatedAt) return false;
  const { data, error } = await supabaseAdmin
    .from('org_audit_log')
    .select('created_at')
    .eq('org_id', orgId)
    .eq('target_id', userId)
    .eq('action', 'member_invited')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  if (error || !data) return false;
  return Date.parse(accountCreatedAt) >= Date.parse(data.created_at) - MADE_BY_INVITATION_WINDOW_MS;
}

export interface InvitationSweepReport {
  cutoff: string;
  waitingRolesCleared: number;
  invitationsRemoved: number;
  accountsDeleted: number;
  /** Rows a Resend or an answer reached between the read and the write: left alone. */
  skipped: number;
  failed: number;
}

export async function sweepRunOutInvitations(now: Date = new Date()): Promise<InvitationSweepReport> {
  const cutoff = invitationPurgeCutoff(now);
  const report: InvitationSweepReport = { cutoff, waitingRolesCleared: 0, invitationsRemoved: 0, accountsDeleted: 0, skipped: 0, failed: 0 };

  // 1. Board roles waiting on a coach's row: clear the offer, keep the coaching.
  const { data: waiting, error: waitingError } = await supabaseAdmin
    .from('organization_members')
    .select('id, organization_id, user_id, pending_role, pending_invited_at')
    .eq('role', 'coach')
    .eq('status', 'active')
    .not('pending_role', 'is', null)
    .lt('pending_invited_at', cutoff)
    .limit(BATCH);
  if (waitingError) throw waitingError;
  for (const row of waiting ?? []) {
    const { data: cleared, error } = await supabaseAdmin
      .from('organization_members')
      .update(WAITING_ROLE_CLEARED)
      .eq('id', row.id)
      .eq('role', 'coach')
      .eq('pending_role', row.pending_role)
      .eq('pending_invited_at', row.pending_invited_at)
      .select('id');
    if (error) { report.failed++; continue; }
    if (!cleared?.length) { report.skipped++; continue; }
    report.waitingRolesCleared++;
    await writeOrgAudit(row.organization_id, null, row.user_id, 'member_removed', {
      role: row.pending_role, pendingInvite: true, lapsed: true, keptCoaching: true, membershipOnly: true,
    });
  }

  // 2. Pending rows: delete the row, then decide the account.
  const { data: pending, error: pendingError } = await supabaseAdmin
    .from('organization_members')
    .select('id, organization_id, user_id, role, invited_at')
    .eq('status', 'invited')
    .lt('invited_at', cutoff)
    .limit(BATCH);
  if (pendingError) throw pendingError;
  for (const row of pending ?? []) {
    try {
      // Read BEFORE the row goes, as the club's Cancel does: the shared keep rule (lib/member-account-keep.ts) reads this
      // club's row for "an invitation to an account its owner already had". A read that fails keeps the account.
      const keep = await readAccountKeepFacts(row.user_id, row.organization_id).catch(() => null);
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      const { data: removed, error } = await supabaseAdmin
        .from('organization_members')
        .delete()
        .eq('id', row.id)
        .eq('status', 'invited')
        .eq('invited_at', row.invited_at)
        .select('id');
      if (error) { report.failed++; continue; }
      if (!removed?.length) { report.skipped++; continue; }
      report.invitationsRemoved++;

      // The account goes only when the keep rule finds no use for it, nobody ever confirmed or signed in to it, and THIS
      // club's invitation made it. Everything is read again just before the delete (/review): another club may have invited
      // the same person, or they may have confirmed, in between.
      let accountDeleted = false;
      if (keep && keep.reason === null) {
        const [{ data: { user: fresh } }, again] = await Promise.all([
          supabaseAdmin.auth.admin.getUserById(row.user_id),
          readAccountKeepFacts(row.user_id, row.organization_id).catch(() => null),
        ]);
        const neverUsed = !!fresh && !fresh.email_confirmed_at && !fresh.last_sign_in_at;
        if (neverUsed && again && again.reason === null && await madeByThisInvitation(row.organization_id, row.user_id, fresh.created_at)) {
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(row.user_id);
          if (deleteError) console.error('[invitation-sweep] account not deleted (kept):', deleteError.message);
          else { accountDeleted = true; report.accountsDeleted++; }
        }
      }

      await writeOrgAudit(row.organization_id, null, row.user_id, 'member_removed', {
        email: authUser?.email ?? null, role: row.role, pendingInvite: true, lapsed: true, membershipOnly: !accountDeleted,
      });
    } catch (e) {
      console.error('[invitation-sweep] row failed:', e instanceof Error ? e.message : String(e));
      report.failed++;
    }
  }

  return report;
}
