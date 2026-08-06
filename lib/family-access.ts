import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { generateNoLoginToken, hashNoLoginToken } from './no-login-token';
import { normalizeGuardianEmail } from './guardian-email';
import { getTeamScopedRepTeamAccess, isTeamWorkspaceOrg } from './team-workspace-entitlements';
import type { Organization } from './types';

/**
 * lib/family-access.ts — the CONTROL plane for Chunk D's family layer.
 *
 * This module owns who may connect to a team and what the team's schedule is visible to.
 * It deliberately does NOT own what a connected family gets to read — that is
 * `lib/family-view.ts`, whose DTOs are allow-lists. Keeping the two apart is what makes
 * the tier boundary auditable: a reviewer can read one file to answer "who is in?" and a
 * different file to answer "what do they see?", and neither file can quietly answer both.
 *
 * Binding rules, all from the 2026-08-01 owner rulings:
 *   1. PREMIUM PORTALS ONLY. Every entry point runs through `assertFamilyLayerEnabled`.
 *   2. A FOLLOWER IS NEVER TIED TO A PLAYER. Enforced by CHECK in mig 215; this module
 *      never writes player_id on a follower row, and the read plane never widens one.
 *   3. PARENT-INITIATED, COACH-APPROVED. No public search. The link is the only door,
 *      and it hands the requester nothing from the roster.
 *   4. VISIBILITY IS ENFORCED AT THE API. `staff` is a server-side refusal, not a
 *      hidden button.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type FamilyRole = 'guardian' | 'follower';
export type FamilyLinkStatus =
  | 'requested' | 'invited' | 'pending_approval' | 'verified' | 'declined' | 'revoked';
export type ScheduleVisibility = 'staff' | 'families' | 'public_link';

export const SCHEDULE_VISIBILITIES: ScheduleVisibility[] = ['staff', 'families', 'public_link'];

/** Followers are uncapped as a PRODUCT matter (owner ruling #17) — this is an abuse
 *  ceiling only, and the copy that surfaces it must not read like a plan limit. */
export const FOLLOWER_SAFETY_CEILING = 50;

export interface FamilyLink {
  id: string;
  orgId: string;
  repTeamId: string;
  role: FamilyRole;
  playerId: string | null;
  userId: string | null;
  invitedEmail: string;
  relationship: string | null;
  status: FamilyLinkStatus;
  verifiedVia: 'email_match' | 'coach_approved' | 'registration_match' | null;
  requestedPlayerName: string | null;
  createdAt: string;
  approvedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
}

interface FamilyLinkRow {
  id: string;
  org_id: string;
  rep_team_id: string;
  role: FamilyRole;
  player_id: string | null;
  user_id: string | null;
  invited_email: string;
  relationship: string | null;
  status: FamilyLinkStatus;
  verified_via: FamilyLink['verifiedVia'];
  requested_player_name: string | null;
  created_at: string;
  approved_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
}

const LINK_COLUMNS =
  'id, org_id, rep_team_id, role, player_id, user_id, invited_email, relationship, status, ' +
  'verified_via, requested_player_name, created_at, approved_at, declined_at, revoked_at';

function mapLink(row: FamilyLinkRow): FamilyLink {
  return {
    id: row.id,
    orgId: row.org_id,
    repTeamId: row.rep_team_id,
    role: row.role,
    playerId: row.player_id,
    userId: row.user_id,
    invitedEmail: row.invited_email,
    relationship: row.relationship,
    status: row.status,
    verifiedVia: row.verified_via,
    requestedPlayerName: row.requested_player_name,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    declinedAt: row.declined_at,
    revokedAt: row.revoked_at,
  };
}

// ── The premium gate (strategy entry 2026-08-01 → /billing handoff) ────────────

/**
 * Is the family layer available for this rep team?
 *
 * A standalone Coaches-Portal team pays per team, so it needs a live team entitlement.
 * An org-native team (League / Club) is already covered by the org's own plan — the same
 * split every other team-scoped premium surface uses, so the family layer cannot drift
 * away from how the rest of the portal is gated.
 */
