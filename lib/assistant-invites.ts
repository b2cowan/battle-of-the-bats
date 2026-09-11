import { supabaseAdmin } from './supabase-admin';
import { generateAssistantInviteToken, hashAssistantInviteToken } from './assistant-invite-token';
import { addStaffMember, getActiveTeamMembership } from './coach-membership';
import {
  sanitizeAssistantGrants, sanitizeStaffKind, STAFF_KIND_COPY,
  type AssistantCapabilityGrants, type StaffKind,
} from './coach-capabilities';
import { sendEmail, assistantCoachInviteHtml } from './email';
import { notify } from './notify';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

/**
 * THE ONE INVITE EMAIL — subject, heading and promise from `STAFF_KIND_COPY` for the kind the
 * invite carries. Three senders share it (the head coach's invite, a resend, the club admin's
 * approval) so a kind's wording cannot differ by which door the email left through. A NULL kind
 * (an invite minted before mig 288) reads as an assistant coach, which is what it offered.
 */
export async function sendAssistantInviteEmail(p: {
  email: string;
  teamName: string;
  invitedByName: string | null;
  rawToken: string;
  staffKind: StaffKind | null;
}): Promise<void> {
  const kind: StaffKind = p.staffKind ?? 'assistant';
  const inviteUrl = `${APP_URL}/auth/accept-assistant-invite?token=${p.rawToken}`;
  await sendEmail(
    p.email,
    STAFF_KIND_COPY[kind].emailSubject(p.teamName),
    assistantCoachInviteHtml({ teamName: p.teamName, invitedByName: p.invitedByName, inviteUrl, staffKind: kind }),
  );
}

/**
 * THE ONE ADMIN NOTIFICATION for an invite that is waiting on the club's approval — sent when a
 * head coach sends one, resends one under an approval policy, or CHANGES what a still-unapproved
 * one will hand over (/review, 2026-09-11: an admin approving "a helper" must not be approving a
 * treasurer the head coach rewrote it into after the bell rang). ⚠ It names WHICH kind: an admin
 * approving a parent who runs a station is answering a different question from one approving the
 * team's books.
 */
export async function notifyAdminOfPendingInvite(p: {
  orgId: string;
  orgSlug: string;
  inviteId: string;
  email: string;
  teamName: string;
  invitedByName: string | null;
  staffKind: StaffKind | null;
  changed?: boolean;
}): Promise<void> {
  const copy = STAFF_KIND_COPY[p.staffKind ?? 'assistant'];
  await notify({
    orgId: p.orgId,
    eventType: 'assistant_coach_approval_requested',
    title: p.changed ? `${copy.name} invite changed — still awaiting approval` : `${copy.name} invite awaiting approval`,
    body: p.changed
      ? `${p.invitedByName ?? 'A head coach'} changed what ${p.email} will get on ${p.teamName}: now ${copy.asA} — ${copy.sentence}`
      : `${p.invitedByName ?? 'A head coach'} invited ${p.email} to ${p.teamName} as ${copy.asA} — ${copy.sentence}`,
    link: `/${p.orgSlug}/admin/rep-teams`,
    metadata: { inviteId: p.inviteId },
  }).catch(() => {});
}

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
  /** The kind this invite offers (mig 288). NULL on invites minted before it — accepts as an assistant. */
  staff_kind: StaffKind | null;
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
  /** The kind the head coach chose — copied onto the membership on accept. */
  staffKind: StaffKind | null;
  requireApproval: boolean;
}

/** One pending invite as the head coach's staff list and the admin's oversight page show it. */
export interface OpenAssistantInvite {
  id: string;
  teamId: string;
  invitedEmail: string;
  status: 'pending' | 'pending_approval';
  staffKind: StaffKind | null;
  initialCapabilities: AssistantCapabilityGrants | null;
  expiresAt: string;
  createdAt: string;
}

