import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { normalizeGuardianEmail } from './guardian-email';
import { generateNoLoginToken, hashNoLoginToken } from './no-login-token';
import { FamilyLinkError, type FamilyLink } from './family-access';

/**
 * lib/family-guardian.ts — the GUARDIAN tier: a parent connected to one specific child.
 *
 * ⚠ SHIPPED SWITCHED OFF. `GUARDIAN_TIER_ENABLED` defaults to false and every entry point in
 * this module refuses while it is off — so no guardian link and no consent record can be
 * created, by the UI or by a direct API call, until it is deliberately turned on. This is
 * built ahead of the PIPEDA/CASL counsel review so that sign-off is a copy change and a flag
 * flip rather than a build; it is NOT a decision that the review has happened.
 *
 * The owner's reasoning for building now (2026-08-01), recorded because it is a fair
 * correction to how this was first framed: a coach INVITING the guardian address already on
 * the roster is not a new trust decision — that address is already on the player row and
 * already receives team email and tryout offers. What IS new is (a) the standing view of a
 * child's records a connected guardian receives, and (b) an unsolicited requester ASSERTING
 * a parental relationship the coach cannot truly verify. Those two are what the counsel
 * questions cover, and they are why this stays off by default.
 *
 * The tier boundary is the standing security invariant of the whole family layer: guardian
 * payloads live in their own DTOs (see `lib/family-guardian-view.ts`), never as a widened
 * follower payload.
 */

/**
 * The switch. Server-side only — deliberately NOT a `NEXT_PUBLIC_` var, so it cannot be
 * flipped by anything the browser can reach, and the UI learns the answer by asking the API
 * rather than by reading a bundle constant.
 *
 * Follows the `ENTITLEMENT_GRANTS_ENABLED` convention: absent or anything other than the
 * literal 'true' means OFF.
 */
export const GUARDIAN_TIER_ENABLED = process.env.GUARDIAN_TIER_ENABLED === 'true';

/** Guardians per player. Owner ruling #17: one per household, room for a second. */
export const MAX_GUARDIANS_PER_PLAYER = 2;

// The consent wording and the age bands live in `lib/family-guardian-consent.ts` — a module
// the CLIENT can import too, which is the only way the stored consent record and the screen a
// parent read can be guaranteed to say the same thing. Re-exported here so server callers have
// one import.
export {
  GUARDIAN_AGE_BANDS,
  GUARDIAN_AGE_BAND_OPTIONS,
  GUARDIAN_CONSENT_LABELS,
  guardianConsentText,
  type GuardianAgeBand,
} from './family-guardian-consent';
// Re-exporting does not bring the names into this module's own scope, so the ones used here
// are imported too.
import { guardianConsentText, type GuardianAgeBand } from './family-guardian-consent';

/** Refuse loudly rather than half-serving, so a caller cannot mistake "off" for "no match". */
function assertEnabled() {
  if (!GUARDIAN_TIER_ENABLED) {
    throw new FamilyLinkError(
      'not_found',
      'Connecting as a player’s parent or guardian isn’t open yet.',
    );
  }
}

// ── The coach's view of one player's guardians ────────────────────────────────

export interface PlayerGuardianRow {
  id: string;
  email: string;
  relationship: string | null;
  status: FamilyLink['status'];
  verifiedVia: FamilyLink['verifiedVia'];
  requestedPlayerName: string | null;
  createdAt: string;
  approvedAt: string | null;
  /**
   * The requester's email equals the guardian contact already on this player's roster row.
   *
   * An ASSIST for the coach's eye, never authorization (the "never live authz" ruling). It
   * says "this is the address you yourself typed", which is genuinely useful, and says
   * nothing about whether the person holding it is a parent.
   */
  matchesRosterContact: boolean;
  /**
   * The address the person who claimed the invite actually holds, when it DIFFERS from the one
   * the coach invited (mig 220). Null on every other row — a parent-initiated request (where
   * the invited address IS the requester's own), an outstanding invite nobody has claimed, and
   * a claim that matched.
   *
   * ⚠ This is the whole reason a mismatched claim is in the queue. Without it on screen the
   * coach is asked to adjudicate a mismatch they cannot see, which is a blind approval on a
   * surface granting standing access to a child's records. Evidence, never authorization.
   */
  claimedEmail: string | null;
}

