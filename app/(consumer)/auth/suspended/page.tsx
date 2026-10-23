import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { CHAT_PAUSED } from '@/lib/chat-pause';
import { findSuspendedMembershipOrg, getUserAccessContexts } from '@/lib/user-contexts';
import SignOutButton from './SignOutButton';
import SystemScreen from '@/components/shared/SystemScreen';

export const dynamic = 'force-dynamic';

/**
 * Suspended-account explanation page (J10-019). A suspended member authenticates fine but resolves
 * to zero ACTIVE contexts, so the destination resolver routes them here instead of looping them
 * through login forever (or dumping them into org-creation). Shows the org name, what to do, and a
 * sign-out.
 *
 * ⚠ SIGN-OUT IS NOT THE ONLY ACTION, and the copy must not claim it is (R10, top-nav audit D10,
 * 2026-08-01). This page mounts the full signed-in consumer nav, and Scores, Chat and Account all
 * genuinely work — what is suspended is access to ONE WORKSPACE, not the account. The page used to
 * read as a hard lockout while offering a live four-tab app underneath it: a copy-vs-chrome
 * contradiction, not a broken door. Ruled: the copy tells the truth and the chrome stays as it is
 * (hiding doors that work would be the worse fix). If this page ever stops mounting that nav, this
 * wording has to change back.
 *
 * Server component: resolves the org server-side (no flash). Guards both ways — an unauthenticated
 * visitor goes to login; a user who actually HAS active access (reached this URL by accident) goes
 * to their workspace.
 */
export default async function SuspendedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/auth/login');

  // If the user has any active workspace, they're not locked out — don't show a suspended wall.
  // Home (/discover) carries the workspaces list now, so land them there.
  const contexts = await getUserAccessContexts({ id: user.id, email: user.email });
  if (contexts.length > 0) redirect('/discover');

  const suspended = await findSuspendedMembershipOrg(user.id);
  // No suspended membership either → nothing to explain here; route to the normal front door.
  if (!suspended) redirect('/start');

  const orgName = suspended.name?.trim() || '';

  return (
    <SystemScreen
      surface="inline"
      icon="pause"
      title={orgName ? `Your access to ${orgName} is paused` : 'Your access is paused'}
      notes={[
        `Your FieldLogicHQ account still works. You can browse scores${CHAT_PAUSED ? ' and' : ', use chat and'} manage your account.`,
      ]}
      actions={<SignOutButton />}
      afterActions={`Signed in as ${user.email}`}
    >
      {orgName ? `You can’t open ${orgName} right now.` : 'You can’t open your organization right now.'} Ask an administrator there to restore your access.
    </SystemScreen>
  );
}
