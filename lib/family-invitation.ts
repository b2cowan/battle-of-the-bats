import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { generateNoLoginToken, hashNoLoginToken } from './no-login-token';
import { isSendableGuardianEmail, normalizeGuardianEmail } from './guardian-email';
import { fetchAllIn } from './supabase-paging';
import { todayEastern } from './free-time';
import { isLiveLeagueSeasonStatus } from './family-link-reach';
import { stoppedSecondParentRefusal } from './league-second-parent-stop';
import { assertGuardianTier, GUARDIAN_TIER_ENABLED, isGuardianCapViolation, MAX_GUARDIANS_PER_PLAYER } from './family-guardian';
import { clubContactAndMailingAddress } from './club-email-context';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { getOrgPrivacyPolicyHref } from './privacy-policy';
import { authAccountExistsForEmail } from './auth-account-lookup';
import { isPlatformAdminEmail } from './platform-auth';
import { beforeYouJoinWords, guardianConsentText, GUARDIAN_CONSENT_VERSION } from './family-guardian-consent';
import { FAMILY_INVITATION_WORDS } from './family-invitation-words';
import {
  connectables,
  consentJurisdiction,
  emailDecision,
  emailMatches,
  guardianAgeBand,
  invitationState,
  maskEmail,
  placementDecision,
  type AddressChildState,
  type Connectable,
  type GuardianAgeBand,
  type InvitationRow,
  type InvitationState,
  type PlacedSignup,
  type PlacementDecision,
} from './family-invitation-rules';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE INVITATION (Signed-in family accounts Stage 4a, Part 3; plan SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md Stage 4, RULED 2026-11-08 all
 * 15 asks A + O1/O2; build prompt SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md). ONE module owns who is invited, when, and what an
 * acceptance connects. The rules are pure (lib/family-invitation-rules.ts); this file reads the facts and writes.
 *
 *   planPlacementInvitations   house league, at Publish / a late placement / a move: invite | already connected | none, per address
 *                              (and first connects a newly placed child of an address that already joined: ruling 3, "as each is
 *                              placed", with no new invitation)
 *   issuePlacementInvitation   a placement invitation for one address (Publish, Send again, Email me a new invitation)
 *   issueRepInvitation         a rep coach's Send invitation (ruling 4; refused for a stopped / invitation-stopped address, an 18+
 *                              player, a child at two guardians)
 *   inspectInvitation          what the accept page may show (never the full address; never WHY it stopped working)
 *   acceptInvitation           the acceptance (ruling 5: a different email is refused; both boxes; the consent record per /legal
 *                              condition 4)
 *   endFamilyLink              a parent leaves / the club removes (ruling 7)
 *
 * ⚠ THE TOKEN ONLY OPENS THE ACCEPT PAGE. It never signs anyone in and never shows a team (standing rule; Part 9 guard f).
 * ⚠ AN INVITATION GOES ONLY TO AN ADDRESS ON THE CHILD'S SIGN-UP (house league) or the address a rep coach typed (Part 9 guard c).
 * ⚠ No send path reads second_parent_stops: a stopped address is already off every sign-up (the 3b stop IS the removal), and the
 *   database refuses an invitation to it (mig 453, O2). The rep coach's typed box is an ENTRY point, so it asks
 *   `stoppedSecondParentRefusal`, the sanctioned reader.
 * ⚠ While the guardian tier is off nothing here does anything: the plan is empty, every entry point refuses.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ruling 9: an invitation works for 30 days. */
export const INVITATION_DAYS = 30;

/** A refusal a coach (or the accept page) reads, in words from lib/family-invitation-words.ts. */
export class FamilyInvitationRefusal extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'FamilyInvitationRefusal';
  }
}

const LIVE_LINK = ['requested', 'invited', 'pending_approval', 'verified'];
const isSecondParentStopped = (e: unknown) => ((e as { message?: string } | null)?.message ?? '').includes('second_parent_stopped');
const isInviteStopped = (e: unknown) => ((e as { message?: string } | null)?.message ?? '').includes('family_invite_stopped');

// ── Facts ─────────────────────────────────────────────────────────────────────────────────────

/** The club's province, for the age band (ruling 12). There is no club province column (build prompt): the billing location is
 *  the only one, and none on file = unknown = the most protective path. */
