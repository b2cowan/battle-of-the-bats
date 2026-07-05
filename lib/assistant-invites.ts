import { supabaseAdmin } from './supabase-admin';
import { generateAssistantInviteToken, hashAssistantInviteToken } from './assistant-invite-token';
import { addRepTeamCoach, updateRepTeamCoachCapabilities } from './db';
import { sanitizeAssistantGrants, type AssistantCapabilityGrants } from './coach-capabilities';

// ── Org-level coach settings (organizations.coach_settings jsonb, mig 174) ────
export interface OrgCoachSettings {
  require_assistant_approval?: boolean;
}

export async function getOrgCoachSettings(orgId: string): Promise<OrgCoachSettings> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('coach_settings')
    .eq('id', orgId)
    .maybeSingle<{ coach_settings: OrgCoachSettings | null }>();
  return data?.coach_settings ?? {};
}

export async function orgRequiresAssistantApproval(orgId: string): Promise<boolean> {
  return (await getOrgCoachSettings(orgId)).require_assistant_approval === true;
}

// ── Invites ───────────────────────────────────────────────────────────────
interface AssistantInviteRow {
  id: string;
  org_id: string;
  team_id: string;
  program_year_id: string;
  invited_by_user_id: string;
  invited_email: string;
  status: 'pending_approval' | 'pending' | 'accepted' | 'expired' | 'revoked';
  initial_capabilities: AssistantCapabilityGrants | null;
  invited_by_name: string | null;
  team_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface CreateAssistantInviteInput {
  orgId: string;
  teamId: string;
  programYearId: string;
  invitedByUserId: string;
  invitedByName: string | null;
  invitedEmail: string;
  teamName: string | null;
  initialCapabilities?: AssistantCapabilityGrants | null;
  requireApproval: boolean;
}

/** Mint an invite. When approval is NOT required we return the raw token so the caller can email it.
 *  When approval IS required we store the row as `pending_approval` with a placeholder hash and return
 *  no token — a fresh token is minted at approval time (so the raw token never lives anywhere early). */
export async function createAssistantInvite(
  input: CreateAssistantInviteInput,
): Promise<{ inviteId: string; rawToken: string | null; status: 'pending' | 'pending_approval' }> {
  const status: 'pending' | 'pending_approval' = input.requireApproval ? 'pending_approval' : 'pending';
  const rawToken = input.requireApproval ? null : generateAssistantInviteToken();
  // pending_approval rows still need a unique non-null token_hash (schema NOT NULL); use a throwaway
  // that is never emailed and gets replaced with a real one at approval.
  const tokenHash = rawToken
    ? hashAssistantInviteToken(rawToken)
    : hashAssistantInviteToken(generateAssistantInviteToken());

  // Supersede any earlier outstanding invite for the same person on the same team (avoids a pile of
  // live links if the head coach re-sends). The newest invite is the only valid one.
  await supabaseAdmin
    .from('assistant_invite_tokens')
    .update({ status: 'revoked' })
    .eq('team_id', input.teamId)
    .eq('invited_email', input.invitedEmail.trim().toLowerCase())
    .in('status', ['pending', 'pending_approval']);

  const { data, error } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .insert({
      org_id: input.orgId,
      team_id: input.teamId,
      program_year_id: input.programYearId,
      invited_by_user_id: input.invitedByUserId,
      invited_email: input.invitedEmail.trim().toLowerCase(),
      token_hash: tokenHash,
      status,
      initial_capabilities: input.initialCapabilities ?? null,
      invited_by_name: input.invitedByName,
      team_name: input.teamName,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { inviteId: data.id as string, rawToken, status };
}

/** Approve a pending_approval invite: mint a fresh token, flip to pending, return the raw token to email. */
export async function approveAssistantInvite(
  inviteId: string,
): Promise<{ rawToken: string; invite: AssistantInviteRow } | null> {
  const { data: row } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle<AssistantInviteRow>();
  if (!row || row.status !== 'pending_approval') return null;

  const rawToken = generateAssistantInviteToken();
  const { data: updated, error } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .update({ token_hash: hashAssistantInviteToken(rawToken), status: 'pending' })
    .eq('id', inviteId)
    .eq('status', 'pending_approval') // race-safe
    .select('*')
    .maybeSingle<AssistantInviteRow>();
  if (error || !updated) return null;
  return { rawToken, invite: updated };
}

export async function revokeAssistantInvite(inviteId: string): Promise<void> {
  await supabaseAdmin
    .from('assistant_invite_tokens')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .in('status', ['pending', 'pending_approval']);
}

/** Outstanding (not-yet-accepted) invites for a team, for the head coach's manage panel + admin view. */
export async function listOpenAssistantInvitesForTeam(
  teamId: string,
): Promise<{ id: string; invitedEmail: string; status: string; expiresAt: string; createdAt: string }[]> {
  const { data } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('id, invited_email, status, expires_at, created_at')
    .eq('team_id', teamId)
    .in('status', ['pending', 'pending_approval'])
    .order('created_at', { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id, invitedEmail: r.invited_email, status: r.status, expiresAt: r.expires_at, createdAt: r.created_at,
  }));
}

/** Outstanding invites across a whole org (admin oversight), joined to team name + group for scoping. */
export async function listOpenAssistantInvitesForOrg(
  orgId: string,
): Promise<{ id: string; teamId: string; teamName: string | null; teamGroupId: string | null; invitedEmail: string; status: string; expiresAt: string; createdAt: string }[]> {
  const { data } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('id, team_id, invited_email, status, expires_at, created_at, rep_teams!team_id ( name, group_id )')
    .eq('org_id', orgId)
    .in('status', ['pending', 'pending_approval'])
    .order('created_at', { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id, teamId: r.team_id, teamName: r.rep_teams?.name ?? null, teamGroupId: r.rep_teams?.group_id ?? null,
    invitedEmail: r.invited_email, status: r.status, expiresAt: r.expires_at, createdAt: r.created_at,
  }));
}

/** Fetch one invite by id (admin verification before approve/decline). */
export async function getAssistantInviteById(
  inviteId: string,
): Promise<{ id: string; orgId: string; teamId: string; invitedEmail: string; status: string } | null> {
  const { data } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('id, org_id, team_id, invited_email, status')
    .eq('id', inviteId)
    .maybeSingle<{ id: string; org_id: string; team_id: string; invited_email: string; status: string }>();
  if (!data) return null;
  return { id: data.id, orgId: data.org_id, teamId: data.team_id, invitedEmail: data.invited_email, status: data.status };
}

/** Read the invite behind a raw token (for the accept page prefill). Returns null when missing. */
export async function getAssistantInviteByToken(rawToken: string): Promise<{
  status: string; teamName: string | null; orgName: string | null; invitedByName: string | null;
  invitedEmail: string; expired: boolean;
} | null> {
  const { data: row } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('*')
    .eq('token_hash', hashAssistantInviteToken(rawToken))
    .maybeSingle<AssistantInviteRow>();
  // pending_approval rows carry a throwaway hash (raw never emailed) — never surface them by token.
  if (!row || row.status === 'pending_approval') return null;
  const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', row.org_id).maybeSingle<{ name: string }>();
  const isPending = row.status === 'pending' && new Date(row.expires_at).getTime() >= Date.now();
  return {
    status: row.status,
    teamName: row.team_name,
    orgName: org?.name ?? null,
    invitedByName: row.invited_by_name,
    // Only expose the invited email while the invite is live (it prefills the signup form); a
    // terminal (accepted/revoked/expired) invite must not leak the invitee's email as PII.
    invitedEmail: isPending ? row.invited_email : '',
    expired: new Date(row.expires_at).getTime() < Date.now(),
  };
}

/** Claim an invite for a signed-in user: create the minimal guest membership + assistant-coach row.
 *  DELIBERATELY does NOT call the one-org guard — an assistant is a team guest (cross-club OK). */
export async function acceptAssistantInvite(
  rawToken: string,
  userId: string,
  userEmail: string,
): Promise<{ ok: true; orgSlug: string; teamId: string } | { ok: false; error: string; status: number }> {
  const tokenHash = hashAssistantInviteToken(rawToken);
  const { data: row } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle<AssistantInviteRow>();

  if (!row) return { ok: false, error: 'This invite link is not valid.', status: 404 };
  if (row.status === 'accepted') return { ok: false, error: 'This invite has already been used.', status: 409 };
  if (row.status !== 'pending') return { ok: false, error: 'This invite is no longer available.', status: 409 };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('assistant_invite_tokens').update({ status: 'expired' }).eq('id', row.id);
    return { ok: false, error: 'This invite has expired. Ask the head coach to send a new one.', status: 410 };
  }

