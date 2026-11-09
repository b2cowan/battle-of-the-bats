import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { effectiveOrgFactsOf } from './entitlement-grants';
import { DOOR_COLUMNS, type DoorRow } from './free-time';
import { hashNoLoginToken } from './no-login-token';
import { normalizeGuardianEmail } from './guardian-email';
import { getTeamScopedRepTeamAccess, isTeamWorkspaceOrg } from './team-workspace-entitlements';
import { isOrgBillingSuspended } from './org-billing-access';
import { fetchAllIn } from './supabase-paging';
import { reachedEntry, teamsReached, type ReachMode, type ReachedTeam, type TeamEntry } from './family-link-reach';
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
 *   1. PREMIUM PORTALS ONLY. Every entry point runs through `isFamilyLayerEnabled`.
 *   2. A CONNECTION IS ALWAYS TO A CHILD. Every family link is a guardian tied to one
 *      roster row (CHECK in mig 290); there is no team-level "follower" any more.
 *   3. COACH-INITIATED, COACH-APPROVED. No public search and no shareable team link —
 *      a guardian enters only through an invite the coach sends to the address already
 *      on the player's roster row.
 *   4. VISIBILITY IS ENFORCED AT THE API. `staff` is a server-side refusal, not a
 *      hidden button.
 *
 * ⚠ THE TEAM FAMILY LINK AND ITS FOLLOWERS WERE REMOVED 2026-09-12 (owner). A coach used to
 * mint one link, relatives asked to follow through it, and the coach approved each one. The
 * link, the join page, the follower role, the approval queue and the follower ceiling all
 * went together — a retired concept left half-alive in the schema is exactly the drift the
 * gates cannot see. Schedule visibility survived and now lives on Team settings.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** One role since 2026-09-12. Kept as a named type because the column, the CHECK and the
 *  DTO all still carry it, and a second tier would re-enter here rather than as a bare string. */
export type FamilyRole = 'guardian';
export type FamilyLinkStatus =
  | 'requested' | 'invited' | 'pending_approval' | 'verified' | 'declined' | 'revoked';
export type ScheduleVisibility = 'staff' | 'families' | 'public_link';

export const SCHEDULE_VISIBILITIES: ScheduleVisibility[] = ['staff', 'families', 'public_link'];

export type FamilyInvitedAs = 'first_parent' | 'second_parent' | 'rep_coach' | 'requested';
export type FamilyEndedBy = 'parent' | 'club' | 'coach' | 'stop' | 'merged';

export interface FamilyLink {
  id: string;
  orgId: string;
  /** The rep team a coach's invitation was MADE on (null on a house-league link, mig 453). On a link a reader got from
   *  `getVerifiedLinkForUserTeam`, the team asked about. Never what the link reaches: see `getFamilyReach`. */
  repTeamId: string | null;
  role: FamilyRole;
  /** The CHILD this link is for (mig 445, Stage 14 S6 - Ask 13). What the link reaches follows the child's live seasons. */
  childId: string;
  /** The roster entry the link was made on - and, on a link a reader got from `reachingLinks` / `getVerifiedLinkForUserTeam`,
   *  the entry it reaches NOW (the child's live entry on the team; the recap's: its newest closed). Never trust the stored one. */
  playerId: string | null;
  userId: string | null;
  invitedEmail: string;
  relationship: string | null;
  status: FamilyLinkStatus;
  verifiedVia: 'email_match' | 'coach_approved' | 'registration_match' | null;
  createdAt: string;
  approvedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
  /** How the connection was made (mig 453). Only `second_parent` is ever ended by a second-parent stop (CASL flag d). */
  invitedAs: FamilyInvitedAs;
  endedBy: FamilyEndedBy | null;
}

interface FamilyLinkRow {
  id: string;
  org_id: string;
  rep_team_id: string | null;
  role: FamilyRole;
  child_id: string;
  player_id: string | null;
  user_id: string | null;
  invited_email: string;
  relationship: string | null;
  status: FamilyLinkStatus;
  verified_via: FamilyLink['verifiedVia'];
  created_at: string;
  approved_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
  invited_as: FamilyInvitedAs;
  ended_by: FamilyEndedBy | null;
}

const LINK_COLUMNS =
  'id, org_id, rep_team_id, role, child_id, player_id, user_id, invited_email, relationship, status, ' +
  'verified_via, created_at, approved_at, declined_at, revoked_at, invited_as, ended_by';