export async function isFamilyLayerEnabled(params: {
  org: Pick<Organization, 'id' | 'accountKind' | 'planId'>;
  repTeamId: string;
}): Promise<boolean> {
  const access = await getTeamScopedRepTeamAccess({
    orgId: params.org.id,
    repTeamId: params.repTeamId,
    skipEntitlementCheck: !isTeamWorkspaceOrg(params.org),
  });
  return access.allowed;
}

/**
 * Load the org AND run the premium gate in one step — the shape every family route wants.
 *
 * Returns null when the org is missing OR the team is not entitled, so a caller's single
 * `if (!org) return notFound()` covers both. Five routes previously wrote the two calls and
 * two guards by hand; each of those was a place a future route could copy the org lookup and
 * quietly drop the gate.
 */
export async function getEnabledFamilyOrg(orgId: string, repTeamId: string) {
  const org = await getOrgForGate(orgId);
  if (!org) return null;
  return (await isFamilyLayerEnabled({ org, repTeamId })) ? org : null;
}

/** Load the minimum org shape the gate needs, by id — the family/public routes resolve a
 *  team first and have no org context handed to them. */
export async function getOrgForGate(
  orgId: string,
): Promise<Pick<Organization, 'id' | 'accountKind' | 'planId'> & { name: string; slug: string; logoUrl: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, logo_url, account_kind, plan_id')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as {
    id: string; name: string; slug: string; logo_url: string | null;
    account_kind: Organization['accountKind']; plan_id: Organization['planId'];
  };
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    accountKind: row.account_kind,
    planId: row.plan_id,
  };
}

// ── The team's family access settings ──────────────────────────────────────────

export interface TeamFamilyAccess {
  repTeamId: string;
  orgId: string;
  teamName: string;
  teamSlug: string;
  scheduleVisibility: ScheduleVisibility;
  /** True once a link exists. The raw token is returned ONLY at mint time — everything
   *  afterwards knows a link exists without being able to reproduce it. */
  hasFamilyLink: boolean;
  familyLinkCreatedAt: string | null;
}

interface TeamRow {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  schedule_visibility: ScheduleVisibility | null;
  family_link_token_hash: string | null;
  family_link_created_at: string | null;
  family_calendar_token_hash: string | null;
}

const TEAM_COLUMNS =
  'id, org_id, name, slug, schedule_visibility, family_link_token_hash, family_link_created_at, family_calendar_token_hash';

/** `families` is the default for a row written before the column existed, matching the
 *  column default — a team must never silently fall to a MORE permissive setting. */
export function normalizeVisibility(value: string | null | undefined): ScheduleVisibility {
  return SCHEDULE_VISIBILITIES.includes(value as ScheduleVisibility)
    ? (value as ScheduleVisibility)
    : 'families';
}

/**
 * May a CONNECTED FAMILY see this team's schedule at all? The single home for the `staff`
 * rule (owner ruling #4).
 *
 * Exported rather than re-typed at each call site because it is a security-relevant
 * predicate with four readers already (the team view, the shared game view, the notifier,
 * and the calendar feed) and a fifth coming when push delivery is proven. Four hand-written
 * copies of `=== 'staff'` is four chances for the fifth to be written as `!== 'public_link'`.
 */
export function isVisibleToFamilies(value: string | null | undefined): boolean {
  return normalizeVisibility(value) !== 'staff';
}

/** Is this team's schedule readable with NO account at all? Only at `public_link`. */
export function isPubliclyVisible(value: string | null | undefined): boolean {
  return normalizeVisibility(value) === 'public_link';
}

function mapTeamRow(row: TeamRow): TeamFamilyAccess {
  return {
    repTeamId: row.id,
    orgId: row.org_id,
    teamName: row.name,
    teamSlug: row.slug,
    scheduleVisibility: normalizeVisibility(row.schedule_visibility),
    hasFamilyLink: !!row.family_link_token_hash,
    familyLinkCreatedAt: row.family_link_created_at,
  };
}

/** One team lookup, three keys. The three public resolvers below differ ONLY in which column
 *  they match on, and each previously carried its own copy of the select + the mapping. */