  // The invite is addressed to a specific email — only that person may accept it. Possession of the
  // (unguessable) link is NOT sufficient: a forwarded/leaked link must never let a different signed-in
  // user join the team as staff. Checked BEFORE claiming the token so a wrong-email attempt can't burn
  // the single-use invite. `invited_email` is stored lowercased; mirrors the member-invite posture.
  if (userEmail.trim().toLowerCase() !== row.invited_email) {
    return {
      ok: false,
      error: `This invite was sent to ${row.invited_email}. Please sign in with that email address to accept it.`,
      status: 403,
    };
  }

  const org = await supabaseAdmin.from('organizations').select('slug').eq('id', row.org_id).maybeSingle<{ slug: string }>();
  if (!org.data) return { ok: false, error: 'Organization not found.', status: 404 };

  // CLAIM THE TOKEN FIRST — atomic single-use. Only the request that flips pending→accepted proceeds
  // with the side-effects, so a double-submit / concurrent accept can't double-apply.
  const { data: claimed } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle<{ id: string }>();
  if (!claimed) return { ok: false, error: 'This invite has already been used.', status: 409 };

  // 1) Minimal org membership (role='coach', capability-less) — only if not already a member.
  //    NEVER touch a non-coach membership (don't activate someone's dormant admin/member invite).
  const { data: existingMember } = await supabaseAdmin
    .from('organization_members')
    .select('id, status, role')
    .eq('organization_id', row.org_id)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; status: string; role: string }>();
  if (!existingMember) {
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from('organization_members').insert({
      organization_id: row.org_id,
      user_id: userId,
      role: 'coach',
      status: 'active',
      invited_at: nowIso,
      accepted_at: nowIso,
    });
  } else if (existingMember.role === 'coach' && existingMember.status === 'invited') {
    await supabaseAdmin.from('organization_members')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', existingMember.id);
  }
  // (any other existing membership — a real role, or an active one — is left entirely as-is.)

  // 2) rep_team_coaches assistant row (dedupe on the UNIQUE(program_year_id, user_id); a head coach
  //    who accepts is already present, so we never re-add or demote them).
  const { data: existingCoach } = await supabaseAdmin
    .from('rep_team_coaches')
    .select('id')
    .eq('program_year_id', row.program_year_id)
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>();
  if (!existingCoach) {
    const created = await addRepTeamCoach(row.program_year_id, row.team_id, row.org_id, userId, 'assistant_coach');
    const grants = row.initial_capabilities ? sanitizeAssistantGrants(row.initial_capabilities) : null;
    if (grants && Object.keys(grants).length > 0) {
      await updateRepTeamCoachCapabilities(created.id, grants);
    }
  }

  return { ok: true, orgSlug: org.data.slug, teamId: row.team_id };
}