function mapLink(row: FamilyLinkRow): FamilyLink {
  return {
    id: row.id,
    orgId: row.org_id,
    repTeamId: row.rep_team_id,
    role: row.role,
    childId: row.child_id,
    playerId: row.player_id,
    userId: row.user_id,
    invitedEmail: row.invited_email,
    relationship: row.relationship,
    status: row.status,
    verifiedVia: row.verified_via,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    declinedAt: row.declined_at,
    revokedAt: row.revoked_at,
    invitedAs: row.invited_as,
    endedBy: row.ended_by,
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
 *  team first and have no org context handed to them.
 *
 *  ⚠ Returns null for a CANCELLED org, and this is the chokepoint that makes that stick: every
 *  family surface (team page, schedule, calendar feed, join/claim, co-guardian, recap) resolves
 *  through here or through getEnabledFamilyOrg above, and none of them ride getAuthContext — they
 *  authenticate the guardian directly, so the main billing rail never sees them. Without this the
 *  family portal of a cancelled club keeps working forever, which is the exact defect the rail was
 *  built to close, just one door further along. Same shape as resolvePublicLeagueContext, which
 *  learned this in audit J3-068. (/review 2026-08-06.) */
export async function getOrgForGate(
  orgId: string,
): Promise<Pick<Organization, 'id' | 'accountKind' | 'planId'> & { name: string; slug: string; logoUrl: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select(`${DOOR_COLUMNS}, name, slug, logo_url, account_kind`)
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as DoorRow & {
    name: string; slug: string; logo_url: string | null;
    account_kind: Organization['accountKind'];
  };
  // The door's answer (free time included): a null status is a pre-billing org, not a cancelled one. Only
  // 'canceled' closes the door — past_due keeps working, exactly as it does everywhere else on the rail.
  const facts = await effectiveOrgFactsOf(row);
  if (isOrgBillingSuspended({ subscriptionStatus: facts.subscriptionStatus })) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    accountKind: row.account_kind,
    planId: facts.planId,
  };
}

// ── The team's family access settings ──────────────────────────────────────────

export interface TeamFamilyAccess {
  repTeamId: string;
  orgId: string;
  teamName: string;
  teamSlug: string;
  scheduleVisibility: ScheduleVisibility;
}

interface TeamRow {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  schedule_visibility: ScheduleVisibility | null;
}

/* ⚠ `family_calendar_token_hash` is not read here any more (Club Tier 6d, A6): the team-wide feed token it held was
   never handed out, and mig 324 drops the column — a select naming it would fail the day that migration applies. */
const TEAM_COLUMNS = 'id, org_id, name, slug, schedule_visibility';

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
 * predicate with three readers already (the team view, the notifier and the calendar feed)
 * and a fourth coming when push delivery is proven. Three hand-written
 * copies of `=== 'staff'` is three chances for the fourth to be written as `!== 'public_link'`.
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
  };
}