async function findTeam(column: 'id' | 'family_link_token_hash' | 'family_calendar_token_hash', value: string) {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select(TEAM_COLUMNS)
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTeamRow(data as TeamRow) : null;
}

export async function getTeamFamilyAccess(repTeamId: string): Promise<TeamFamilyAccess | null> {
  return findTeam('id', repTeamId);
}

/**
 * Mint (or re-mint) the team's family link. Resetting is the revocation: the old hash is
 * overwritten, so every copy of the previous URL dies at once — which is exactly what a
 * coach means when a link has spread further than they intended.
 *
 * Returns the RAW token. This is the only moment it exists outside the sharer's clipboard.
 */
export async function resetTeamFamilyLink(params: {
  repTeamId: string;
  userId: string;
}): Promise<string> {
  const token = generateNoLoginToken();
  const { error } = await supabaseAdmin
    .from('rep_teams')
    .update({
      family_link_token_hash: hashNoLoginToken(token),
      family_link_created_at: new Date().toISOString(),
      family_link_created_by: params.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.repTeamId);
  if (error) throw error;
  return token;
}

/** Resolve a family link token to its team. Returns null for an unknown token — callers
 *  must not distinguish "no such link" from "link was reset", because that difference is
 *  information a stranger holding a guessed URL should not receive. */
export async function resolveTeamByFamilyLinkToken(token: string): Promise<TeamFamilyAccess | null> {
  return findTeam('family_link_token_hash', hashNoLoginToken(token));
}

export async function setScheduleVisibility(params: {
  repTeamId: string;
  visibility: ScheduleVisibility;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_teams')
    .update({ schedule_visibility: params.visibility, updated_at: new Date().toISOString() })
    .eq('id', params.repTeamId);
  if (error) throw error;
}

/** The team-wide calendar token, minted lazily. It is only ever HANDED OUT at
 *  `public_link`, and the feed route re-checks visibility on every read — so a token
 *  minted while public keeps working only while the team stays public. */
export async function ensureTeamCalendarToken(repTeamId: string): Promise<string> {
  const token = generateNoLoginToken();
  const { error } = await supabaseAdmin
    .from('rep_teams')
    .update({ family_calendar_token_hash: hashNoLoginToken(token), updated_at: new Date().toISOString() })
    .eq('id', repTeamId);
  if (error) throw error;
  return token;
}

// ── Requests, approvals and revocation ─────────────────────────────────────────

export class FamilyLinkError extends Error {
  constructor(public code: 'already_requested' | 'already_connected' | 'ceiling_reached' | 'not_found', message: string) {
    super(message);
    this.name = 'FamilyLinkError';
  }
}

/**
 * A family member asks to follow the team. Parent-initiated; the coach decides.
 *
 * Slice 1 wires the FOLLOWER path only. The guardian path is blocked on the counsel
 * review, and this function refuses it rather than half-serving it — a guardian row
 * written without the consent-ledger wording the counsel packet is meant to settle
 * would be exactly the record we would later be unable to defend.
 */
export async function requestFamilyFollow(params: {
  orgId: string;
  repTeamId: string;
  userId: string;
  email: string;
  relationship: string | null;
}): Promise<FamilyLink> {
  const email = normalizeGuardianEmail(params.email);
  if (!email) throw new FamilyLinkError('not_found', 'A valid email address is required.');

  // Existing live link? Report it honestly instead of stacking duplicates the coach
  // then has to triage. The partial unique index is the backstop; this is the message.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('rep_team_id', params.repTeamId)
    .eq('invited_email', email)
    .eq('role', 'follower')
    .not('status', 'in', '("declined","revoked")')
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const row = mapLink(existing as unknown as FamilyLinkRow);
    throw new FamilyLinkError(
      row.status === 'verified' ? 'already_connected' : 'already_requested',
      row.status === 'verified'
        ? 'You are already connected to this team.'
        : 'Your request is already with the coach.',
    );
  }

  // Abuse ceiling, counted transactionally at the app layer — the unique index handles
  // duplicates, not totals.
  const { count, error: countError } = await supabaseAdmin
    .from('family_links')
    .select('id', { count: 'exact', head: true })
    .eq('rep_team_id', params.repTeamId)
    .eq('role', 'follower')
    .in('status', ['requested', 'pending_approval', 'verified']);
  if (countError) throw countError;
  if ((count ?? 0) >= FOLLOWER_SAFETY_CEILING) {
    throw new FamilyLinkError('ceiling_reached', 'This team has reached its follower limit. Please contact the coach.');
  }

  const { data, error } = await supabaseAdmin
    .from('family_links')
    .insert({
      org_id: params.orgId,
      rep_team_id: params.repTeamId,
      role: 'follower',
      player_id: null,               // structural, not incidental — see mig 215's CHECK
      user_id: params.userId,
      invited_email: email,
      relationship: params.relationship,
      status: 'requested',
    })
    .select(LINK_COLUMNS)
    .single();
  if (error) {
    // The check-above and this insert are two statements, so a double-submit can get both
    // past the duplicate check and let the partial unique index reject the second. Translate
    // that into the SAME friendly answer the check produces, rather than letting a raw
    // Postgres 23505 escape the route as a bare 500 — a parent tapping twice on a flaky
    // connection is the most likely person to hit it.
    if ((error as { code?: string }).code === '23505') {
      throw new FamilyLinkError('already_requested', 'Your request is already with the coach.');
    }
    throw error;
  }
  return mapLink(data as unknown as FamilyLinkRow);
}

/** Every link on a team, for the coach's panel. Requests first — they are the only rows
 *  that need a decision. */
export async function listTeamFamilyLinks(repTeamId: string): Promise<FamilyLink[]> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('rep_team_id', repTeamId)
    .not('status', 'in', '("declined","revoked")')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapLink(row as unknown as FamilyLinkRow));
}