function mapOpenInvite(r: AssistantInviteRow): OpenAssistantInvite {
  return {
    id: r.id,
    teamId: r.team_id,
    invitedEmail: r.invited_email,
    status: r.status as 'pending' | 'pending_approval',
    staffKind: sanitizeStaffKind(r.staff_kind),
    initialCapabilities: r.initial_capabilities,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

/** Mint an invite. When approval is NOT required we return the raw token so the caller can email it.
 *  When approval IS required we store the row as `pending_approval` with a placeholder hash and return
 *  no token — a fresh token is minted at approval time (so the raw token never lives anywhere early). */
export async function createAssistantInvite(
  input: CreateAssistantInviteInput,
): Promise<{ inviteId: string; rawToken: string | null; status: 'pending' | 'pending_approval'; invite: OpenAssistantInvite }> {
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
      staff_kind: input.staffKind,
      invited_by_name: input.invitedByName,
      team_name: input.teamName,
    })
    .select('*')
    .single<AssistantInviteRow>();
  if (error) throw error;

  // Post-insert compensation (/review, 2026-09-11): two resends of the same invite at the same
  // instant each revoke what exists, then each insert — leaving two live links. The revoke above
  // is the ordinary path; this one runs after the insert and retires any OLDER open invite for
  // the same person that landed between the two, so the newest link is the only valid one in
  // every interleaving (the same post-write convergence `syncLiveSeasonProjection` uses).
  await supabaseAdmin
    .from('assistant_invite_tokens')
    .update({ status: 'revoked' })
    .eq('team_id', input.teamId)
    .eq('invited_email', input.invitedEmail.trim().toLowerCase())
    .in('status', ['pending', 'pending_approval'])
    .neq('id', data.id)
    .lt('created_at', data.created_at);

  return { inviteId: data.id, rawToken, status, invite: mapOpenInvite(data) };
}