const GUARDIAN_COLUMNS =
  'id, org_id, rep_team_id, role, player_id, user_id, invited_email, claimed_email, relationship, ' +
  'status, verified_via, requested_player_name, created_at, approved_at';

interface GuardianRow {
  id: string;
  player_id: string | null;
  invited_email: string;
  claimed_email: string | null;
  relationship: string | null;
  status: FamilyLink['status'];
  verified_via: FamilyLink['verifiedVia'];
  requested_player_name: string | null;
  created_at: string;
  approved_at: string | null;
}

/**
 * Guardian links for one team, grouped by player, with the roster-contact assist resolved.
 *
 * Returns an empty map while the tier is off — the coach's player page simply shows no
 * guardians card, rather than an empty one implying the feature exists.
 */
export async function getGuardiansByPlayer(
  repTeamId: string,
  programYearId: string,
): Promise<{ byPlayer: Map<string, PlayerGuardianRow[]>; unattachedRequests: PlayerGuardianRow[] }> {
  const out = new Map<string, PlayerGuardianRow[]>();
  const unattachedRequests: PlayerGuardianRow[] = [];
  if (!GUARDIAN_TIER_ENABLED) return { byPlayer: out, unattachedRequests };

  const [{ data: linkRows, error: linkError }, { data: playerRows, error: playerError }] =
    await Promise.all([
      supabaseAdmin
        .from('family_links')
        .select(GUARDIAN_COLUMNS)
        .eq('rep_team_id', repTeamId)
        .eq('role', 'guardian')
        .not('status', 'in', '("declined","revoked")')
        .order('created_at', { ascending: true }),
      // The guardian contact the COACH typed — the assist's other half.
      supabaseAdmin
        .from('rep_roster_players')
        .select('id, guardian_email')
        .eq('program_year_id', programYearId),
    ]);
  if (linkError) throw linkError;
  if (playerError) throw playerError;

  const rosterContact = new Map(
    (playerRows ?? []).map(p => [
      (p as { id: string }).id,
      normalizeGuardianEmail((p as { guardian_email: string | null }).guardian_email),
    ]),
  );

  for (const raw of (linkRows ?? []) as unknown as GuardianRow[]) {
    const row: PlayerGuardianRow = {
      id: raw.id,
      email: raw.invited_email,
      relationship: raw.relationship,
      status: raw.status,
      verifiedVia: raw.verified_via,
      requestedPlayerName: raw.requested_player_name,
      createdAt: raw.created_at,
      approvedAt: raw.approved_at,
      matchesRosterContact: !!raw.player_id
        && !!rosterContact.get(raw.player_id)
        && rosterContact.get(raw.player_id) === raw.invited_email,
      // Surfaced ONLY when it differs from the invited address. Repeating an identical address
      // twice on the row would be noise that trains the coach to stop reading it — and this is
      // the one line on the row that must survive being skimmed.
      claimedEmail: raw.claimed_email && raw.claimed_email !== raw.invited_email
        ? raw.claimed_email
        : null,
    };

    // ⚠ A guardian REQUEST has no player yet — the parent typed a name into a form that
    // showed them no roster, and the COACH attaches the row at approval (mig 216). An earlier
    // version skipped these as "structurally impossible", which was true under mig 215's
    // stricter CHECK and became false the moment that CHECK was relaxed for this very flow.
    // The result was that every parent-initiated request — the PRIMARY on-ramp — was
    // invisible to every coach screen and could never be approved.
    if (!raw.player_id) {
      unattachedRequests.push(row);
      continue;
    }
    out.set(raw.player_id, [...(out.get(raw.player_id) ?? []), row]);
  }
  return { byPlayer: out, unattachedRequests };
}

/** Live guardians for a player — the cap counts these. `declined`/`revoked` never count, so a
 *  mistake is recoverable rather than permanently consuming one of the two seats. */
async function countLiveGuardians(playerId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('family_links')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('role', 'guardian')
    .in('status', ['requested', 'invited', 'pending_approval', 'verified']);
  if (error) throw error;
  return count ?? 0;
}

// ── Requests, invites and approval ────────────────────────────────────────────

/**
 * A parent asks to be connected to a named child (the primary, parent-initiated on-ramp).
 *
 * The player name is stored as TYPED and matched by the coach by hand — never matched
 * automatically, and never echoed back. This function deliberately does not look the name up:
 * a response that varied by whether the name matched would turn the request form into a
 * roster oracle, which is exactly what owner ruling #3 forbids.
 */