/**
 * The normalised email addresses that hold a **live family connection** to this team — nothing else.
 *
 * ⚠ **THIS EXISTS SO A STAFF-SIDE CALLER NEVER HAS TO KNOW WHAT "connected" MEANS.** The owner
 * ruling of 2026-08-03 kept the staff record and the family record deliberately separate, and the
 * permitted bridge is a LABEL — "this address also follows the team" — computed by comparing
 * addresses and joining no data. The first cut of that label called `listTeamFamilyLinks` and used
 * every row it returned, which was wrong twice over: that function keeps **guardian** links as well
 * as followers, and keeps **`requested` / `invited` / `pending_approval`** as well as `verified`.
 * A parent still sitting in the coach's approval queue would have been reported as following the
 * team — and the removal dialog would have told the head coach they keep seeing the schedule, which
 * is false. That is the exact class of untrue sentence ruling D existed to delete.
 *
 * The role/status rule now lives HERE, beside the tier boundary it belongs to, rather than being
 * re-derived by every caller that wants a yes/no.
 *
 * ⚠ **BOTH ROLES, not just `follower`.** The first cut filtered `role = 'follower'`, mirroring the
 * coach-facing followers list — but that list answers a different question ("who is in the
 * followers section?"). This one answers "would removing this person from staff leave them still
 * seeing the team?", and a **verified guardian** keeps exactly that access:
 * `getVerifiedLinkForUserTeam` gates on `status` alone and never looks at role. Filtering guardians
 * out would hand back `false` for someone who genuinely stays connected — the same false sentence,
 * arriving through a different door the day `GUARDIAN_TIER_ENABLED` is switched on. Costs nothing
 * today (the guardian tier refuses every write while the flag is off) and is right in advance.
 *
 * `status = 'verified'` is the whole of the other half: `requested` / `pending_approval` are a
 * queue and grant nothing, `invited` is an unclaimed guardian invite with no account behind it,
 * and `declined` / `revoked` are over.
 *
 * ⚠ Returns EMAILS ONLY, deliberately: the caller gets no ids, no player links, no relationship
 * text, no role, nothing it could accidentally start joining on. Selects one column for the same
 * reason.
 */
export async function listVerifiedFamilyEmails(repTeamId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select('invited_email')
    .eq('rep_team_id', repTeamId)
    .eq('status', 'verified');
  if (error) throw error;
  const out = new Set<string>();
  for (const row of data ?? []) {
    const email = normalizeGuardianEmail((row as { invited_email: string | null }).invited_email);
    if (email) out.add(email);
  }
  return out;
}