export async function getTeamFamilyAccess(repTeamId: string): Promise<TeamFamilyAccess | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select(TEAM_COLUMNS)
    .eq('id', repTeamId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTeamRow(data as TeamRow) : null;
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

/* ⚠ THE TEAM-WIDE CALENDAR TOKEN IS GONE (Club Tier 6d, A6 — D07). `ensureTeamCalendarToken` minted a NEW token on
   every call despite its name, so no page could show it without stopping every subscriber's feed on each visit
   (S6D-02), and it never had a caller. The team's public feed is the team page's own address now
   (`lib/public-team-schedule.ts`), with no secret and nothing to reset. */

// ── Requests, approvals and revocation ─────────────────────────────────────────

export class FamilyLinkError extends Error {
  /** `ceiling_reached` is the two-guardians-per-player cap (`MAX_GUARDIANS_PER_PLAYER`); the
   *  follower safety ceiling that once shared the code is gone. */
  constructor(public code: 'already_requested' | 'ceiling_reached' | 'not_found', message: string) {
    super(message);
    this.name = 'FamilyLinkError';
  }
}

/**
 * The normalised email addresses that hold a **live family connection** to this team — nothing else.
 *
 * ⚠ **THIS EXISTS SO A STAFF-SIDE CALLER NEVER HAS TO KNOW WHAT "connected" MEANS.** The owner
 * ruling of 2026-08-03 kept the staff record and the family record deliberately separate, and the
 * permitted bridge is a LABEL — "this address is also connected to the team as a family member" —
 * computed by comparing addresses and joining no data. The first cut used every family row on the
 * team, which reported a parent still sitting in the approval queue as connected — and the removal
 * dialog would have told the head coach they keep seeing the schedule, which is false. That is the
 * exact class of untrue sentence ruling D existed to delete, so the status rule lives HERE rather
 * than being re-derived by every caller that wants a yes/no.
 *
 * `status = 'verified'` is the whole rule: `requested` / `pending_approval` are a queue and grant
 * nothing, `invited` is an unclaimed guardian invite with no account behind it, and `declined` /
 * `revoked` are over. `getVerifiedLinkForUserTeam` gates on exactly the same thing.
 *
 * ⚠ Returns EMAILS ONLY, deliberately: the caller gets no ids, no player links, no relationship
 * text, no role, nothing it could accidentally start joining on. Selects one column for the same
 * reason.
 */
export async function listVerifiedFamilyEmails(repTeamId: string): Promise<Set<string>> {
  // Only a parent whose CHILD is on the team's live season is "a family of this team" (Stage 14 S6), wherever the link was made
  // (Stage 4a: a house-league parent of a rep player reaches the rep team too).
  const reaching = await verifiedLinksReachingRepTeam<{ invited_email: string | null }>(repTeamId, 'invited_email');
  const out = new Set<string>();
  for (const row of reaching) {
    const email = normalizeGuardianEmail(row.invited_email);
    if (email) out.add(email);
  }
  return out;
}

export async function declineFamilyLink(params: {
  linkId: string;
  repTeamId: string;
}): Promise<FamilyLink> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      ended_by: 'coach',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.linkId)
    // Team scoping in the WHERE clause, not just the caller's head: a linkId from another
    // team can never be declined by this team's coach.
    .eq('rep_team_id', params.repTeamId)
    .in('status', ['requested', 'pending_approval', 'invited'])
    .select(LINK_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FamilyLinkError('not_found', 'That request is no longer waiting.');
  return mapLink(data as unknown as FamilyLinkRow);
}

/** Remove someone already connected. Their calendar token dies with the link — a
 *  revoked guardian whose phone keeps refreshing a feed would be a revocation in name
 *  only. */
export async function revokeFamilyLink(params: {
  linkId: string;
  repTeamId: string;
}): Promise<FamilyLink> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      // (mig 453) A removed parent is never invited again automatically: only the club's Send again brings them back.
      ended_by: 'coach',
      calendar_token_hash: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.linkId)
    .eq('rep_team_id', params.repTeamId)
    .select(LINK_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FamilyLinkError('not_found', 'That connection no longer exists.');
  return mapLink(data as unknown as FamilyLinkRow);
}

// ── Reading a family's own links (the family side of the boundary) ─────────────

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A CONNECTION REACHES (Signed-in family accounts Stage 4a, ruling 3, owner 2026-11-08).
 * A link is to the CHILD, on every team in the club, house league and rep (mig 453 made it team-less). It reaches every team the
 * child is live on now (the pure rule: `teamsReached` in lib/family-link-reach.ts). `rep_team_id` on the row is only where a
 * coach's invitation was made; nothing here filters on it. Every family reader goes through these three:
 *   getFamilyReach(userId)                — the account's verified links, and the teams each reaches (the family pages).
 *   getVerifiedLinkForUserTeam(user, rep) — one rep team, fails closed (the rep team page, its recap, its co-routes).
 *   verifiedLinksReachingRepTeam(rep)     — the team side: the parents whose child is on the team (notify, labels).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** One verified connection and every team it reaches now. */
export interface FamilyReach {
  link: FamilyLink;
  teams: ReachedTeam[];
}

/** Every VERIFIED link this account holds, with the teams each reaches now. The single source for "which teams may this person
 *  see?" — no route is allowed to trust a team id from the client. A link that reaches nothing is still returned (the family
 *  page says "Not on a team right now"). */
export async function getFamilyReach(userId: string): Promise<FamilyReach[]> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'verified')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const links = (data ?? []).map(row => mapLink(row as unknown as FamilyLinkRow));
  if (links.length === 0) return [];
  const entries = await readChildTeamEntries(links.map(l => l.childId));
  return links.map(link => ({ link, teams: teamsReached(entries.get(link.childId) ?? []) }));
}

/** This account's verified link to ONE rep team, or null. Fails closed by construction:
 *  a caller that gets null has no business reading anything about the team. */
