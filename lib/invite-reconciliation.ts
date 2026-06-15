import { supabaseAdmin } from './supabase-admin';

/**
 * Invite reconciliation (mig 128).
 *
 * Invites are created via `generateLink({ type: 'invite' })`, which mints a Supabase
 * auth user and stores its id as `organization_members.user_id` on a `status='invited'`
 * row. Every pending-invite lookup keys on `user_id`. If the invitee ignores the email
 * link and instead self-registers or logs in, they authenticate under a DIFFERENT auth
 * identity, so nothing connects them to their pending invite — a dead-end.
 *
 * `reconcilePendingInvitesForUser` heals this: given the *authenticated* user's id +
 * email, it finds pending rows whose `invited_email` matches their email and re-points
 * `user_id` to the live user. After this runs, the existing `user_id`-keyed paths
 * (findInvitedMembershipSlug, accept-invite) see the invite normally.
 *
 * SECURITY: callers MUST pass the email/id of the *authenticated session user* (from
 * `supabase.auth.getUser()`), never a client-supplied value. Matching on an arbitrary
 * email would let a user claim someone else's invite. There is no email parameter that
 * crosses a trust boundary into this module.
 *
 * IDEMPOTENT: safe to call on every login. Rows already pointing at the live user, or
 * where the live user already has a membership in that org, are skipped.
 */

export type ReconciledInvite = {
  memberId: string;
  organizationId: string;
  orgSlug: string | null;
  orgName: string | null;
  role: string;
};

type OrgRel = { slug?: string | null; name?: string | null };
type OrgRelation = OrgRel | OrgRel[] | null;

function orgFromRelation(rel: OrgRelation): OrgRel | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Re-point pending invites addressed to `email` onto the authenticated `userId`.
 * Returns the invites that now belong to this user (newly reconciled + any that were
 * already correctly pointed at them). Never throws on a per-row conflict — it skips and
 * continues so one bad row can't block login.
 */
export async function reconcilePendingInvitesForUser(user: {
  id: string;
  email: string | null | undefined;
  emailConfirmedAt?: string | null;
}): Promise<ReconciledInvite[]> {
  const email = normalizeEmail(user.email);
  if (!email) return [];

  // SECURITY (defense-in-depth): only a verified-email identity may claim an invite.
  // Normal Supabase config already blocks sign-in before confirmation, but this path
  // re-points org membership, so we never reconcile for an unconfirmed email even if a
  // session somehow exists. Callers pass user.email_confirmed_at from getUser().
  if (user.emailConfirmedAt === null || user.emailConfirmedAt === undefined) return [];

  // All pending invites addressed to this email, regardless of which auth identity the
  // invite originally minted. Exact match on the already-lowercased email (writers store
  // lowercased) — uses the lower(invited_email) partial index (mig 128). NOTE: `.eq`,
  // not `.ilike` — ILIKE would treat `_`/`%` in an email as wildcards (a wrong-invite
  // claim risk) and would not use the functional index.
  const { data: pending, error: pendingError } = await supabaseAdmin
    .from('organization_members')
    .select('id, organization_id, user_id, role, organizations(slug, name)')
    .eq('status', 'invited')
    .eq('invited_email', email);

  // On a transient query error, return empty so login isn't blocked — but the caller's
  // user_id-keyed fallback (findInvitedMembershipSlug) still runs, so an already-correctly
  // pointed invite is not lost. (A genuinely orphaned invite simply isn't reconciled this
  // attempt; the next login retries.)
  if (pendingError || !pending || pending.length === 0) return [];

  const reconciled: ReconciledInvite[] = [];

  for (const row of pending) {
    const org = orgFromRelation(row.organizations as OrgRelation);
    const base: ReconciledInvite = {
      memberId: row.id,
      organizationId: row.organization_id,
      orgSlug: org?.slug ?? null,
      orgName: org?.name ?? null,
      role: row.role,
    };

    // Already pointed at the live user — nothing to do, but it IS their invite.
    if (row.user_id === user.id) {
      reconciled.push(base);
      continue;
    }

    // Guard the (organization_id, user_id) UNIQUE: if the live user already has a row in
    // this org, re-pointing would collide. Skip — they already have access (or another
    // pending row that will reconcile on its own). Don't touch it.
    const { data: existing } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', row.organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) continue;

    // Re-point the pending row onto the authenticated identity. We intentionally do NOT
    // delete the orphaned invite-only auth user here: auth.users cascades to
    // organization_members, and the safe ordering (re-point, then delete) adds risk for
    // little gain. Orphan cleanup is a separate maintenance concern.
    const { data: updated, error } = await supabaseAdmin
      .from('organization_members')
      .update({ user_id: user.id })
      .eq('id', row.id)
      .eq('status', 'invited') // re-check status to avoid racing a concurrent accept
      .select('id');

    // Skip on conflict/race; never block the login flow. A zero-row update (the invite
    // was accepted between our select and update) is NOT an error in PostgREST, so only
    // push when a row was actually re-pointed.
    if (error || !updated || updated.length === 0) continue;

    reconciled.push(base);
  }

  return reconciled;
}

/**
 * List pending invites for the authenticated user (post-reconciliation), keyed on
 * `user_id`. Used by the post-login pending-invite UI (Phase 2). Read-only.
 */
export async function listPendingInvitesForUser(userId: string): Promise<ReconciledInvite[]> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('id, organization_id, role, organizations(slug, name)')
    .eq('user_id', userId)
    .eq('status', 'invited');

  return (data ?? []).map((row) => {
    const org = orgFromRelation(row.organizations as OrgRelation);
    return {
      memberId: row.id,
      organizationId: row.organization_id,
      orgSlug: org?.slug ?? null,
      orgName: org?.name ?? null,
      role: row.role,
    };
  });
}