export async function approveFamilyLink(params: {
  linkId: string;
  repTeamId: string;
  approvedByUserId: string;
  /** REQUIRED. Without it this function is role-blind, and a guardian row approved through
   *  the follower endpoint skips the consent record, the two-per-player cap AND the guardian
   *  feature switch — defeating the exact guarantee ("verified guardian ⇒ provable consent")
   *  the switch exists to protect. Every mutator below takes it for the same reason. */
  role: FamilyRole;
}): Promise<FamilyLink> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .update({
      status: 'verified',
      verified_via: 'coach_approved',
      approved_at: new Date().toISOString(),
      approved_by_user_id: params.approvedByUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.linkId)
    // Team scoping in the WHERE clause, not just the caller's head: a linkId from
    // another team can never be approved by this team's coach.
    .eq('rep_team_id', params.repTeamId)
    .eq('role', params.role)
    .in('status', ['requested', 'pending_approval', 'invited'])
    .select(LINK_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FamilyLinkError('not_found', 'That request is no longer waiting.');
  return mapLink(data as unknown as FamilyLinkRow);
}

export async function declineFamilyLink(params: {
  linkId: string;
  repTeamId: string;
  role: FamilyRole;
}): Promise<FamilyLink> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.linkId)
    .eq('rep_team_id', params.repTeamId)
    .eq('role', params.role)
    .in('status', ['requested', 'pending_approval', 'invited'])
    .select(LINK_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FamilyLinkError('not_found', 'That request is no longer waiting.');
  return mapLink(data as unknown as FamilyLinkRow);
}

/** Remove someone already connected. Their calendar token dies with the link — a
 *  revoked follower whose phone keeps refreshing a feed would be a revocation in name
 *  only. */
export async function revokeFamilyLink(params: {
  linkId: string;
  repTeamId: string;
  role: FamilyRole;
}): Promise<FamilyLink> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      calendar_token_hash: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.linkId)
    .eq('rep_team_id', params.repTeamId)
    .eq('role', params.role)
    .select(LINK_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FamilyLinkError('not_found', 'That connection no longer exists.');
  return mapLink(data as unknown as FamilyLinkRow);
}

// ── Reading a family's own links (the family side of the boundary) ─────────────

/** Every VERIFIED link this account holds. The single source for "which teams may this
 *  person see?" — no route is allowed to trust a team id from the client. */
export async function getVerifiedLinksForUser(userId: string): Promise<FamilyLink[]> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'verified')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapLink(row as unknown as FamilyLinkRow));
}

/** This account's verified link to ONE team, or null. Fails closed by construction:
 *  a caller that gets null has no business reading anything about the team. */
export async function getVerifiedLinkForUserTeam(
  userId: string,
  repTeamId: string,
): Promise<FamilyLink | null> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('user_id', userId)
    .eq('rep_team_id', repTeamId)
    .eq('status', 'verified')
    .maybeSingle();
  if (error) throw error;
  return data ? mapLink(data as unknown as FamilyLinkRow) : null;
}

/**
 * This account's OWN link to a team whatever its state — for telling a returning visitor
 * where they stand.
 *
 * Strictly self-regarding: it answers only about the calling user, so it is not a lookup
 * anyone can run about anyone else. Never use it for authorization — `verified` is the only
 * state that grants anything, and `getVerifiedLinkForUserTeam` is the gate.
 */
export async function getOwnLinkForUserTeam(
  userId: string,
  repTeamId: string,
): Promise<FamilyLink | null> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('user_id', userId)
    .eq('rep_team_id', repTeamId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapLink(data as unknown as FamilyLinkRow) : null;
}

/** Mint this family's own calendar token. Per family, not per team, so revoking one
 *  household's access does not disturb anyone else's calendar. */