export async function getVerifiedLinkForUserTeam(
  userId: string,
  repTeamId: string,
  /** 'recap' reaches the child's newest CLOSED season (the end-of-season recap's door); the default reaches the live one. */
  mode: ReachMode = 'live',
): Promise<FamilyLink | null> {
  // A parent can hold a link per child (mig 445), made on any team or none (453), so this reads them all and takes the first whose
  // CHILD reaches the team now. The link comes back naming the team asked about and the entry it reaches.
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'verified')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const links = (data ?? []).map(row => ({ ...mapLink(row as unknown as FamilyLinkRow), repTeamId }));
  return (await reachingLinks(links, mode))[0] ?? null;
}

/**
 * The links whose CHILD reaches the rep team named on each - an entry on it in a live season (mode 'live') or, for the recap, a
 * closed one - each returned with `playerId` set to the entry it reaches. The one place "a parent link follows the child's
 * seasons" (Stage 14 S6, Ask 13) is applied for a rep team; the rule itself is pure (lib/family-link-reach.ts). Order is kept.
 * A link naming no team reaches nothing here.
 */
export async function reachingLinks<T extends { childId: string; repTeamId: string | null; playerId?: string | null }>(
  links: readonly T[],
  mode: ReachMode,
): Promise<T[]> {
  if (links.length === 0) return [];
  const byChild = await readChildTeamEntries(links.map(l => l.childId));
  const out: T[] = [];
  for (const l of links) {
    if (!l.repTeamId) continue;
    const onTeam = (byChild.get(l.childId) ?? []).filter(e => e.kind === 'rep' && e.teamId === l.repTeamId);
    const entry = reachedEntry(onTeam, mode);
    if (entry) out.push({ ...l, playerId: entry.id });
  }
  return out;
}

/**
 * The team side: verified links whose CHILD is on this rep team's live season, wherever the link was made. `columns` are extra
 * family_links columns the caller needs (keep it to what it uses). Bounded by the team's roster and two guardians per child.
 */
export async function verifiedLinksReachingRepTeam<T extends object>(
  repTeamId: string,
  columns: string,
): Promise<(T & { child_id: string; childId: string; repTeamId: string; playerId: string | null })[]> {
  const { data: roster, error: rosterError } = await supabaseAdmin
    .from('rep_roster_players').select('child_id').eq('team_id', repTeamId).neq('status', 'callup');
  if (rosterError) throw rosterError;
  const childIds = [...new Set((roster ?? []).map(r => (r as { child_id: string }).child_id))];
  if (childIds.length === 0) return [];
  const rows = await fetchAllIn<T & { id: string; child_id: string }>(
    childIds,
    (chunk, from, to) => supabaseAdmin.from('family_links')
      .select(`id, child_id, ${columns}`).in('child_id', chunk).eq('status', 'verified').order('id').range(from, to),
  );
  return reachingLinks(rows.map(r => ({ ...r, childId: r.child_id, repTeamId, playerId: null as string | null })), 'live');
}

type YearRel = { status: string; year: number; created_at: string };
type LeagueSeasonRel = { status: string; created_at: string; season_start_date: string | null };
type DivisionRel = { teams_published_at: string | null };
const one = <X>(v: X | X[] | null): X | null => (Array.isArray(v) ? v[0] ?? null : v);

/**
 * Each child's entries on every team, of both kinds, with their season (Stage 4a):
 *   rep    — non-call-up roster entries (a call-up never reaches a team);
 *   league — ACCEPTED sign-ups placed on a team, with the division's teams-published mark (the draft board sets the team first).
 * Whether an entry reaches its team is the pure rule's decision (`teamsReached` / `reachedEntry`), not this read's.
 */