/** The team's outstanding invites, newest first — the head coach's pending rows (R3). */
export async function listOpenAssistantInvitesForTeam(teamId: string): Promise<OpenAssistantInvite[]> {
  const { data, error } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('*')
    .eq('team_id', teamId)
    .in('status', ['pending', 'pending_approval'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => mapOpenInvite(r as AssistantInviteRow));
}

/** One outstanding invite, TEAM-SCOPED: an id from another team is null, never a row. */
export async function getOpenAssistantInviteForTeam(inviteId: string, teamId: string): Promise<OpenAssistantInvite | null> {
  const { data, error } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('*')
    .eq('id', inviteId)
    .eq('team_id', teamId)
    .in('status', ['pending', 'pending_approval'])
    .maybeSingle<AssistantInviteRow>();
  if (error) throw error;
  return data ? mapOpenInvite(data) : null;
}

/**
 * Change what a pending invite will hand over when it is accepted (R3 — "editable until
 * acceptance"). The WHERE re-asserts team + still-open, so an invite accepted between the head
 * coach's screen loading and their tap comes back null instead of being rewritten under the
 * person who just joined (the membership, not the invite, is their access truth by then).
 */
export async function updateAssistantInviteAccess(
  inviteId: string,
  teamId: string,
  patch: { staffKind?: StaffKind; initialCapabilities?: AssistantCapabilityGrants },
): Promise<OpenAssistantInvite | null> {
  const update: Record<string, unknown> = {};
  if (patch.staffKind) update.staff_kind = patch.staffKind;
  if (patch.initialCapabilities) update.initial_capabilities = patch.initialCapabilities;
  if (Object.keys(update).length === 0) return getOpenAssistantInviteForTeam(inviteId, teamId);
  const { data, error } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .update(update)
    .eq('id', inviteId)
    .eq('team_id', teamId)
    .in('status', ['pending', 'pending_approval'])
    .select('*')
    .maybeSingle<AssistantInviteRow>();
  if (error) throw error;
  return data ? mapOpenInvite(data) : null;
}

/**
 * Resend = a FRESH invite for the same person carrying the same kind and grants, minted through
 * `createAssistantInvite` so the old link is superseded the way a re-typed invite always was, and
 * the seven days start again. Only a `pending` invite can be resent — one awaiting the club
 * admin's approval has no link yet (the approval mints it), so there is nothing to send.
 *
 * ⚠ `requireApproval` is the org's CURRENT policy, decided by the caller the way the invite route
 * decides it (/review, 2026-09-11): a club that turned approval on after this invite went out
 * must not be bypassed by "Resend" minting fresh links forever. Under approval the fresh row is
 * `pending_approval` with no token, and the caller notifies the admin instead of emailing.
 * Returns null when the source is not resendable.
 */
export async function resendAssistantInvite(
  inviteId: string,
  teamId: string,
  opts: { requireApproval: boolean },
): Promise<{ invite: OpenAssistantInvite; rawToken: string | null; invitedByName: string | null; teamName: string | null } | null> {
  const { data: row, error } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('*')
    .eq('id', inviteId)
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .maybeSingle<AssistantInviteRow>();
  if (error) throw error;
  if (!row) return null;
  const minted = await createAssistantInvite({
    orgId: row.org_id,
    teamId: row.team_id,
    programYearId: row.program_year_id,
    invitedByUserId: row.invited_by_user_id,
    invitedByName: row.invited_by_name,
    invitedEmail: row.invited_email,
    teamName: row.team_name,
    initialCapabilities: row.initial_capabilities,
    staffKind: sanitizeStaffKind(row.staff_kind),
    requireApproval: opts.requireApproval,
  });
  return { invite: minted.invite, rawToken: minted.rawToken, invitedByName: row.invited_by_name, teamName: row.team_name };
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

/** Cancel an open invite. Pass `teamId` wherever the caller resolved one — the WHERE then re-asserts it. */
export async function revokeAssistantInvite(inviteId: string, teamId?: string): Promise<void> {
  let q = supabaseAdmin
    .from('assistant_invite_tokens')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .in('status', ['pending', 'pending_approval']);
  if (teamId) q = q.eq('team_id', teamId);
  await q;
}

/** Outstanding invites across a whole org (admin oversight), joined to team name + group for scoping. */
export async function listOpenAssistantInvitesForOrg(
  orgId: string,
): Promise<{ id: string; teamId: string; teamName: string | null; teamGroupId: string | null; invitedEmail: string; status: string; staffKind: StaffKind | null; expiresAt: string; createdAt: string }[]> {
  const { data } = await supabaseAdmin
    .from('assistant_invite_tokens')
    .select('id, team_id, invited_email, status, staff_kind, expires_at, created_at, rep_teams!team_id ( name, group_id )')
    .eq('org_id', orgId)
    .in('status', ['pending', 'pending_approval'])
    .order('created_at', { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id, teamId: r.team_id, teamName: r.rep_teams?.name ?? null, teamGroupId: r.rep_teams?.group_id ?? null,
    invitedEmail: r.invited_email, status: r.status, staffKind: sanitizeStaffKind(r.staff_kind),
    expiresAt: r.expires_at, createdAt: r.created_at,
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
  invitedEmail: string; expired: boolean; staffKind: StaffKind | null;
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
    staffKind: sanitizeStaffKind(row.staff_kind),
  };
}

/** Claim an invite for a signed-in user: create the minimal guest membership + assistant-coach row.
 *  DELIBERATELY does NOT call the one-org guard — an assistant is a team guest (cross-club OK). */
export async function acceptAssistantInvite(
  rawToken: string,
  userId: string,
  userEmail: string,
): Promise<{ ok: true; orgSlug: string; teamId: string; staffKind: StaffKind | null } | { ok: false; error: string; status: number }> {
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

  // 2) TEAM MEMBERSHIP (M1, 2026-08-16) — the access truth; the live season's record row is
  //    projected by addStaffMember. A head coach who accepts their own invite is already an
  //    active member, so we never re-add or DEMOTE them; anyone else lands (or is reactivated)
  //    as an assistant with the invite's grants.
  //
  //    ⚠ A REVOKED former head coach who accepts an assistant invite reactivates as an
  //    ASSISTANT — deliberate: the invite names the seat being offered, and the head coach (or
  //    admin) chose "assistant" when sending it. Reactivation restores stored GRANTS when the
  //    invite carries none, but the ROLE is always the invite's. (Flagged by /simplify's
  //    altitude pass 2026-08-16; recorded as intended behavior, not an oversight.)
  const existing = await getActiveTeamMembership(row.org_id, row.team_id, userId);
  // The word that actually applies: an existing member keeps theirs (the invite changed nothing —
  // the invite route refuses to re-invite active staff, so this is the head coach accepting their
  // own invite, or a race); everyone else lands with the invite's.
  const staffKind = existing ? existing.staffKind : sanitizeStaffKind(row.staff_kind);
  if (!existing) {
    const grants = row.initial_capabilities ? sanitizeAssistantGrants(row.initial_capabilities) : null;
    await addStaffMember({
      orgId: row.org_id,
      teamId: row.team_id,
      userId,
      coachRole: 'assistant_coach',
      capabilities: grants && Object.keys(grants).length > 0 ? grants : null,
      // The word the head coach chose lands with the grants it chose (mig 288).
      staffKind,
    });
  }

  return { ok: true, orgSlug: org.data.slug, teamId: row.team_id, staffKind };
}
