import { createClient } from './supabase-server';
import { isPlatformAdminEmail } from './platform-auth';
import { getUserAccessContexts, findSuspendedMembershipOrg } from './user-contexts';
import { reconcilePendingInvitesForUser, listPendingInvitesForUser } from './invite-reconciliation';

export type { MemberRow, OrgRelation } from './user-contexts';
export { getDestinationForMembership } from './user-contexts';

export async function getAuthDestination() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return '/auth/login';
  }

  if (await isPlatformAdminEmail(user.email)) {
    return '/platform-admin';
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
    // it before the invite/`/start` fall-throughs and route to a static explanation page — otherwise
    // they bounce login → null → login forever with no "you're suspended" signal.
    const suspended = await findSuspendedMembershipOrg(user.id);
    if (suspended) return '/auth/suspended';

    // A pending invitee (status='invited') has no *active* context yet. If they have any
    // pending invite, land them on /home where the PendingInvitationsCard lets them
    // Accept/Decline in place (replaces the old bounce into the bare accept-invite form).
    const pending = await listPendingInvitesForUser(user.id);
    if (pending.length > 0) return '/home';

    // No workspace yet and nothing pending — this is most often a fan account (e.g.
    // the follow-a-team account offer), not someone mid-setup for an organization.
    // Land them where a signed-out visitor already goes: Discover, no wall. /start
    // (the organizer chooser) stays one tap away from the nav for anyone who does
    // want to set up an org (2026-07-18 — was /start, which trapped fan accounts in
    // a chooser meant for organizers, with no way back to just browsing).
    return '/discover';
  }

  // Single-context users land on /home too, so the switcher (and "Start something
  // new") is reachable. This is only hit on a base-URL login: the login page honours
  // an explicit `next` BEFORE calling getAuthDestination, so deep links still go
  // straight to their target and skip /home.
  return '/home';
}