export async function requestGuardianLink(params: {
  orgId: string;
  repTeamId: string;
  userId: string;
  email: string;
  /** FULL name — see the note below on why both parts are required. */
  playerFirstName: string;
  playerLastName: string;
  relationship: string | null;
  ageBand: GuardianAgeBand;
  consentIp: string | null;
  consentText: string;
}): Promise<FamilyLink['status']> {
  assertEnabled();

  const email = normalizeGuardianEmail(params.email);
  if (!email) throw new FamilyLinkError('not_found', 'A valid email address is required.');

  // BOTH parts are required (owner, 2026-08-01). The first-name-only version was
  // data-minimization applied to the wrong side of the exchange: minimization governs what we
  // DISCLOSE, and this form discloses nothing — the parent is typing their own child's name,
  // not selecting from anything we showed them. What it costs is real: on a team with two
  // Mayas, the coach approving a request is being asked to guess which child an adult belongs
  // to, which is the single decision in this flow that must not be a guess.
  const first = params.playerFirstName.trim().slice(0, 60);
  const last = params.playerLastName.trim().slice(0, 60);
  if (!first) throw new FamilyLinkError('not_found', 'A player’s first name is required.');
  if (!last) throw new FamilyLinkError('not_found', 'A player’s last name is required.');
  const playerName = `${first} ${last}`;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('family_links')
    .select('id, status')
    .eq('rep_team_id', params.repTeamId)
    .eq('invited_email', email)
    .eq('role', 'guardian')
    .not('status', 'in', '("declined","revoked")')
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const status = (existing as { status: string }).status;
    throw new FamilyLinkError(
      status === 'verified' ? 'already_connected' : 'already_requested',
      status === 'verified'
        ? 'You’re already connected to this team.'
        : 'Your request is already with the coach.',
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .insert({
      org_id: params.orgId,
      rep_team_id: params.repTeamId,
      role: 'guardian',
      // NULL until the coach attaches the roster row at approval. The DB CHECK requires a
      // guardian to have a player_id, so this row is created as `requested` with the name
      // only — see the note on `attachPlayerAtApproval` for why that is safe.
      player_id: null,
      user_id: params.userId,
      invited_email: email,
      relationship: params.relationship,
      requested_player_name: playerName,
      status: 'requested',
      consent_recorded_at: now,
      consent_ip: params.consentIp,
    })
    .select('id, status')
    .single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new FamilyLinkError('already_requested', 'Your request is already with the coach.');
    }
    throw error;
  }

  // The consent ledger row lands with the request, not at approval: the parent consented
  // when they ticked the boxes, and a record dated to someone else's later decision would
  // misstate when consent was actually given.
  await recordGuardianConsent({
    orgId: params.orgId,
    userId: params.userId,
    email,
    consentIp: params.consentIp,
    consentText: params.consentText,
    ageBand: params.ageBand,
    sourceLinkId: (data as { id: string }).id,
  });

  return (data as { status: FamilyLink['status'] }).status;
}

/** Write the consent evidence. Separate function so the wording that counsel returns has one
 *  place to land, and so a future flow can record consent without duplicating the shape. */