export async function ensureFamilyCalendarToken(linkId: string): Promise<string> {
  const token = generateNoLoginToken();
  const { error } = await supabaseAdmin
    .from('family_links')
    .update({ calendar_token_hash: hashNoLoginToken(token), updated_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('status', 'verified');
  if (error) throw error;
  return token;
}

export async function resolveLinkByCalendarToken(token: string): Promise<FamilyLink | null> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('calendar_token_hash', hashNoLoginToken(token))
    .eq('status', 'verified')
    .maybeSingle();
  if (error) throw error;
  return data ? mapLink(data as unknown as FamilyLinkRow) : null;
}

export async function resolveTeamByCalendarToken(token: string): Promise<TeamFamilyAccess | null> {
  return findTeam('family_calendar_token_hash', hashNoLoginToken(token));
}

// ── Adoption metrics (1.13) ────────────────────────────────────────────────────

export interface FamilyAdoptionCounts {
  requested: number;
  verified: number;
  declined: number;
  revoked: number;
  /** Asked and never answered — a coach who never opens the queue is the failure mode
   *  this number exists to make visible. */
  awaiting: number;
}

/** Counted from the links themselves rather than a parallel counter table, so the
 *  numbers can never drift from the rows they describe. Scope to a team or an org. */
export async function getFamilyAdoptionCounts(scope: {
  orgId?: string;
  repTeamId?: string;
}): Promise<FamilyAdoptionCounts> {
  let query = supabaseAdmin.from('family_links').select('status, approved_at, declined_at, revoked_at');
  if (scope.repTeamId) query = query.eq('rep_team_id', scope.repTeamId);
  else if (scope.orgId) query = query.eq('org_id', scope.orgId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as { status: FamilyLinkStatus }[];
  return {
    requested: rows.length,
    verified: rows.filter(r => r.status === 'verified').length,
    declined: rows.filter(r => r.status === 'declined').length,
    revoked: rows.filter(r => r.status === 'revoked').length,
    awaiting: rows.filter(r => r.status === 'requested' || r.status === 'pending_approval').length,
  };
}

/**
 * Per-team family counts for the club's rep-teams list (Chunk D 3.6).
 *
 * Lives here, beside `getFamilyAdoptionCounts`, because "how many families are connected to
 * this team" is a WHO-IS-CONNECTED question and this file is the one place that answers those.
 * It is a sibling rather than a `getFamilyAdoptionCounts` option because it differs in both
 * axes that matter: it groups BY TEAM in one read (the club list would otherwise pay a query
 * per team), and it splits verified links by TIER, which the single-scope counts do not.
 *
 * Read-only aggregates, and no new PII surface: the club sees adoption, the coach keeps the
 * contacts. `connected` is summed HERE rather than by each caller — three separate hand-written
 * `guardians + followers` expressions is three chances for a future tier to be counted twice or
 * not at all.
 */
export interface TeamFamilyRollup {
  repTeamId: string;
  guardians: number;
  followers: number;
  /** guardians + followers — the number a club actually reads. */
  connected: number;
  awaiting: number;
}

export const EMPTY_TEAM_FAMILY_ROLLUP: Readonly<Omit<TeamFamilyRollup, 'repTeamId'>> = {
  guardians: 0, followers: 0, connected: 0, awaiting: 0,
};

export async function getOrgFamilyRollup(orgId: string): Promise<Map<string, TeamFamilyRollup>> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select('rep_team_id, role, status')
    .eq('org_id', orgId);
  if (error) throw error;

  const byTeam = new Map<string, TeamFamilyRollup>();
  for (const row of (data ?? []) as { rep_team_id: string; role: string; status: string }[]) {
    let entry = byTeam.get(row.rep_team_id);
    if (!entry) {
      entry = { repTeamId: row.rep_team_id, ...EMPTY_TEAM_FAMILY_ROLLUP };
      byTeam.set(row.rep_team_id, entry);
    }
    if (row.status === 'verified') {
      if (row.role === 'guardian') entry.guardians += 1;
      else entry.followers += 1;
      entry.connected += 1;
    } else if (row.status === 'requested' || row.status === 'pending_approval') {
      // The coach who never opens the queue is the failure mode this number makes visible to
      // the club — deliberately NOT split by tier, because "someone is waiting" is the point.
      entry.awaiting += 1;
    }
  }
  return byTeam;
}
