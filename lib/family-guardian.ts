import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { normalizeGuardianEmail } from './guardian-email';
import { FamilyLinkError, type FamilyLink } from './family-access';

/**
 * lib/family-guardian.ts — the GUARDIAN tier: a parent connected to one specific child.
 *
 * ⚠ SHIPPED SWITCHED OFF. `GUARDIAN_TIER_ENABLED` defaults to false and every entry point in
 * this module refuses while it is off — so no guardian link and no consent record can be
 * created, by the UI or by a direct API call, until it is deliberately turned on. This is
 * built ahead of real consent wording (counsel no longer gates it, owner 2026-11-04) so that switching on is a copy change and a flag
 * flip rather than a build; it is NOT a decision that the tier is ready.
 *
 * The owner's reasoning for building now (2026-08-01), recorded because it is a fair
 * correction to how this was first framed: a coach INVITING the guardian address already on
 * the roster is not a new trust decision — that address is already on the player row and
 * already receives team email and tryout offers. What IS new is the standing view of a
 * child's records a connected guardian receives, and that is what the consent questions
 * cover, and why this stays off by default.
 *
 * ⚠ STAGE 4a (2026-11-08): the invitation moved to lib/family-invitation.ts (one module owns who is invited, when, and what an
 * acceptance connects). This file keeps the switch, the cap, and the coach's view of a player's guardians. Gone with it: the
 * coach's approval queue for a claim from a different address (ruling 5: a different email is REFUSED), the parent-typed
 * "invite another adult" door (it broke "an invitation goes only to an address on the child's sign-up"), and the asked age band
 * (ruling 12).
 *
 * Guardian payloads live in their own DTOs (see `lib/family-guardian-view.ts`), never as a
 * widened team-level payload.
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

/** Refuse loudly rather than half-serving, so a caller cannot mistake "off" for "no match". The ONE check every Stage 4a entry
 *  point makes (lib/family-invitation.ts); while it is off nothing changes for anyone. */
export function assertGuardianTier() {
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
   * the coach invited (mig 220). Null on every other row — an outstanding invite nobody has
   * claimed, and a claim that matched.
   *
   * ⚠ This is the whole reason a mismatched claim is in the queue. Without it on screen the
   * coach is asked to adjudicate a mismatch they cannot see, which is a blind approval on a
   * surface granting standing access to a child's records. Evidence, never authorization.
   */
  claimedEmail: string | null;
}

const GUARDIAN_COLUMNS =
  'id, org_id, rep_team_id, role, child_id, player_id, user_id, invited_email, claimed_email, relationship, ' +
  'status, verified_via, created_at, approved_at';

interface GuardianRow {
  id: string;
  child_id: string;
  player_id: string | null;
  invited_email: string;
  claimed_email: string | null;
  relationship: string | null;
  status: FamilyLink['status'];
  verified_via: FamilyLink['verifiedVia'];
  created_at: string;
  approved_at: string | null;
}

/** A rep coach's open invitation, on the card as an invited row (Stage 4a: the invitation is its own record, mig 453). Its id
 *  carries this prefix so the card's Cancel invite reaches the invitation, not a link. */
export const INVITATION_ROW_PREFIX = 'inv:';

/**
 * Guardians for one team's players, grouped by player, with the roster-contact assist resolved: every live link of each child
 * (wherever it was made — a house-league parent of this player shows here too, Stage 4a ruling 3) and every open invitation the
 * coach sent for the entry.
 *
 * Returns an empty map while the tier is off — the coach's player page simply shows no
 * guardians card, rather than an empty one implying the feature exists.
 */