export async function recordGuardianConsent(params: {
  orgId: string;
  userId: string | null;
  email: string;
  consentIp: string | null;
  consentText: string;
  ageBand: GuardianAgeBand;
  /** The family_links row this consent was given for. Part of the uniqueness key (mig 217) so
   *  a parent consenting for a SECOND child in the same org gets a second record instead of
   *  silently colliding with the first. */
  sourceLinkId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('family_consents')
    .upsert(
      {
        org_id: params.orgId,
        guardian_email: params.email,
        user_id: params.userId,
        basis: 'express_link',
        basis_started_at: new Date().toISOString(),
        scope: 'child_data',
        source_table: 'family_links',
        source_id: params.sourceLinkId,
        consent_ip: params.consentIp,
        consent_text: params.consentText,
        // Quebec's under-14 threshold is the reason this is stored rather than inferred.
        jurisdiction: params.ageBand === 'under_14_qc' ? 'QC' : null,
      },
      { onConflict: 'org_id,guardian_email,basis,scope,source_id', ignoreDuplicates: true },
    );
  // A consent we failed to record is a consent we cannot prove — surface it rather than
  // letting the link exist without its evidence.
  if (error) throw error;
}

/**
 * The coach approves a guardian request and ATTACHES it to a roster row.
 *
 * The player id comes from the COACH's choice on their own screen, never from the requester —
 * which is what keeps the typed name an unverified hint rather than a selector. Approving is
 * also where the cap is enforced, because that is the moment a link becomes real.
 */
export async function approveGuardianLink(params: {
  linkId: string;
  repTeamId: string;
  playerId: string;
  approvedByUserId: string;
}): Promise<void> {
  assertEnabled();

  // The player must belong to THIS team — a playerId from another team can never be attached.
  // Independent of the cap check, so both run together.
  const [, playerResult] = await Promise.all([
    assertUnderGuardianCap(params.playerId),
    supabaseAdmin.from('rep_roster_players')
      .select('id, team_id').eq('id', params.playerId).eq('team_id', params.repTeamId).maybeSingle(),
  ]);
  if (playerResult.error) throw playerResult.error;
  if (!playerResult.data) throw new FamilyLinkError('not_found', 'That player is not on this team.');

  const { data, error } = await supabaseAdmin
    .from('family_links')
    .update({
      status: 'verified',
      verified_via: 'coach_approved',
      player_id: params.playerId,
      approved_at: new Date().toISOString(),
      approved_by_user_id: params.approvedByUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.linkId)
    .eq('rep_team_id', params.repTeamId)
    .eq('role', 'guardian')
    // NOT 'invited': that row is waiting for the PARENT to claim the emailed link. Approving
    // it would mint a verified guardian with no account attached — unusable by anyone, holding
    // one of the two cap slots forever, and it would brick the genuine claim (which requires
    // the row to still be 'invited').
    .in('status', ['requested', 'pending_approval'])
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FamilyLinkError('not_found', 'That request is no longer waiting.');
}

/**
 * The coach invites a guardian directly, to a specific player, at a specific address.
 *
 * This is the on-ramp that carries the SAME trust as today's behaviour: the coach chose the
 * address, it is already on the player's row, and it already receives team email. So a claim
 * from a session verified as that exact address needs no second approval — the invite WAS the
 * approval (the assistant-invite flow's established model, amended ruling #14).
 */
export async function inviteGuardian(params: {
  orgId: string;
  repTeamId: string;
  playerId: string;
  email: string;
  invitedByUserId: string;
}): Promise<{ token: string }> {
  assertEnabled();

  const email = normalizeGuardianEmail(params.email);
  if (!email) throw new FamilyLinkError('not_found', 'A valid email address is required.');

  const live = await countLiveGuardians(params.playerId);
  if (live >= MAX_GUARDIANS_PER_PLAYER) {
    throw new FamilyLinkError(
      'ceiling_reached',
      `This player already has ${MAX_GUARDIANS_PER_PLAYER} connected guardians.`,
    );
  }

  const { data: player, error: playerError } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, team_id')
    .eq('id', params.playerId)
    .eq('team_id', params.repTeamId)
    .maybeSingle();
  if (playerError) throw playerError;
  if (!player) throw new FamilyLinkError('not_found', 'That player is not on this team.');

  const token = generateNoLoginToken();
  const { error } = await supabaseAdmin
    .from('family_links')
    .insert({
      org_id: params.orgId,
      rep_team_id: params.repTeamId,
      role: 'guardian',
      player_id: params.playerId,
      invited_email: email,
      status: 'invited',
      claim_token_hash: hashNoLoginToken(token),
      // 14 days: long enough for a parent who checks email weekly, short enough that a
      // forwarded invite does not stay live for a season.
      claim_expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      invited_by_user_id: params.invitedByUserId,
    });
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new FamilyLinkError('already_requested', 'That address already has a connection to this player.');
    }
    throw error;
  }
  return { token };
}

/**
 * Claim a coach-sent invite.
 *
 * Verifies WITHOUT a second approval only when the claiming session's email equals the address
 * the coach invited. A mismatch does not fail — it downgrades to a normal queued request, so a
 * parent who signs up with a different address than the coach had on file still gets in, just
 * with the coach's eyes on it. That is the honest handling of the most common real-world case.
 */
