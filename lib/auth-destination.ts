import { createClient } from './supabase-server';
import { isPlatformAdminEmail } from './platform-auth';
import { getUserAccessContexts } from './user-contexts';

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
    return '/auth/signup';
  }

  if (contexts.length === 1) {
    return contexts[0].destination;
  }

  return '/home';
}