export async function getGuardiansByPlayer(
  repTeamId: string,
  programYearId: string,
): Promise<Map<string, PlayerGuardianRow[]>> {
  const out = new Map<string, PlayerGuardianRow[]>();
  if (!GUARDIAN_TIER_ENABLED) return out;

  // The guardian contact the COACH typed — the assist's other half.
  const { data: playerRows, error: playerError } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, child_id, guardian_email')
    .eq('team_id', repTeamId)
    .eq('program_year_id', programYearId)
    // ⚠ Not a call-up (mig 309): a borrowed player's parents are the home team's families, never this coach's.
    .neq('status', 'callup');
  if (playerError) throw playerError;
  const childIds = [...new Set((playerRows ?? []).map(p => (p as { child_id: string }).child_id))];
  const playerIds = (playerRows ?? []).map(p => (p as { id: string }).id);
  if (childIds.length === 0) return out;

  const [{ data: linkRows, error: linkError }, { data: inviteRows, error: inviteError }] = await Promise.all([
    supabaseAdmin
      .from('family_links')
      .select(GUARDIAN_COLUMNS)
      .in('child_id', childIds)
      .eq('role', 'guardian')
      // pending_approval: the coach's approval queue went in Stage 4a (ruling 5). Old rows are left, unreachable, and not shown.
      .not('status', 'in', '("declined","revoked","pending_approval")')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('family_invitations')
      .select('id, rep_player_id, email, created_at')
      .in('rep_player_id', playerIds)
      .eq('source', 'rep_coach')
      .is('used_at', null).is('cancelled_at', null).is('replaced_by', null)
      .order('created_at', { ascending: true }),
  ]);
  if (linkError) throw linkError;
  if (inviteError) throw inviteError;

  const rosterContact = new Map(
    (playerRows ?? []).map(p => [
      (p as { id: string }).id,
      normalizeGuardianEmail((p as { guardian_email: string | null }).guardian_email),
    ]),
  );
  // A link is the CHILD's (mig 445, Stage 14 S6): it is filed under that child's entry in THIS season, wherever the link was
  // first made. A child with no entry here (last season's team) has no card.
  const entryOfChild = new Map((playerRows ?? []).map(p => [(p as { child_id: string }).child_id, (p as { id: string }).id]));

  for (const raw of (linkRows ?? []) as unknown as GuardianRow[]) {
    // Every guardian row carries its child from the moment it is written (mig 445; before it, its player - mig 290's strict
    // CHECK). A child with no entry on this season's roster has no card here - never file it under another child.
    const entryId = entryOfChild.get(raw.child_id);
    if (!entryId) continue;
    const row: PlayerGuardianRow = {
      id: raw.id,
      email: raw.invited_email,
      relationship: raw.relationship,
      status: raw.status,
      verifiedVia: raw.verified_via,
      createdAt: raw.created_at,
      approvedAt: raw.approved_at,
      matchesRosterContact: rosterContact.get(entryId) === raw.invited_email,
      // Surfaced ONLY when it differs from the invited address. Repeating an identical address
      // twice on the row would be noise that trains the coach to stop reading it — and this is
      // the one line on the row that must survive being skimmed.
      claimedEmail: raw.claimed_email && raw.claimed_email !== raw.invited_email
        ? raw.claimed_email
        : null,
    };
    out.set(entryId, [...(out.get(entryId) ?? []), row]);
  }
  for (const inv of (inviteRows ?? []) as { id: string; rep_player_id: string; email: string; created_at: string }[]) {
    const rows = out.get(inv.rep_player_id) ?? [];
    // An address already on the card (an older link row) is one row, not two.
    if (rows.some(r => r.email === inv.email)) continue;
    rows.push({
      id: INVITATION_ROW_PREFIX + inv.id,
      email: inv.email,
      relationship: null,
      status: 'invited',
      verifiedVia: null,
      createdAt: inv.created_at,
      approvedAt: null,
      matchesRosterContact: rosterContact.get(inv.rep_player_id) === inv.email,
      claimedEmail: null,
    });
    out.set(inv.rep_player_id, rows);
  }
  return out;
}

export const GUARDIAN_CAP_MESSAGE =
  `This player already has ${MAX_GUARDIANS_PER_PLAYER} connected guardians. Remove one before adding another.`;

/** Turn the mig-217 trigger's refusal into the same message the app-level check gives, so a
 *  coach who loses a race sees an explanation rather than a 500. */
export function isGuardianCapViolation(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return message.includes('guardian_cap_reached');
}