async function orgProvince(orgId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('billing_locations').select('region_code').eq('org_id', orgId)
    .order('confirmed_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return ((data as { region_code?: string | null } | null)?.region_code ?? null) || null;
}

function bandReader(province: string | null): (dob: string | null) => GuardianAgeBand {
  const today = todayEastern();
  return dob => guardianAgeBand({ dateOfBirth: dob, province, today }).band;
}

type LinkFact = { child_id: string; invited_email: string; status: string; ended_by: string | null };

/** Every link of these children, as the per-(child, address) facts the rules read. */
async function addressStates(childIds: readonly string[]): Promise<{
  of: (childId: string, email: string) => AddressChildState;
}> {
  const rows = childIds.length === 0 ? [] : await fetchAllIn<LinkFact & { id: string }>(
    [...new Set(childIds)],
    (chunk, from, to) => supabaseAdmin.from('family_links')
      .select('id, child_id, invited_email, status, ended_by').in('child_id', chunk).order('id').range(from, to),
  );
  return {
    of(childId, email) {
      const mine = rows.filter(r => r.child_id === childId && r.invited_email === email);
      const live = mine.find(r => LIVE_LINK.includes(r.status)) ?? null;
      return {
        childId,
        liveStatus: live?.status ?? null,
        endedBefore: mine.some(r => !!r.ended_by && r.ended_by !== 'merged'),
        otherLiveGuardians: rows.filter(r => r.child_id === childId && r.invited_email !== email && LIVE_LINK.includes(r.status)).length,
      };
    },
  };
}

type PlacedRow = {
  id: string; child_id: string; player_first_name: string; player_date_of_birth: string | null;
  guardian_email: string | null; guardian_email_2: string | null; team_id: string | null; status: string;
  league_seasons: { status: string } | { status: string }[] | null;
  league_divisions: { teams_published_at: string | null; name: string | null } | { teams_published_at: string | null; name: string | null }[] | null;
  league_teams: { name: string | null } | { name: string | null }[] | null;
};
// ⚠ Three FKs reach league_teams from a registration (team, draft team, previous team): the team is named by its constraint.
const PLACED_COLUMNS =
  'id, child_id, player_first_name, player_date_of_birth, guardian_email, guardian_email_2, team_id, status, ' +
  'league_seasons(status), league_divisions(teams_published_at, name), league_teams!league_registrations_team_id_fkey(name)';
const one = <X>(v: X | X[] | null): X | null => (Array.isArray(v) ? v[0] ?? null : v);

/** Placed = accepted, on a team, the division's teams published, the season not closed: what reaches a team (family-link-reach). */
function isPlaced(r: PlacedRow): boolean {
  return r.status === 'active' && !!r.team_id && !!one(r.league_divisions)?.teams_published_at
    && isLiveLeagueSeasonStatus(one(r.league_seasons)?.status);
}

const toSignup = (r: PlacedRow): PlacedSignup => ({
  registrationId: r.id, childId: r.child_id, childFirstName: r.player_first_name, dateOfBirth: r.player_date_of_birth,
  firstEmail: r.guardian_email, secondEmail: r.guardian_email_2,
  teamLine: [one(r.league_teams)?.name, one(r.league_divisions)?.name].filter(Boolean).join(' · '),
});

/** Every PLACED sign-up of the org that carries this address, as first or second parent. */
export async function placedSignupsOf(orgId: string, email: string): Promise<PlacedSignup[]> {
  const [first, second] = await Promise.all(['guardian_email', 'guardian_email_2'].map(col =>
    supabaseAdmin.from('league_registrations').select(PLACED_COLUMNS).eq('org_id', orgId).eq(col, email)));
  if (first.error) throw first.error;
  if (second.error) throw second.error;
  const seen = new Set<string>();
  const out: PlacedSignup[] = [];
  for (const r of [...(first.data ?? []), ...(second.data ?? [])] as unknown as PlacedRow[]) {
    if (seen.has(r.id) || !isPlaced(r)) continue;
    seen.add(r.id);
    out.push(toSignup(r));
  }
  return out;
}

// ── The consent record (/legal condition 4) ───────────────────────────────────────────────────

async function recordConsent(params: {
  orgId: string; userId: string; email: string; consentIp: string | null; consentText: string; province: string | null;
  linkId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('family_consents')
    .insert(
      {
        org_id: params.orgId,
        guardian_email: params.email,
        user_id: params.userId,
        basis: 'express_link',
        basis_started_at: new Date().toISOString(),
        scope: 'child_data',
        // The child is the link's (source_id); the club is org_id. The age band is NOT stored (condition 4).
        source_table: 'family_links',
        source_id: params.linkId,
        consent_ip: params.consentIp,
        consent_text: params.consentText,
        // The club's province, or 'unknown' — recorded so a protective path taken for want of it is visible.
        jurisdiction: consentJurisdiction(params.province),
      },
    );
  // 23505 = family_consents_live_uniq already holds this link's live consent (a retry after a part-way failure): success.
  // ⚠ Never `.upsert(..., { onConflict })` here — that index is PARTIAL (where withdrawn_at is null) and keyed on
  // COALESCE(source_id, …), so Postgres cannot infer it from a column list and every call fails with 42P10 (found 2026-11-09).
  // A consent we failed to record is a consent we cannot prove.
  if (error && error.code !== '23505') throw error;
}

/** Write (or upgrade) one verified link for an acceptance. Returns the link id, or null when the child cannot take it now
 *  (a guardian cap race, or a concurrent acceptance of the same address). */
async function writeVerifiedLink(params: {
  orgId: string; userId: string; email: string; consentIp: string | null; c: Connectable; viaRep: boolean;
}): Promise<string | null> {
  const now = new Date().toISOString();
  const common = {
    user_id: params.userId,
    status: 'verified',
    verified_via: params.viaRep ? 'email_match' : 'registration_match',
    invited_as: params.c.invitedAs,
    approved_at: now,
    consent_recorded_at: now,
    consent_ip: params.consentIp,
    claim_token_hash: null,
    updated_at: now,
  };
  let entry: { team_id: string } | null = null;
  if (params.c.repEntryId) {
    const { data, error } = await supabaseAdmin.from('rep_roster_players').select('team_id').eq('id', params.c.repEntryId).maybeSingle();
    if (error) throw error;
    entry = data as { team_id: string } | null;
  }
  try {
    if (params.c.upgrade) {
      const { data, error } = await supabaseAdmin
        .from('family_links')
        .update({ ...common, ...(params.c.repEntryId && entry ? { player_id: params.c.repEntryId, rep_team_id: entry.team_id } : {}) })
        .eq('child_id', params.c.childId).eq('invited_email', params.email).in('status', ['requested', 'invited', 'pending_approval'])
        .select('id').maybeSingle();
      if (error) throw error;
      return (data as { id: string } | null)?.id ?? null;
    }
    const { data, error } = await supabaseAdmin
      .from('family_links')
      .insert({
        ...common,
        org_id: params.orgId,
        role: 'guardian',
        child_id: params.c.childId,
        invited_email: params.email,
        player_id: params.c.repEntryId,
        rep_team_id: entry?.team_id ?? null,
      })
      .select('id').single();
    if (error) throw error;
    return (data as { id: string }).id;
  } catch (e) {
    if (isGuardianCapViolation(e) || (e as { code?: string }).code === '23505') return null;
    throw e;
  }
}

// ── House league, at placement ────────────────────────────────────────────────────────────────

export interface AddressPlan {
  email: string;
  decision: PlacementDecision;
  children: { registrationId: string; childId: string; decision: PlacementDecision }[];
}

/**
 * For the sign-ups just placed (Publish, a late placement, a move): what each address on them gets — invite, already connected,
 * or nothing (today's email). Empty while the tier is off (every address = nothing). Addresses are normalized.
 *
 * First, a newly placed child of an address that ALREADY JOINED in this club is connected now, with no new invitation (ruling 3:
 * "now and as each is placed"); that address then reads "already connected".
 */
export async function planPlacementInvitations(
  orgId: string, registrationIds: readonly string[],
  /** The club's Send again only (`family_invitations.reconnects`): an address that left or was removed is invited back. */
  opts: { reconnects?: boolean } = {},
): Promise<Map<string, AddressPlan>> {
  const plans = new Map<string, AddressPlan>();
  if (!GUARDIAN_TIER_ENABLED || registrationIds.length === 0) return plans;

  const regs = (await fetchAllIn<PlacedRow & { org_id: string }>(
    [...new Set(registrationIds)],
    (chunk, from, to) => supabaseAdmin.from('league_registrations').select(`${PLACED_COLUMNS}, org_id`)
      .in('id', chunk).eq('org_id', orgId).order('id').range(from, to),
  )).filter(isPlaced);
  if (regs.length === 0) return plans;

  const bandOf = bandReader(await orgProvince(orgId));
  await connectAlreadyJoined(orgId, regs.map(toSignup), bandOf);

  const facts = await addressStates(regs.map(r => r.child_id));
  for (const r of regs) {
    for (const raw of [r.guardian_email, r.guardian_email_2]) {
      const email = normalizeGuardianEmail(raw);
      if (!email) continue;
      const st = facts.of(r.child_id, email);
      const decision = placementDecision({
        tierOn: true,
        band: bandOf(r.player_date_of_birth),
        connected: st.liveStatus === 'verified',
        endedBefore: st.endedBefore && !st.liveStatus && opts.reconnects !== true,
        otherLiveGuardians: st.otherLiveGuardians,
      });
      const plan = plans.get(email) ?? { email, decision: 'none' as PlacementDecision, children: [] };
      plan.children.push({ registrationId: r.id, childId: r.child_id, decision });
      plan.decision = emailDecision(plan.children.map(c => c.decision));
      plans.set(email, plan);
    }
  }
  return plans;
}

/** Ruling 3, "as each is placed": an address whose holder already accepted an invitation in this club is connected to a newly
 *  placed child now, by the same rule, with no new invitation. ⚠ /legal re-reads the consent record this writes (the parent ticked
 *  the box for the children named that day) in the Stage 4a closeout. */
async function connectAlreadyJoined(orgId: string, placed: PlacedSignup[], bandOf: (dob: string | null) => GuardianAgeBand) {
  const emails = [...new Set(placed.flatMap(s => [s.firstEmail, s.secondEmail]).map(normalizeGuardianEmail).filter((e): e is string => !!e))];
  if (emails.length === 0) return;
  const { data, error } = await supabaseAdmin
    .from('family_invitations').select('id, email, used_at, used_by_user_id')
    .eq('org_id', orgId).in('email', emails).not('used_at', 'is', null).not('used_by_user_id', 'is', null)
    .order('used_at', { ascending: false });
  if (error) throw error;
  const joined = new Map<string, { id: string; usedAt: string; userId: string }>();
  for (const r of (data ?? []) as { id: string; email: string; used_at: string; used_by_user_id: string }[]) {
    if (!joined.has(r.email)) joined.set(r.email, { id: r.id, usedAt: r.used_at, userId: r.used_by_user_id });
  }
  if (joined.size === 0) return;

  const province = await orgProvince(orgId);
  const facts = await addressStates(placed.map(s => s.childId));
  for (const [email, j] of joined) {
    const state = new Map(placed.map(s => [s.childId, facts.of(s.childId, email)]));
    const { connect } = connectables({ email, placed, rep: null, state, bandOf, reconnects: false });
    for (const c of connect) {
      const linkId = await writeVerifiedLink({ orgId, userId: j.userId, email, consentIp: null, c, viaRep: false });
      if (!linkId) continue;
      await recordConsent({
        orgId, userId: j.userId, email, consentIp: null, province, linkId,
        consentText: `${GUARDIAN_CONSENT_VERSION}\nConnected when ${c.firstName} was placed on a team, under this address's acceptance of ${j.usedAt} (invitation ${j.id}).`,
      });
    }
  }
}

/**
 * A placement invitation for one address (Publish, a late placement, the club's Send again, the parent's Email me a new
 * invitation). Replaces any open one. Null when the database refuses it (a stopped second-parent-only address, O2).
 * `reconnects` = the club's Send again only.
 */
export async function issuePlacementInvitation(params: {
  orgId: string; email: string; sentByUserId: string | null; reconnects?: boolean;
}): Promise<{ token: string; invitationId: string } | null> {
  assertGuardianTier();
  const email = normalizeGuardianEmail(params.email);
  if (!email || !isSendableGuardianEmail(email)) return null;
  const token = generateNoLoginToken();
  const { data, error } = await supabaseAdmin.rpc('family_invitation_issue', {
    p_org: params.orgId, p_email: email, p_source: 'placement', p_rep_player: null, p_child: null,
    p_sent_by: params.sentByUserId, p_token_hash: hashNoLoginToken(token), p_days: INVITATION_DAYS,
    p_reconnects: params.reconnects === true,
  });
  if (error) {
    if (isSecondParentStopped(error)) return null;
    throw error;
  }
  return { token, invitationId: data as string };
}

// ── Rep: the coach's Send invitation ──────────────────────────────────────────────────────────

/** Ruling 4: the coach's Send invitation on the player's Guardians section. Nothing happens by itself at roster add. Throws a
 *  FamilyInvitationRefusal in words for every refusal. Called only through sendRepInvitation (lib/family-invitation-mail.ts),
 *  which refuses first when the club cannot be named (O1 = A, O3) and emails the invitation. */
export async function issueRepInvitation(params: {
  orgId: string; repTeamId: string; playerId: string; email: string; sentByUserId: string;
}): Promise<{ token: string; invitationId: string }> {
  assertGuardianTier();
  const W = FAMILY_INVITATION_WORDS.rep;
  const email = normalizeGuardianEmail(params.email);
  if (!email || !isSendableGuardianEmail(email)) throw new FamilyInvitationRefusal('invalid_email', W.invalidEmail);

  const { data: player, error: playerError } = await supabaseAdmin
    .from('rep_roster_players').select('id, team_id, child_id, player_date_of_birth')
    .eq('id', params.playerId).eq('team_id', params.repTeamId).eq('org_id', params.orgId)
    // ⚠ Not a call-up (mig 309): a family link is the one audience the no-email CHECK cannot close.
    .neq('status', 'callup').maybeSingle();
  if (playerError) throw playerError;
  if (!player) throw new FamilyInvitationRefusal('not_found', W.notOnTeam);
  const p = player as { id: string; child_id: string; player_date_of_birth: string | null };

  // A typed address enters here, so it asks the stop (the sanctioned reader) and is refused in the form's own words.
  const stopped = await stoppedSecondParentRefusal(params.orgId, email);
  if (stopped) throw new FamilyInvitationRefusal('stopped', stopped);
  const { data: inviteStop, error: stopError } = await supabaseAdmin
    .from('family_invite_stops').select('id').eq('org_id', params.orgId).eq('email', email).maybeSingle();
  if (stopError) throw stopError;
  if (inviteStop) throw new FamilyInvitationRefusal('invite_stopped', W.inviteStopped);

  if (bandReader(await orgProvince(params.orgId))(p.player_date_of_birth) === 'adult') {
    throw new FamilyInvitationRefusal('adult', W.adult);
  }

  // The cap: live links of OTHER addresses, plus other open rep invitations for this child, take the two seats.
  const [{ data: links, error: linkError }, { data: invites, error: invError }] = await Promise.all([
    supabaseAdmin.from('family_links').select('invited_email, status').eq('child_id', p.child_id).in('status', LIVE_LINK),
    supabaseAdmin.from('family_invitations').select('email').eq('child_id', p.child_id).eq('source', 'rep_coach')
      .is('used_at', null).is('cancelled_at', null).is('replaced_by', null).gt('expires_at', new Date().toISOString()),
  ]);
  if (linkError) throw linkError;
  if (invError) throw invError;
  const liveLinks = (links ?? []) as { invited_email: string; status: string }[];
  if (liveLinks.some(l => l.invited_email === email && l.status === 'verified')) {
    throw new FamilyInvitationRefusal('already_connected', W.alreadyConnected);
  }
  const seats = new Set([
    ...liveLinks.map(l => l.invited_email),
    ...((invites ?? []) as { email: string }[]).map(i => i.email),
  ]);
  seats.delete(email);
  if (seats.size >= MAX_GUARDIANS_PER_PLAYER) throw new FamilyInvitationRefusal('cap', W.cap);

  const token = generateNoLoginToken();
  const { data, error } = await supabaseAdmin.rpc('family_invitation_issue', {
    p_org: params.orgId, p_email: email, p_source: 'rep_coach', p_rep_player: p.id, p_child: p.child_id,
    p_sent_by: params.sentByUserId, p_token_hash: hashNoLoginToken(token), p_days: INVITATION_DAYS, p_reconnects: false,
  });
  if (error) {
    if (isInviteStopped(error)) throw new FamilyInvitationRefusal('invite_stopped', W.inviteStopped);
    if (isSecondParentStopped(error)) throw new FamilyInvitationRefusal('stopped', (await stoppedSecondParentRefusal(params.orgId, email)) ?? W.inviteStopped);
    throw error;
  }
  return { token, invitationId: data as string };
}

/** The open rep invitations for these roster entries (the coach's Guardians section shows each as an invited row). */
export async function openRepInvitationsFor(playerIds: readonly string[]): Promise<{
  id: string; repPlayerId: string; email: string; createdAt: string; expiresAt: string;
}[]> {
  if (!GUARDIAN_TIER_ENABLED || playerIds.length === 0) return [];
  const rows = await fetchAllIn<{ id: string; rep_player_id: string; email: string; created_at: string; expires_at: string }>(
    [...new Set(playerIds)],
    (chunk, from, to) => supabaseAdmin.from('family_invitations')
      .select('id, rep_player_id, email, created_at, expires_at').in('rep_player_id', chunk).eq('source', 'rep_coach')
      .is('used_at', null).is('cancelled_at', null).is('replaced_by', null).order('id').range(from, to),
  );
  return rows.map(r => ({ id: r.id, repPlayerId: r.rep_player_id, email: r.email, createdAt: r.created_at, expiresAt: r.expires_at }));
}

/** A rep coach's Cancel invite: the invitation must be for an entry on THIS team. */
export async function cancelRepInvitation(params: { invitationId: string; repTeamId: string }): Promise<void> {
  assertGuardianTier();
  const { data: inv, error } = await supabaseAdmin
    .from('family_invitations').select('id, rep_player_id').eq('id', params.invitationId).eq('source', 'rep_coach').maybeSingle();
  if (error) throw error;
  const row = inv as { id: string; rep_player_id: string } | null;
  if (!row) throw new FamilyInvitationRefusal('not_found', FAMILY_INVITATION_WORDS.rep.cancelled);
  const { data: entry, error: entryError } = await supabaseAdmin
    .from('rep_roster_players').select('id').eq('id', row.rep_player_id).eq('team_id', params.repTeamId).maybeSingle();
  if (entryError) throw entryError;
  if (!entry) throw new FamilyInvitationRefusal('not_found', FAMILY_INVITATION_WORDS.rep.cancelled);
  const { error: updError } = await supabaseAdmin
    .from('family_invitations').update({ cancelled_at: new Date().toISOString() })
    .eq('id', row.id).is('used_at', null).is('cancelled_at', null);
  if (updError) throw updError;
}

/** The club's name as the accept page and the consent record show it. */
export async function clubNameOf(orgId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.from('organizations').select('name').eq('id', orgId).maybeSingle();
  if (error) throw error;
  return (data as { name?: string } | null)?.name ?? 'the club';
}

// ── Who the invitation says it is from (O1 = A, O3, O4) ───────────────────────────────────────

/** What an invitation names about its sender: /legal condition 2 ("a working {contact} always exists where the words say tell
 *  the club") and draft (c)'s sender line. */
export interface InvitationSender {
  clubName: string;
  /** A coach's own team with no club (O4): the contact is the inviting coach's email and there is no mailing address. */
  teamWorkspace: boolean;
  contact: string | null;
  mailingAddress: string | null;
  /** The club's privacy notice (/legal condition 5), http(s) only, or null. */
  privacyNoticeUrl: string | null;
  /** Every fact the invitation's words name exists. With the tier on, Publish and the rep Send invitation refuse otherwise. */
  ready: boolean;
}

/** `coachEmail` is read only for a coach's own team (O4), so a caller may pass it lazily and spare the club case the lookup. */
export async function invitationSenderOf(orgId: string, coachEmail?: string | null | (() => Promise<string | null>)): Promise<InvitationSender> {
  const { data, error } = await supabaseAdmin
    .from('organizations').select('name, account_kind, plan_id, privacy_policy_url').eq('id', orgId).maybeSingle();
  if (error) throw error;
  const org = data as { name: string | null; account_kind: string | null; plan_id: string | null; privacy_policy_url: string | null } | null;
  const teamWorkspace = isTeamWorkspaceOrg({ accountKind: org?.account_kind, planId: org?.plan_id });
  const { contact, mailingAddress } = teamWorkspace
    ? { contact: normalizeGuardianEmail(typeof coachEmail === 'function' ? await coachEmail() : coachEmail) ?? null, mailingAddress: null }
    : await clubContactAndMailingAddress(orgId);
  return {
    clubName: org?.name ?? 'the club',
    teamWorkspace,
    contact,
    mailingAddress,
    privacyNoticeUrl: getOrgPrivacyPolicyHref({ privacyPolicyUrl: org?.privacy_policy_url }),
    ready: teamWorkspace ? !!contact : !!contact && !!mailingAddress,
  };
}

/** An account's name as a page or an email shows it ("You're signed in as Priya Shah", "Sam Ortiz via …"), or null. */
export function accountNameOf(meta: Record<string, unknown> | null | undefined): string | null {
  const m = meta ?? {};
  const pick = (k: string) => (typeof m[k] === 'string' ? (m[k] as string).trim() : '');
  return pick('full_name') || pick('display_name') || [pick('first_name'), pick('last_name')].filter(Boolean).join(' ') || null;
}

/** A sign-in account as the invitation's pages and emails name it (the inviting coach: O4's contact, the re-send's sender), or null. */
export async function authUserOf(userId: string | null): Promise<InvitationUser | null> {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, name: accountNameOf(data.user.user_metadata) };
}

/** Where a parent lands after joining (one home: lib/family-invitation-panel.ts). */
export { FAMILY_HOME_PATH } from './family-invitation-panel';

// ── The accept page ───────────────────────────────────────────────────────────────────────────

type InvitationDbRow = {
  id: string; org_id: string; email: string; source: 'placement' | 'rep_coach'; rep_player_id: string | null;
  child_id: string | null; expires_at: string; used_at: string | null; used_by_user_id: string | null; cancelled_at: string | null;
  replaced_by: string | null; reconnects: boolean; sent_by_user_id: string | null;
};
const INVITATION_COLUMNS =
  'id, org_id, email, source, rep_player_id, child_id, expires_at, used_at, used_by_user_id, cancelled_at, replaced_by, reconnects, ' +
  'sent_by_user_id';

async function invitationByToken(token: string): Promise<InvitationDbRow | null> {
  const { data, error } = await supabaseAdmin
    .from('family_invitations').select(INVITATION_COLUMNS).eq('token_hash', hashNoLoginToken(token)).maybeSingle();
  if (error) throw error;
  return (data as unknown as InvitationDbRow | null) ?? null;
}

const asRow = (r: InvitationDbRow): InvitationRow => ({
  email: r.email, expiresAt: r.expires_at, usedAt: r.used_at, usedByUserId: r.used_by_user_id,
  cancelledAt: r.cancelled_at, replacedBy: r.replaced_by,
});

/** What an acceptance of this invitation would connect, now, with each child's team line for the page. */
async function connectablesOf(inv: InvitationDbRow) {
  const placed = await placedSignupsOf(inv.org_id, inv.email);
  let rep: { childId: string; firstName: string; entryId: string; dateOfBirth: string | null } | null = null;
  let repLine = '';
  if (inv.source === 'rep_coach' && inv.rep_player_id && inv.child_id) {
    const { data, error } = await supabaseAdmin
      .from('rep_roster_players').select('id, player_first_name, player_date_of_birth, rep_teams(name)').eq('id', inv.rep_player_id)
      .neq('status', 'callup').maybeSingle();
    if (error) throw error;
    const e = data as unknown as { id: string; player_first_name: string; player_date_of_birth: string | null; rep_teams: { name: string } | { name: string }[] | null } | null;
    if (e) {
      rep = { childId: inv.child_id, firstName: e.player_first_name, entryId: e.id, dateOfBirth: e.player_date_of_birth };
      repLine = (Array.isArray(e.rep_teams) ? e.rep_teams[0] : e.rep_teams)?.name ?? '';
    }
  }
  const childIds = [...placed.map(s => s.childId), ...(rep ? [rep.childId] : [])];
  const facts = await addressStates(childIds);
  const state = new Map(childIds.map(id => [id, facts.of(id, inv.email)]));
  const province = await orgProvince(inv.org_id);
  const lines = new Map<string, Set<string>>();
  const addLine = (childId: string, line: string) => lines.set(childId, (lines.get(childId) ?? new Set<string>()).add(line));
  for (const s of placed) if (s.teamLine) addLine(s.childId, s.teamLine);
  if (rep && repLine) addLine(rep.childId, repLine);
  return {
    province,
    lines,
    ...connectables({ email: inv.email, placed, rep, state, bandOf: bandReader(province), reconnects: inv.reconnects }),
  };
}

/** One child the accept page lists: the first name and the team line(s) ("Otters · U9 Rookie"). Never another child's. */
export interface InvitationChild { firstName: string; teamLine: string }

/** Who is signed in, as the page may show it: never the full address of either account. */
export type InvitationViewer =
  | { kind: 'none' }
  /** A: signed in as the invited address. */
  | { kind: 'same'; name: string | null; maskedEmail: string }
  /** C: signed in as another address (ruling 5: refused). */
  | { kind: 'other'; maskedEmail: string };

export interface InvitationView {
  state: InvitationState;
  /** "p••••••@example.com" — the page never receives the full address. Open and expired states only. */
  maskedEmail: string | null;
  source: 'placement' | 'rep_coach' | null;
  /** The children an acceptance connects (open state only). */
  children: InvitationChild[];
  viewer: InvitationViewer;
  /** Who it is from, for the words (F's contact line, the privacy notice). Null when the token is unknown. */
  sender: InvitationSender | null;
}

/** The signed-in account, as the accept page knows it. */
export interface InvitationUser { id: string; email: string | null; name: string | null }

/** This account holds a live verified link to a child in this org (E: "a signed-in parent who is already connected"). */
async function holdsVerifiedLinkInOrg(userId: string, orgId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('family_links').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('org_id', orgId).eq('status', 'verified');
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * What the accept page may show for this token (drawing tab 2). A state other than `open` carries nothing about the children,
 * and F never says why. E is this account's own used invitation, or — for the invited address signed in — any invitation of a
 * club it is already connected in (an older one, the next division's).
 */
export async function inspectInvitation(token: string, user: InvitationUser | null): Promise<InvitationView> {
  const unknown: InvitationView = { state: 'no_longer_works', maskedEmail: null, source: null, children: [], viewer: { kind: 'none' }, sender: null };
  if (!GUARDIAN_TIER_ENABLED) return unknown;
  const inv = await invitationByToken(token);
  if (!inv) return unknown;

  const sender = await invitationSenderOf(inv.org_id, inv.source === 'rep_coach' ? async () => (await authUserOf(inv.sent_by_user_id))?.email ?? null : null);
  const viewer: InvitationViewer = !user?.email ? { kind: 'none' }
    : emailMatches(inv.email, user.email) ? { kind: 'same', name: user.name, maskedEmail: maskEmail(inv.email) }
      : { kind: 'other', maskedEmail: maskEmail(user.email) };
  const base = { maskedEmail: null as string | null, source: inv.source, children: [] as InvitationChild[], viewer, sender };
  const joinedHere = async () => viewer.kind === 'same' && !!user && await holdsVerifiedLinkInOrg(user.id, inv.org_id);

  let state = invitationState(asRow(inv), new Date().toISOString(), user?.id ?? null);
  if (state !== 'open' && state !== 'joined' && await joinedHere()) state = 'joined';
  if (state === 'joined') return { ...base, state };
  if (state === 'expired_or_replaced') return { ...base, state, maskedEmail: maskEmail(inv.email) };
  if (state !== 'open') return { ...base, state };

  const { connect, lines } = await connectablesOf(inv);
  // An open invitation that connects nothing now: E for the parent already connected, F for everyone else (every child left the
  // team, was removed, or turned 18 — never said which).
  if (connect.length === 0) return { ...base, state: (await joinedHere()) ? 'joined' : 'no_longer_works' };
  return {
    ...base,
    state,
    maskedEmail: maskEmail(inv.email),
    children: connect.map(c => ({ firstName: c.firstName, teamLine: [...(lines.get(c.childId) ?? [])].join(', ') })),
  };
}

/**
 * The accept page's email-first step: does the typed address match, and does it already have an account? The answer is all
 * the page learns, and the second half only after the first: a person who typed the invited address, holding its invitation,
 * learns whether to choose a password or enter one — nobody else learns anything.
 */
export async function invitationEmailCheck(token: string, typed: string): Promise<
  { match: false } | { match: true; hasAccount: boolean }
> {
  if (!GUARDIAN_TIER_ENABLED) return { match: false };
  const inv = await invitationByToken(token);
  // Only an open invitation asks for an address (the page shows the step in A only): a used, cancelled or expired link answers
  // nothing about the address it was for.
  if (!inv || invitationState(asRow(inv), new Date().toISOString(), null) !== 'open') return { match: false };
  if (!emailMatches(inv.email, typed)) return { match: false };
  const hasAccount = (await isPlatformAdminEmail(inv.email)) || (await authAccountExistsForEmail(inv.email));
  return { match: true, hasAccount };
}

export type AcceptResult =
  /** `userId`: set by the new-account path only — the account it made, so the route records its Terms tick (step 6.3). */
  | { kind: 'joined'; orgId: string; childIds: string[]; userId?: string }
  | { kind: 'mismatch'; maskedEmail: string }
  | { kind: 'consent_required' }
  | { kind: 'state'; state: Exclude<InvitationState, 'open'> };

/**
 * Accept (Part 4 calls it). The token is valid, unused, not expired, not replaced, not cancelled; the signed-in account's email
 * equals the invited address (ruling 5: otherwise refuse — the old coach approval queue is gone); both boxes ticked. Writes each
 * link `verified` (registration_match for a house-league child, email_match for the rep player), the consent record per /legal
 * condition 4, and marks the invitation used — claimed FIRST, so one invitation is used once.
 */
export async function acceptInvitation(params: {
  token: string; userId: string; userEmail: string | null; consentIp: string | null;
  guardianBox: boolean; consentBox: boolean;
}): Promise<AcceptResult> {
  assertGuardianTier();
  const inv = await invitationByToken(params.token);
  const state = invitationState(inv ? asRow(inv) : null, new Date().toISOString(), params.userId);
  if (!inv || state !== 'open') return { kind: 'state', state: state === 'open' ? 'no_longer_works' : state };
  if (!emailMatches(inv.email, params.userEmail)) return { kind: 'mismatch', maskedEmail: maskEmail(inv.email) };
  if (params.guardianBox !== true || params.consentBox !== true) return { kind: 'consent_required' };

  const { connect, province } = await connectablesOf(inv);
  if (connect.length === 0) return { kind: 'state', state: 'no_longer_works' };

  // Claim first: two presses (or two tabs) cannot both use one invitation.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('family_invitations').update({ used_at: new Date().toISOString(), used_by_user_id: params.userId })
    .eq('id', inv.id).is('used_at', null).is('cancelled_at', null).is('replaced_by', null)
    .gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { kind: 'state', state: 'no_longer_works' };

  // The exact words the page showed for these children (the page renders the same builder from `inspectInvitation`'s names).
  const childIds: string[] = [];
  try {
    const consentText = guardianConsentText(beforeYouJoinWords(await clubNameOf(inv.org_id), connect.map(c => c.firstName)));
    for (const c of connect) {
      const linkId = await writeVerifiedLink({
        orgId: inv.org_id, userId: params.userId, email: inv.email, consentIp: params.consentIp, c, viaRep: !!c.repEntryId,
      });
      if (!linkId) continue;
      await recordConsent({
        orgId: inv.org_id, userId: params.userId, email: inv.email, consentIp: params.consentIp, consentText, province, linkId,
      });
      childIds.push(c.childId);
    }
  } catch (e) {
    // A write that failed after the claim gives the invitation back, so the parent's retry finds it open (not F). A child
    // already written stays connected; the retry skips it and carries on with the rest.
    await releaseClaim(inv.id, params.userId);
    throw e;
  }
  return { kind: 'joined', orgId: inv.org_id, childIds };
}

/** Undo the claim of an acceptance that failed part-way — only while this account still holds it. Logged, never thrown: the
 *  caller is already answering the original failure. */
async function releaseClaim(invitationId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('family_invitations').update({ used_at: null, used_by_user_id: null })
    .eq('id', invitationId).eq('used_by_user_id', userId);
  if (error) console.error('[family-invitation] a failed acceptance could not give its invitation back:', error.message);
}

/** Remove an account the new-account path made, when its acceptance did not go through. Logged, never thrown. */
async function removeNewAccount(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) console.error('[family-invitation] a new account whose acceptance failed could not be removed:', error.message);
}

/** The first-parent name on one of the address's placed sign-ups, for a new account's name (the account menu shows it). */
async function nameOnSignup(orgId: string, email: string): Promise<{ first: string; last: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('league_registrations').select('guardian_first_name, guardian_last_name')
    .eq('org_id', orgId).eq('guardian_email', email).not('guardian_first_name', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return null;
  const r = data as { guardian_first_name: string | null; guardian_last_name: string | null } | null;
  const first = r?.guardian_first_name?.trim() ?? '';
  return first ? { first, last: r?.guardian_last_name?.trim() ?? '' } : null;
}

/** The shortest password a new account takes (the sign-up routes' rule). */
export const NEW_ACCOUNT_PASSWORD_MIN = 8;

/**
 * Ruling 15, "trust the invitation": the accept page's NEW-account path. A new account made from a valid invitation, with the
 * typed email matching, is created ALREADY CONFIRMED (no confirm email: the invitation went to that inbox), then accepted in the
 * same request — the parent fills the page once. Everything that can refuse is checked BEFORE the account exists; if the
 * acceptance still loses a race after it, the account is removed again (no orphan made by a refusal). The caller signs in.
 * An address that already has an account (or is a staff address) is told to sign in instead.
 */
export async function acceptWithNewAccount(params: {
  token: string; typedEmail: string; password: string; consentIp: string | null; guardianBox: boolean; consentBox: boolean;
}): Promise<AcceptResult | { kind: 'account_exists' } | { kind: 'password_short' }> {
  assertGuardianTier();
  const inv = await invitationByToken(params.token);
  const state = invitationState(inv ? asRow(inv) : null, new Date().toISOString(), null);
  if (!inv || state !== 'open') return { kind: 'state', state: state === 'open' || state === 'joined' ? 'no_longer_works' : state };
  if (!emailMatches(inv.email, params.typedEmail)) return { kind: 'mismatch', maskedEmail: maskEmail(inv.email) };
  if (params.guardianBox !== true || params.consentBox !== true) return { kind: 'consent_required' };
  if (params.password.length < NEW_ACCOUNT_PASSWORD_MIN) return { kind: 'password_short' };
  if ((await isPlatformAdminEmail(inv.email)) || (await authAccountExistsForEmail(inv.email))) return { kind: 'account_exists' };
  const { connect } = await connectablesOf(inv);
  if (connect.length === 0) return { kind: 'state', state: 'no_longer_works' };

  const name = await nameOnSignup(inv.org_id, inv.email);
  const full = name ? `${name.first} ${name.last}`.trim() : null;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: inv.email,
    password: params.password,
    email_confirm: true,
    user_metadata: name ? { first_name: name.first, last_name: name.last, full_name: full, display_name: full } : {},
  });
  if (error || !data.user) {
    // A second submit that raced past the check: the same answer as the check. Only the address-taken codes — Auth answers 422
    // for a refused password too, and that is not "you already have an account".
    if (error?.code === 'email_exists' || error?.code === 'user_already_exists') return { kind: 'account_exists' };
    throw error ?? new Error('The account was not created.');
  }
  const userId = data.user.id;
  try {
    const result = await acceptInvitation({
      token: params.token, userId, userEmail: inv.email, consentIp: params.consentIp,
      guardianBox: params.guardianBox, consentBox: params.consentBox,
    });
    // Lost the claim to another request: nothing was written for this account, so it goes again.
    if (result.kind !== 'joined') await removeNewAccount(userId);
    return result.kind === 'joined' ? { ...result, userId } : result;
  } catch (e) {
    // The acceptance failed part-way and gave its invitation back. An account that holds no connection yet is removed. One that
    // already holds one is KEPT: removing it would leave that connection verified with no account behind it (the link's user is
    // set null, not deleted), and the parent's retry signs in with the password just chosen and connects the rest.
    const { count, error: countError } = await supabaseAdmin
      .from('family_links').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (!countError && count === 0) await removeNewAccount(userId);
    throw e;
  }
}

/** The invitation behind an expired or replaced link (D's "Email me a new invitation"), or null for any other state: the
 *  re-send never answers differently, so a null and a send look the same to the page. */
export async function invitationToResend(token: string): Promise<{
  orgId: string; email: string; source: 'placement' | 'rep_coach'; repPlayerId: string | null; sentByUserId: string | null;
  reconnects: boolean;
} | null> {
  if (!GUARDIAN_TIER_ENABLED) return null;
  const inv = await invitationByToken(token);
  if (!inv || invitationState(asRow(inv), new Date().toISOString(), null) !== 'expired_or_replaced') return null;
  // A replaced link re-sends only while the invitation that replaced it was not cancelled: the coach's Cancel (or a send that
  // failed and was cancelled) marks the newest one only, and an older link must not undo it.
  if (await replacementWasCancelled(inv.replaced_by)) return null;
  return {
    orgId: inv.org_id, email: inv.email, source: inv.source, repPlayerId: inv.rep_player_id, sentByUserId: inv.sent_by_user_id,
    reconnects: inv.reconnects,
  };
}

/** Follow `replaced_by` to the newest invitation; true when any one after this link was cancelled. Bounded: a chain is one row
 *  per re-send. */
async function replacementWasCancelled(replacedBy: string | null): Promise<boolean> {
  let next = replacedBy;
  for (let hops = 0; next && hops < 50; hops++) {
    const { data, error } = await supabaseAdmin
      .from('family_invitations').select('replaced_by, cancelled_at').eq('id', next).maybeSingle();
    if (error) throw error;
    const row = data as { replaced_by: string | null; cancelled_at: string | null } | null;
    if (!row) return false;
    if (row.cancelled_at) return true;
    next = row.replaced_by;
  }
  return false;
}

// ── Leaving and removing (ruling 7) ───────────────────────────────────────────────────────────

/** A parent leaves (`parent`: only their own link) or the club removes (`club`: any link of the org). Neither parent removes the
 *  other. Ending is final for automatic invitations (`ended_by`); only the club's Send again brings them back. Nobody is emailed. */
export async function endFamilyLink(params:
  | { by: 'parent'; linkId: string; userId: string }
  | { by: 'club'; linkId: string; orgId: string },
): Promise<boolean> {
  assertGuardianTier();
  let q = supabaseAdmin.from('family_links')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), ended_by: params.by, calendar_token_hash: null, updated_at: new Date().toISOString() })
    .eq('id', params.linkId).in('status', LIVE_LINK);
  q = params.by === 'parent' ? q.eq('user_id', params.userId) : q.eq('org_id', params.orgId);
  const { data, error } = await q.select('id').maybeSingle();
  if (error) throw error;
  return !!data;
}
