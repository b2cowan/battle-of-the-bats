import { createClient } from './supabase-server';
import { isPlatformAdminEmail } from './platform-auth';
import { getUserAccessContexts, findInvitedMembershipSlug } from './user-contexts';

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

  const contexts = await getUserAccessContexts({
    id: user.id,
    email: user.email,
  });

  if (contexts.length === 0) {
    // A pending invitee (status='invited') has no *active* context yet. Send them to
    // finish accepting the invite rather than the zero-context org-creation front door.
    const invitedSlug = await findInvitedMembershipSlug(user.id);
    if (invitedSlug) return `/auth/accept-invite?org=${invitedSlug}`;

    // No workspace yet — send to the account-first front door, not straight into
    // org-creation (Phase 2: /start asks the user their job first).
    return '/start';
  }

  // Single-context users land on /home too, so the switcher (and "Start something
  // new") is reachable. This is only hit on a base-URL login: the login page honours
  // an explicit `next` BEFORE calling getAuthDestination, so deep links still go
  // straight to their target and skip /home.
  return '/home';
}