async function readChildTeamEntries(childIds: readonly string[]): Promise<Map<string, TeamEntry[]>> {
  const ids = [...new Set(childIds)];
  const [repRows, leagueRows] = await Promise.all([
    fetchAllIn<{ id: string; child_id: string; team_id: string; rep_program_years: YearRel | YearRel[] | null }>(
      ids,
      (chunk, from, to) => supabaseAdmin.from('rep_roster_players')
        .select('id, child_id, team_id, rep_program_years(status, year, created_at)')
        .in('child_id', chunk).neq('status', 'callup').order('id').range(from, to),
    ),
    fetchAllIn<{
      id: string; child_id: string; team_id: string;
      league_seasons: LeagueSeasonRel | LeagueSeasonRel[] | null; league_divisions: DivisionRel | DivisionRel[] | null;
    }>(
      ids,
      (chunk, from, to) => supabaseAdmin.from('league_registrations')
        .select('id, child_id, team_id, league_seasons(status, created_at, season_start_date), league_divisions(teams_published_at)')
        .in('child_id', chunk).eq('status', 'active').not('team_id', 'is', null).order('id').range(from, to),
    ),
  ]);
  const out = new Map<string, TeamEntry[]>();
  const add = (childId: string, e: TeamEntry) => {
    const list = out.get(childId);
    if (list) list.push(e); else out.set(childId, [e]);
  };
  for (const r of repRows) {
    const y = one(r.rep_program_years);
    if (!y) continue;
    add(r.child_id, {
      id: r.id, kind: 'rep', teamId: r.team_id, published: true,
      seasonStatus: y.status, seasonYear: Number(y.year), seasonCreatedAt: y.created_at,
    });
  }
  for (const r of leagueRows) {
    const s = one(r.league_seasons);
    if (!s) continue;
    add(r.child_id, {
      id: r.id, kind: 'league', teamId: r.team_id, published: !!one(r.league_divisions)?.teams_published_at,
      seasonStatus: s.status,
      seasonYear: Number((s.season_start_date ?? s.created_at).slice(0, 4)),
      seasonCreatedAt: s.created_at,
    });
  }
  return out;
}

/** A good token still names its link after the child's season on the team has closed: `reaches` says whether the feed has
 *  anything to serve. (A closed season's feed is an EMPTY calendar - as it always was - not a refusal that counts against the
 *  abuse ceiling every family behind a calendar company's server shares.) */
export async function resolveLinkByCalendarToken(token: string): Promise<(FamilyLink & { reaches: boolean }) | null> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select(LINK_COLUMNS)
    .eq('calendar_token_hash', hashNoLoginToken(token))
    .eq('status', 'verified')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // A calendar feed stops with the child's season on the team (Stage 14 S6).
  const link = mapLink(data as unknown as FamilyLinkRow);
  const reached = (await reachingLinks([link], 'live'))[0];
  return { ...(reached ?? link), reaches: !!reached };
}

// ── Adoption counts for the club (Chunk D 3.6) ─────────────────────────────────

/**
 * Per-team family counts for the club's rep-teams list.
 *
 * Lives here because "how many families are connected to this team" is a WHO-IS-CONNECTED
 * question and this file is the one place that answers those. Groups BY TEAM in one read —
 * the club list would otherwise pay a query per team.
 *
 * Read-only aggregates, and no new PII surface: the club sees adoption, the coach keeps the
 * contacts. `connected` is counted HERE rather than by each caller, so a second tier (if one
 * ever returns) is counted in exactly one place.
 */
export interface TeamFamilyRollup {
  repTeamId: string;
  /** Verified guardians — the number a club actually reads. */
  connected: number;
  awaiting: number;
}

export const EMPTY_TEAM_FAMILY_ROLLUP: Readonly<Omit<TeamFamilyRollup, 'repTeamId'>> = {
  connected: 0, awaiting: 0,
};

export async function getOrgFamilyRollup(orgId: string): Promise<Map<string, TeamFamilyRollup>> {
  const { data, error } = await supabaseAdmin
    .from('family_links')
    .select('rep_team_id, status, child_id')
    .eq('org_id', orgId);
  if (error) throw error;
  const raw = (data ?? []) as { rep_team_id: string | null; status: string; child_id: string }[];

  const byTeam = new Map<string, TeamFamilyRollup>();
  const bump = (repTeamId: string, key: 'connected' | 'awaiting') => {
    let entry = byTeam.get(repTeamId);
    if (!entry) {
      entry = { repTeamId, ...EMPTY_TEAM_FAMILY_ROLLUP };
      byTeam.set(repTeamId, entry);
    }
    entry[key] += 1;
  };

  // A verified parent counts as CONNECTED on every rep team their child is live on (Stage 14 S6; Stage 4a: wherever the link was
  // made, house league included).
  const verified = raw.filter(r => r.status === 'verified');
  if (verified.length > 0) {
    const entries = await readChildTeamEntries(verified.map(r => r.child_id));
    for (const r of verified) {
      for (const t of teamsReached(entries.get(r.child_id) ?? [])) if (t.kind === 'rep') bump(t.teamId, 'connected');
    }
  }
  // An old ask still waiting is counted where it was made (the coach's approval queue went in Stage 4a, ruling 5; no new row
  // reaches 'pending_approval').
  for (const r of raw) {
    if (r.rep_team_id && (r.status === 'requested' || r.status === 'pending_approval')) bump(r.rep_team_id, 'awaiting');
  }
  return byTeam;
}
