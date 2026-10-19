/**
 * The start door's server side (lib/start-door.ts holds the rules). Its writes go through the service role and send
 * ONLY the `start` key: the auth service merges top-level metadata keys (support's display-name edit relies on the
 * same), so a name changed between a read and a write here can never be put back to its old value.
 */
import { supabaseAdmin } from './supabase-admin';
import { getUserAccessContextsCached, filterWorkspaceContexts } from './user-contexts';
import { readStartDoor, withNotNow, type StartStepViewer } from './start-door';

type AuthUserLike = { id: string; email?: string | null; user_metadata?: unknown };

/**
 * Forget the remembered door once a creation completes. Takes the account id alone, so any creation path can call
 * it. Never fails the caller: a door left behind only shows a card, and Home hides that once there is a workspace.
 */
export async function clearStartDoor(userId: string): Promise<void> {
  try {
    const { data, error: readError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (readError || !data?.user || !readStartDoor(data.user.user_metadata)) return;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { start: null } });
    if (error) console.error('[start-door] clear failed:', error);
  } catch (err) {
    console.error('[start-door] clear failed:', err);
  }
}

/** Home's "Not now" (A4): count it on the account, so the second one holds on every device. */
export async function recordStartDoorNotNow(user: AuthUserLike): Promise<void> {
  const start = readStartDoor(user.user_metadata);
  if (!start) return;
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { start: withNotNow(start, new Date()) },
  });
  if (error) console.error('[start-door] not-now failed:', error);
}

/**
 * Who is on a door's create step, for the start pages: signed out is null; signed in carries whether this is a
 * first day (no workspace yet — the same definition Home's Workspaces list uses), which shows the two steps and
 * offers Home as the way out.
 */
export async function startStepViewer(user: AuthUserLike | null): Promise<StartStepViewer | null> {
  if (!user?.email) return null;
  const workspaces = filterWorkspaceContexts(await getUserAccessContextsCached(user.id, user.email));
  return { email: user.email, firstRun: workspaces.length === 0 };
}
