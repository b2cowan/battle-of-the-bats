/**
 * The start door's server side (lib/start-door.ts holds the rules). Its writes go through the service role and send
 * ONLY the `start` key: the auth service merges top-level metadata keys (support's display-name edit relies on the
 * same), so a name changed between a read and a write here can never be put back to its old value.
 */
import { supabaseAdmin } from './supabase-admin';
import { getUserAccessContextsCached, filterWorkspaceContexts } from './user-contexts';
import { readStartDoor, type StartDoor, type StartStepViewer } from './start-door';

type AuthUserLike = { id: string; email?: string | null; user_metadata?: unknown };

/**
 * Forget the remembered door once the thing it came to start is made. Takes the account id and the doors that
 * creation fulfils, so any creation path can call it, and EVERY path that gives the account its own team or league
 * must: Home shows the door's waiting workspace beside every other workspace (A4 revised 2026-10-19), so a door left
 * behind is a "Not named yet" card sitting next to the real one. Only a matching door clears — a team never finishes
 * a waiting league, or the other way round (owner: it shows "if it truly is" still owed). Never fails the caller: a
 * failed clear is logged, and the card stays until a later creation of that kind clears it.
 */
export async function clearStartDoor(userId: string, fulfils: readonly StartDoor[]): Promise<void> {
  try {
    const { data, error: readError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (readError || !data?.user) return;
    const start = readStartDoor(data.user.user_metadata);
    if (!start || !fulfils.includes(start.door)) return;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { start: null } });
    if (error) console.error('[start-door] clear failed:', error);
  } catch (err) {
    console.error('[start-door] clear failed:', err);
  }
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