export async function claimGuardianInvite(params: {
  token: string;
  userId: string;
  userEmail: string;
  /** Consent is captured HERE, not at invite time. The coach sending an invite is not the
   *  parent agreeing to anything — only the person claiming it can consent, and this is the
   *  moment they act. Without this the invite on-ramp produced verified guardians with NO
   *  consent record at all, which is precisely the evidence the counsel packet promises. */
  ageBand: GuardianAgeBand;
  consentIp: string | null;
}): Promise<{ status: 'verified' | 'pending_approval'; repTeamId: string } | null> {
  assertEnabled();

  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select('id, org_id, rep_team_id, invited_email, claim_expires_at, status')
    .eq('claim_token_hash', hashNoLoginToken(params.token))
    .eq('role', 'guardian')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const link = data as {
    id: string; org_id: string; rep_team_id: string;
    invited_email: string; claim_expires_at: string | null; status: string;
  };
  if (link.status !== 'invited') return null;
  if (link.claim_expires_at && new Date(link.claim_expires_at).getTime() < Date.now()) return null;

  const claimant = normalizeGuardianEmail(params.userEmail);
  const exactMatch = !!claimant && claimant === link.invited_email;

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('family_links')
    .update({
      user_id: params.userId,
      // ⚠ The address the claimant ACTUALLY holds, recorded on every claim (mig 220).
      // `invited_email` is the address the COACH typed and never changes — so without this,
      // a mismatched claim reached the approval queue carrying no trace of the mismatch, and
      // the coach adjudicated blind. Evidence for that decision; never authorization.
      claimed_email: claimant,
      status: exactMatch ? 'verified' : 'pending_approval',
      verified_via: exactMatch ? 'email_match' : null,
      approved_at: exactMatch ? now : null,
      consent_recorded_at: now,
      consent_ip: params.consentIp,
      // The token dies on claim either way — one invite, one use.
      claim_token_hash: null,
      updated_at: now,
    })
    .eq('id', link.id);
  if (updateError) throw updateError;

  // The ledger row, on the SAME on-ramp the request path writes one. This is what closes the
  // gap where an invited guardian became verified with no consent evidence behind them.
  const orgName = await orgNameFor(link.org_id);
  await recordGuardianConsent({
    orgId: link.org_id,
    userId: params.userId,
    email: normalizeGuardianEmail(params.userEmail) ?? link.invited_email,
    consentIp: params.consentIp,
    consentText: guardianConsentText(orgName),
    ageBand: params.ageBand,
    sourceLinkId: link.id,
  });

  return { status: exactMatch ? 'verified' : 'pending_approval', repTeamId: link.rep_team_id };
}

/** The org's display name, for the consent text a family actually agreed to. Falls back to a
 *  neutral phrase rather than failing the claim — but the consent record then says so. */
async function orgNameFor(orgId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();
  return (data as { name?: string } | null)?.name ?? 'this organization';
}

export const GUARDIAN_CAP_MESSAGE =
  `This player already has ${MAX_GUARDIANS_PER_PLAYER} connected guardians. Remove one before adding another.`;

/** Turn the mig-217 trigger's refusal into the same message the app-level check gives, so a
 *  coach who loses a race sees an explanation rather than a 500. */
export function isGuardianCapViolation(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return message.includes('guardian_cap_reached');
}

/** The app-level check — it produces the friendly message. The mig-217 TRIGGER is what makes
 *  the limit actually TRUE under concurrency, because count-then-insert is two statements and
 *  two coaches approving at the same moment both read the same count. */
async function assertUnderGuardianCap(playerId: string): Promise<void> {
  if ((await countLiveGuardians(playerId)) >= MAX_GUARDIANS_PER_PLAYER) {
    throw new FamilyLinkError('ceiling_reached', GUARDIAN_CAP_MESSAGE);
  }
}

/**
 * A verified guardian invites the OTHER household's adult (ruling #17's two-household case).
 *
 * Scoped to their own player and their own cap. The coach sees the resulting link like any
 * other and can revoke it — the second household is first-class, not unsupervised.
 */
export async function inviteCoGuardian(params: {
  userId: string;
  repTeamId: string;
  email: string;
}): Promise<{ token: string }> {
  assertEnabled();

  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select('id, org_id, player_id')
    .eq('user_id', params.userId)
    .eq('rep_team_id', params.repTeamId)
    .eq('role', 'guardian')
    .eq('status', 'verified')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FamilyLinkError('not_found', 'You are not connected to a player on this team.');

  const own = data as { org_id: string; player_id: string | null };
  if (!own.player_id) throw new FamilyLinkError('not_found', 'Your connection is not attached to a player.');

  return inviteGuardian({
    orgId: own.org_id,
    repTeamId: params.repTeamId,
    playerId: own.player_id,
    email: params.email,
    invitedByUserId: params.userId,
  });
}
