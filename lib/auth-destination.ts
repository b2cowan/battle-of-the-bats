import { createClient } from './supabase-server';
import { isPlatformAdminEmail } from './platform-auth';
import { getUserAccessContexts, findSuspendedMembershipOrg } from './user-contexts';
import { reconcilePendingInvitesForUser, listPendingInvitesForUser } from './invite-reconciliation';

export type { MemberRow, OrgRelation } from './user-contexts';
export { getDestinationForMembership } from './user-contexts';

export interface AuthDestinationDetail {
  /** Where to send the user after auth resolves. */
  destination: string;
  /**
   * True when the user has REAL workspace access (≥1 non-fan context) or is a
   * platform admin — the signal that an explicit post-login `next` is safe to honour
   * (they can actually reach a deep-linked authed page). Fan / zero-context / suspended
   * users get false so an unreachable `next` never traps them in a login loop.
   *
   * Before the Unified Home redesign this was inferred from the destination being
   * exactly `/home`; the fast-path now returns concrete workspace URLs, so the signal
   * must be explicit.
   */
  hasWorkspace: boolean;
}

/**
 * Resolve the post-auth destination AND whether the user holds workspace access.
 * Callers that only need the string use {@link getAuthDestination}.
 *
 * Fast-path (Unified Home, Phase 0): a solo-workspace user with no pending invite
 * lands STRAIGHT in their workspace at sign-in — the behaviour the retired /home
 * launchpad used to provide via its single-context auto-redirect. Everyone else with
 * contexts (multiple workspaces, a fan follow alongside a workspace, or a pending
 * invite to act on) lands on Home (/discover), which now carries the workspaces list,
 * the pending-invitations card, and the following feed.
 */
export async function getAuthDestinationDetail(): Promise<AuthDestinationDetail> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return { destination: '/auth/login', hasWorkspace: false };
  }

  if (await isPlatformAdminEmail(user.email)) {
    return { destination: '/platform-admin', hasWorkspace: true };
  }

  // Reconcile any pending invites addressed to this email onto the authenticated
  // identity FIRST, so an invitee who self-registered/logged in (instead of clicking
  // the email link) has their orphaned invite re-pointed before we resolve contexts
  // and the invited-membership fallback below (mig 128).
  await reconcilePendingInvitesForUser({ id: user.id, email: user.email, emailConfirmedAt: user.email_confirmed_at });

  const contexts = await getUserAccessContexts({
    id: user.id,
    email: user.email,
  });

  if (contexts.length === 0) {
    // J10-019: a SUSPENDED member authenticates fine but resolves to zero active contexts. Detect
    // it before the invite fall-throughs and route to a static explanation page — otherwise they
    // bounce login → null → login forever with no "you're suspended" signal.
    const suspended = await findSuspendedMembershipOrg(user.id);
    if (suspended) return { destination: '/auth/suspended', hasWorkspace: false };

    // Pending invitee (status='invited') or fan account: both land on Home. Home renders the
    // PendingInvitationsCard for the former (Accept/Decline in place) and the browse funnel for
    // the latter — no wall either way. hasWorkspace stays false so an unreachable authed `next`
    // never traps them.
    return { destination: '/discover', hasWorkspace: false };
  }

  // ── Has ≥1 context ──────────────────────────────────────────────────────────
  const workspaceContexts = contexts.filter(c => c.kind !== 'fan');
  const hasWorkspace = workspaceContexts.length > 0;

  // Fast-path: exactly ONE workspace context, nothing else, and no pending invite to act on →
  // drop straight into that workspace (a chooser with a single choice is friction). A pending
  // invite, a second workspace, or a fan follow alongside all fall through to Home, where those
  // extra relationships are visible. Guard on a non-empty destination — never redirect('').
  // The invite lookup only runs once the cheap in-memory conditions already hold (a multi-workspace
  // login can never satisfy the fast-path, so it must not pay for the invite query).
  if (contexts.length === 1 && hasWorkspace && contexts[0].destination) {
    const pending = await listPendingInvitesForUser(user.id);
    if (pending.length === 0) {
      return { destination: contexts[0].destination, hasWorkspace: true };
    }
  }

  return { destination: '/discover', hasWorkspace };
}

/** Post-auth destination string. See {@link getAuthDestinationDetail} for the fast-path rules. */
export async function getAuthDestination(): Promise<string> {
  return (await getAuthDestinationDetail()).destination;
}
