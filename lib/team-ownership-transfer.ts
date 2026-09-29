import 'server-only';

import { writePlatformEvent } from './platform-events';
import { isStripeConfigured } from './billing-mock';
import { stripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import {
  ACTIVE_LINK_STATUSES,
  findCoachOwnTeamByEmail,
  findLinkableOrg,
  getTeamOrgLinkRow,
  getTeamOrgLinkSummary,
  isTeamWorkspaceOrgRow,
  type TeamOrgLinkRow,
  type TeamOrgLinkSummary,
} from './team-org-links';
import { askedByOf } from './team-move-state';
import { PLAN_CONFIG, getEffectiveTeamLimit } from './plan-config';
import { getNonArchivedRepTeamCount, getOrgMemberDisplayNames } from './db';
import { listActiveStaffUserIds } from './coach-membership';
import { notify } from './notify';
import { captureError } from './observability/capture';
import {
  REFUSAL,
  bellClubAsked,
  bellClubDeclined,
  bellCoachAsked,
  bellCoachDeclined,
  bellMovedForClub,
  bellMovedForStaff,
  teamNameConfirmed,
} from './team-move-words';
import type { OrgPlan } from './types';
import type { TeamWorkspace } from './team-workspace-entitlements';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BRINGING A COACH'S OWN TEAM INTO A CLUB — the write side (Club Tier Stage 2, B04 / Ask 2; owner
 * ruling 2026-09-28: "finish it").
 *
 * A request, asked by EITHER side, and answered by the other:
 *   ask      → one `team_org_links` row, `ownership_pending`, the asker's yes recorded;
 *   approve  → THE SECOND YES MOVES THE TEAM. `move_team_into_club` (mig 313) records that yes and
 *              moves every team table in one transaction — there is no FieldLogicHQ step, and no
 *              state where both sides said yes and nothing moved;
 *   decline  → the answering side says no (`declined`);
 *   withdraw → the asking side takes it back (`revoked`).
 * No "Basic visibility" link first (retired, B12): a request is the only thing a coach and a club
 * agree to.
 *
 * Safety kept from the operator step it replaces: a TYPED confirmation from the approving side (the
 * team's name, checked HERE, server-side, so a crafted request cannot skip it); the plan and
 * team-place checks (the place re-counted under the club's lock inside the move); idempotency (a
 * second click answers "already moved"); and the audit + platform events.
 *
 * ⚖ The coach's own subscription (owner 2026-09-28): cancelled the moment the move completes, with
 * no refund and no proration — today's behaviour. ⚠ Cancelled AFTER the move commits: the move
 * clears the Stripe ids first, so the `customer.subscription.deleted` webhook finds no workspace and
 * sends no "your Coaches Portal has been cancelled" email. A cancel that fails does not undo the
 * move; it is reported to FieldLogicHQ (error dashboard + platform event) to cancel by hand.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type TeamMoveSide = 'club' | 'coach';

export type TeamMoveRefusalCode =
  | 'team_limit_reached'
  | 'no_own_team'
  | 'not_waiting'
  | 'confirm_mismatch'
  | 'open_tournament'
  | 'already_moved';

export type TeamMoveRefusal = {
  ok: false;
  status: number;
  error: string;
  code?: TeamMoveRefusalCode;
  /** With `team_limit_reached`: what the club's team-cap window needs. */
  cap?: { planId: OrgPlan; teamLimit: number; activeTeams: number };
};

export type TeamMoveAskResult =
  | { ok: true; link: TeamOrgLinkSummary; reusedExisting: boolean }
  | TeamMoveRefusal;

export type TeamMoveAnswerResult =
  | { ok: true; link: TeamOrgLinkSummary | null }
  | TeamMoveRefusal;

export type TeamMoved = {
  alreadyMoved: boolean;
  teamId: string;
  teamName: string | null;
  teamSlug: string | null;
  slugChanged: boolean;
  clubSlug: string | null;
  clubName: string | null;
};

export type TeamMoveApproveResult =
  | {
      ok: true;
      moved: TeamMoved;
      stripeCancellation: 'not_needed' | 'cancelled' | 'failed';
    }
  | TeamMoveRefusal;

type ClubOrgRow = {
  id: string;
  name: string;
  slug: string;
  plan_id: string | null;
  enabled_addons: unknown;
  account_kind: string | null;
  team_limit: number | null;
};

type WorkspaceRow = {
  id: string;
  workspace_org_id: string;
  rep_team_id: string;
  workspace_state: string;
  stripe_subscription_id: string | null;
};

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────────

async function fetchClubOrg(orgId: string): Promise<ClubOrgRow | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, enabled_addons, account_kind, team_limit')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  return (data as ClubOrgRow | null) ?? null;
}

async function fetchWorkspaceRow(workspaceId: string): Promise<WorkspaceRow | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, workspace_state, stripe_subscription_id')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data as WorkspaceRow | null) ?? null;
}

async function fetchNamed(table: 'organizations' | 'rep_teams', id: string): Promise<{ name: string; slug: string | null } | null> {
  const { data, error } = await supabaseAdmin.from(table).select('name, slug').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as { name: string; slug: string | null } | null) ?? null;
}

function clubHasRepTeams(org: Pick<ClubOrgRow, 'plan_id' | 'enabled_addons'>): boolean {
  // Plan-config-driven (Club Repackaging): any plan whose tier carries module_rep_teams qualifies —
  // both Club bands and any future one — with the per-org add-on as the non-tier grant.
  const planModules = PLAN_CONFIG[org.plan_id as OrgPlan]?.moduleEntitlements ?? [];
  return planModules.includes('module_rep_teams')
    || (Array.isArray(org.enabled_addons) && org.enabled_addons.includes('module_rep_teams'));
}

/** The club's team places: its effective cap (null = uncapped) and the teams using them now. */
export async function clubTeamPlaces(org: Pick<ClubOrgRow, 'id' | 'plan_id' | 'team_limit'>): Promise<{
  planId: OrgPlan;
  limit: number | null;
  used: number;
}> {
  const planId = (org.plan_id ?? 'tournament') as OrgPlan;
  const cap = getEffectiveTeamLimit(planId, org.team_limit);
  return { planId, limit: cap < 9999 ? cap : null, used: await getNonArchivedRepTeamCount(org.id) };
}

async function atCapRefusal(org: ClubOrgRow): Promise<TeamMoveRefusal | null> {
  const places = await clubTeamPlaces(org);
  if (places.limit == null || places.used < places.limit) return null;
  return {
    ok: false,
    status: 409,
    error: `You've reached your plan's limit of ${places.limit} teams.`,
    code: 'team_limit_reached',
    cap: { planId: places.planId, teamLimit: places.limit, activeTeams: places.used },
  };
}

// ── Recipients (explicit — a club bell without `userIds` would reach every coach in the club) ────

async function clubAdminUserIds(orgId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin']);
  if (error) throw error;
  return [...new Set(((data ?? []) as Array<{ user_id: string }>).map(r => r.user_id))];
}

async function coachDisplayName(workspaceOrgId: string, userId: string, fallback: string | null): Promise<string> {
  const names = await getOrgMemberDisplayNames(workspaceOrgId, [userId]).catch(() => ({} as Record<string, string>));
  return names[userId] ?? fallback ?? 'The coach';
}

/** A bell is best-effort by design: the request or the move already landed. */
async function bell(p: Parameters<typeof notify>[0]): Promise<void> {
  if (!p.userIds || p.userIds.length === 0) return;
  try {
    await notify(p);
  } catch (e) {
    console.error('[team-move] bell failed (the change landed):', e);
  }
}

// ── The record ────────────────────────────────────────────────────────────────────────────────────

async function writeOrgAudit(orgId: string, actorId: string, targetId: string, action: string, payload: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('org_audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    target_id: targetId,
    action,
    payload,
  });
  if (error) console.error('[team-move] audit write error:', error);
}

async function recordBothSides(p: {
  link: Pick<TeamOrgLinkRow, 'id' | 'linked_org_id' | 'team_workspace_id' | 'rep_team_id'>;
  workspaceOrgId: string;
  actorUserId: string;
  actorEmail: string | null;
  auditAction: string;
  eventType: Parameters<typeof writePlatformEvent>[0]['eventType'];
  eventOrgId: string;
  extra?: Record<string, unknown>;
}) {
  const base = { teamWorkspaceId: p.link.team_workspace_id, repTeamId: p.link.rep_team_id, ...p.extra };
  await Promise.all([
    writeOrgAudit(p.link.linked_org_id, p.actorUserId, p.link.id, p.auditAction, { workspaceOrgId: p.workspaceOrgId, ...base }),
    writeOrgAudit(p.workspaceOrgId, p.actorUserId, p.link.id, p.auditAction, { linkedOrgId: p.link.linked_org_id, ...base }),
    writePlatformEvent({
      eventType: p.eventType,
      source: 'app',
      orgId: p.eventOrgId,
      actorUserId: p.actorUserId,
      actorEmail: p.actorEmail,
      planId: 'team',
      metadata: { linkId: p.link.id, linkedOrgId: p.link.linked_org_id, workspaceOrgId: p.workspaceOrgId, ...base },
    }),
  ]);
}

// ── Ask ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * The one place a new request is written, from either side. An existing row between this team and
 * this club is REUSED (the unique index allows one live row per pair): an open request is answered
 * as "already asked"; a retired basic-link row becomes the request. An open request with ANOTHER
 * club refuses — one move at a time.
 */
async function openRequest(p: {
  side: TeamMoveSide;
  workspaceId: string;
  repTeamId: string;
  clubOrgId: string;
  actorUserId: string;
}): Promise<{ ok: true; linkId: string; reusedExisting: boolean } | TeamMoveRefusal> {
  const { data: activeRows, error } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('team_workspace_id', p.workspaceId)
    .in('status', ACTIVE_LINK_STATUSES);
  if (error) throw error;
  const rows = (activeRows ?? []) as TeamOrgLinkRow[];

  if (rows.some(r => r.status === 'org_owned')) {
    return { ok: false, status: 409, error: REFUSAL.alreadyMoved, code: 'already_moved' };
  }
  const otherClubOpen: TeamMoveRefusal = {
    ok: false, status: 409, error: p.side === 'club' ? REFUSAL.otherClubOpen : REFUSAL.coachOtherClubOpen,
  };
  if (rows.some(r => r.linked_org_id !== p.clubOrgId && askedByOf(r) !== null)) return otherClubOpen;

  /** A write that lost a race: the request between these two now open (reuse it), else another club's. */
  const afterLostRace = async (): Promise<{ ok: true; linkId: string; reusedExisting: boolean } | TeamMoveRefusal> => {
    const { data: now, error: nowError } = await supabaseAdmin
      .from('team_org_links')
      .select('*')
      .eq('team_workspace_id', p.workspaceId)
      .eq('linked_org_id', p.clubOrgId)
      .in('status', ACTIVE_LINK_STATUSES)
      .maybeSingle();
    if (nowError) throw nowError;
    const row = now as TeamOrgLinkRow | null;
    if (row?.status === 'org_owned') return { ok: false, status: 409, error: REFUSAL.alreadyMoved, code: 'already_moved' };
    if (row && askedByOf(row) !== null) return { ok: true, linkId: row.id, reusedExisting: true };
    return otherClubOpen;
  };

  const approval = p.side === 'club'
    ? { approved_by_org_user_id: p.actorUserId, approved_by_team_user_id: null, requested_by_user_id: null }
    : { approved_by_team_user_id: p.actorUserId, approved_by_org_user_id: null, requested_by_user_id: p.actorUserId };
  const opened = {
    status: 'ownership_pending',
    link_type: 'ownership',
    sharing_level: 'full_org_owned',
    billing_mode_after_approval: null,
    ...approval,
    updated_at: new Date().toISOString(),
  };

  const existing = rows.find(r => r.linked_org_id === p.clubOrgId);
  if (existing) {
    if (askedByOf(existing) !== null) return { ok: true, linkId: existing.id, reusedExisting: true };
    // A retired basic-link row (requested / invited / linked) between the same two: it becomes the
    // request. Conditional on the status it was read in, so a concurrent answer is never overwritten.
    const { data: converted, error: convertError } = await supabaseAdmin
      .from('team_org_links')
      .update(opened)
      .eq('id', existing.id)
      .eq('status', existing.status)
      .select('id');
    // 23505 = another club's request opened first (one open request per team, mig 313's index).
    if (convertError && convertError.code !== '23505') throw convertError;
    if (convertError || !converted?.length) return afterLostRace();
    return { ok: true, linkId: existing.id, reusedExisting: false };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('team_org_links')
    .insert({ team_workspace_id: p.workspaceId, rep_team_id: p.repTeamId, linked_org_id: p.clubOrgId, ...opened })
    .select('id')
    .single();
  if (insertError) {
    // Lost a race (a unique index: the same pair, or one open request per team): answer with what won.
    if (insertError.code === '23505') return afterLostRace();
    throw insertError;
  }
  return { ok: true, linkId: inserted.id as string, reusedExisting: false };
}

/** The club asks a coach, by the coach's email, to bring their team in. */
export async function askCoachToBringTeam(input: {
  clubOrgId: string;
  coachEmail: string;
  actorUserId: string;
  actorEmail: string | null;
}): Promise<TeamMoveAskResult> {
  const club = await fetchClubOrg(input.clubOrgId);
  if (!club) return { ok: false, status: 404, error: 'Organization not found.' };
  if (isTeamWorkspaceOrgRow(club)) return { ok: false, status: 409, error: REFUSAL.notAClub };
  if (!clubHasRepTeams(club)) return { ok: false, status: 409, error: REFUSAL.noRepTeams };

  const email = input.coachEmail.trim();
  const found = await findCoachOwnTeamByEmail(email);
  if (!found.ok) {
    if (found.reason === 'more_than_one') {
      return { ok: false, status: 409, error: `${email} runs more than one team of their own. Ask them to send the request from the team’s own portal instead.` };
    }
    return { ok: false, status: 404, error: REFUSAL.noOwnTeam(email), code: 'no_own_team' };
  }
  const workspace = found.workspace;
  if (workspace.workspaceState === 'archived') return { ok: false, status: 409, error: REFUSAL.workspaceClosed };
  if (workspace.workspaceOrgId === club.id) return { ok: false, status: 409, error: REFUSAL.notAClub };

  const atCap = await atCapRefusal(club);
  if (atCap) return atCap;

  const opened = await openRequest({
    side: 'club', workspaceId: workspace.id, repTeamId: workspace.repTeamId, clubOrgId: club.id, actorUserId: input.actorUserId,
  });
  if (!opened.ok) return opened;
  const link = await getTeamOrgLinkSummary(opened.linkId);
  if (!link) throw new Error('The team move request could not be loaded.');
  if (opened.reusedExisting) return { ok: true, link, reusedExisting: true };

  await recordBothSides({
    link: { id: link.id, linked_org_id: club.id, team_workspace_id: workspace.id, rep_team_id: workspace.repTeamId },
    workspaceOrgId: workspace.workspaceOrgId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    auditAction: 'team_move_requested_by_club',
    eventType: 'team_org_ownership_invited',
    eventOrgId: club.id,
  });

  const wsOrg = await fetchNamed('organizations', workspace.workspaceOrgId);
  const teamName = link.repTeam?.name ?? 'your team';
  await bell({
    orgId: workspace.workspaceOrgId,
    eventType: 'team_move_requested',
    ...bellClubAsked({ clubName: club.name, teamName }),
    userIds: await listActiveStaffUserIds(workspace.repTeamId, { headCoachesOnly: true }),
    link: wsOrg?.slug ? `/${wsOrg.slug}/coaches/link-org` : undefined,
    metadata: { linkId: link.id, teamId: workspace.repTeamId },
  });

  return { ok: true, link, reusedExisting: false };
}

/** The coach asks a club — by its web address or contact email — to bring their team in. */
export async function askClubToTakeTeam(input: {
  workspace: TeamWorkspace;
  target: string;
  actorUserId: string;
  actorEmail: string | null;
}): Promise<TeamMoveAskResult> {
  const found = await findLinkableOrg(input.target);
  if (!found || found.is_discoverable === false) return { ok: false, status: 404, error: REFUSAL.clubNotFound };
  if (found.id === input.workspace.workspaceOrgId) return { ok: false, status: 400, error: REFUSAL.notYourOwnOrg };
  if (isTeamWorkspaceOrgRow(found)) return { ok: false, status: 409, error: REFUSAL.notAClub };
  const club = await fetchClubOrg(found.id);
  if (!club) return { ok: false, status: 404, error: REFUSAL.clubNotFound };
  if (!clubHasRepTeams(club)) return { ok: false, status: 409, error: REFUSAL.noRepTeams };
  if (input.workspace.workspaceState === 'archived') return { ok: false, status: 409, error: REFUSAL.workspaceClosed };

  const opened = await openRequest({
    side: 'coach',
    workspaceId: input.workspace.id,
    repTeamId: input.workspace.repTeamId,
    clubOrgId: club.id,
    actorUserId: input.actorUserId,
  });
  if (!opened.ok) return opened;
  const link = await getTeamOrgLinkSummary(opened.linkId);
  if (!link) throw new Error('The team move request could not be loaded.');
  if (opened.reusedExisting) return { ok: true, link, reusedExisting: true };

  await recordBothSides({
    link: { id: link.id, linked_org_id: club.id, team_workspace_id: input.workspace.id, rep_team_id: input.workspace.repTeamId },
    workspaceOrgId: input.workspace.workspaceOrgId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    auditAction: 'team_move_requested_by_coach',
    eventType: 'team_org_ownership_requested',
    eventOrgId: input.workspace.workspaceOrgId,
  });

  const coachName = await coachDisplayName(input.workspace.workspaceOrgId, input.actorUserId, input.actorEmail);
  await bell({
    orgId: club.id,
    eventType: 'team_move_requested',
    ...bellCoachAsked({ coachName, teamName: link.repTeam?.name ?? 'Their team', clubName: club.name }),
    userIds: await clubAdminUserIds(club.id),
    excludeUserIds: [input.actorUserId],
    link: `/${club.slug}/admin/rep-teams/bring-in`,
    metadata: { linkId: link.id, teamId: input.workspace.repTeamId },
  });

  return { ok: true, link, reusedExisting: false };
}

// ── Answer ────────────────────────────────────────────────────────────────────────────────────────

type Scope = { side: 'club'; clubOrgId: string } | { side: 'coach'; workspaceId: string };

/** The link, if it belongs to the caller's side (another org's or another team's reads as absent). */
async function scopedLink(linkId: string, scope: Scope): Promise<{ link: TeamOrgLinkRow; workspace: WorkspaceRow } | null> {
  const link = await getTeamOrgLinkRow(linkId);
  if (!link) return null;
  if (scope.side === 'club' && link.linked_org_id !== scope.clubOrgId) return null;
  if (scope.side === 'coach' && link.team_workspace_id !== scope.workspaceId) return null;
  const workspace = await fetchWorkspaceRow(link.team_workspace_id);
  if (!workspace) return null;
  return { link, workspace };
}

const NOT_FOUND: TeamMoveRefusal = { ok: false, status: 404, error: 'That request was not found.' };
const NOT_WAITING: TeamMoveRefusal = { ok: false, status: 409, error: REFUSAL.notWaiting, code: 'not_waiting' };

/** An answer that found the request already answered: moved is its own sentence; the rest, "not waiting". */
async function answeredMeanwhile(linkId: string): Promise<TeamMoveRefusal> {
  const row = await getTeamOrgLinkRow(linkId);
  return row?.status === 'org_owned'
    ? { ok: false, status: 409, error: REFUSAL.alreadyMoved, code: 'already_moved' }
    : NOT_WAITING;
}

function otherSide(side: TeamMoveSide): TeamMoveSide {
  return side === 'club' ? 'coach' : 'club';
}

/** The library tables the move re-owns to the team, in a coach's words (a name clash names the kind). */
const LIBRARY_NOUN: Record<string, string> = {
  rep_team_tags: 'tags',
  rep_team_drills: 'drills',
  rep_team_award_types: 'awards',
  org_payees: 'payees',
  budget_items: 'budget items',
  budget_categories: 'budget categories',
  rep_document_templates: 'document templates',
};

/** The RPC's refusals, in the screens' words. Anything unexpected is a failure that moved nothing. */
function rpcRefusal(message: string, side: TeamMoveSide, clubName: string, cap: TeamMoveRefusal['cap']): TeamMoveRefusal | null {
  if (message.includes('team_move_not_waiting')) return NOT_WAITING;
  if (message.includes('team_move_already_moved')) return { ok: false, status: 409, error: REFUSAL.alreadyMoved, code: 'already_moved' };
  if (message.includes('team_move_open_tournament')) return { ok: false, status: 409, error: REFUSAL.openTournament, code: 'open_tournament' };
  if (message.includes('team_move_workspace_archived')) return { ok: false, status: 409, error: REFUSAL.workspaceClosed };
  if (message.includes('team_move_target_not_a_club')) return { ok: false, status: 409, error: REFUSAL.notAClub };
  if (message.includes('team_move_team_ledger_conflict')) return { ok: false, status: 409, error: REFUSAL.ledgerConflict };
  if (message.includes('team_move_workspace_holds_other_teams')) return { ok: false, status: 409, error: REFUSAL.holdsOtherTeams };
  const clash = message.match(/team_move_library_name_clash: ([a-z_]+)/);
  if (clash) return { ok: false, status: 409, error: REFUSAL.libraryNameClash(LIBRARY_NOUN[clash[1]] ?? 'items') };
  if (message.includes('team_move_team_limit')) {
    return side === 'club'
      ? { ok: false, status: 409, error: 'You’ve reached your plan’s team limit.', code: 'team_limit_reached', cap }
      : { ok: false, status: 409, error: REFUSAL.coachAtClubCap(clubName) };
  }
  return null;
}

async function cancelCoachSubscription(subscriptionId: string | null): Promise<{ status: 'not_needed' | 'cancelled' | 'failed'; error?: string }> {
  // A Founding Season coach (platform_override) has no subscription: nothing to cancel.
  if (!subscriptionId || !subscriptionId.startsWith('sub_')) return { status: 'not_needed' };
  if (!isStripeConfigured()) return { status: 'failed', error: 'Stripe is not configured; cancel the prior Team subscription by hand.' };
  try {
    // Cancel now; Stripe's default is no proration and no refund (owner ruling 2026-09-28).
    await stripe.subscriptions.cancel(subscriptionId);
    return { status: 'cancelled' };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'Stripe cancellation failed.' };
  }
}

/**
 * THE SECOND YES. Checks the typed confirmation and the club's plan and team places, then asks
 * `move_team_into_club` to record this side's yes and move the whole team in one transaction.
 * After it commits: the coach's own subscription is cancelled, and both sides hear about it.
 */
export async function approveTeamMove(input: {
  scope: Scope;
  linkId: string;
  confirmTeamName: string;
  actorUserId: string;
  actorEmail: string | null;
}): Promise<TeamMoveApproveResult> {
  const side = input.scope.side;
  const found = await scopedLink(input.linkId, input.scope);
  if (!found) return NOT_FOUND;
  const { link, workspace } = found;
  const [team, club] = await Promise.all([
    fetchNamed('rep_teams', link.rep_team_id),
    fetchClubOrg(link.linked_org_id),
  ]);
  if (!club) return NOT_FOUND;

  // A second click, a second tab, or the other side approving at the same moment: already moved.
  if (link.status === 'org_owned') {
    return {
      ok: true,
      stripeCancellation: 'not_needed',
      moved: {
        alreadyMoved: true, teamId: link.rep_team_id, teamName: team?.name ?? null, teamSlug: team?.slug ?? null,
        slugChanged: false, clubSlug: club.slug, clubName: club.name,
      },
    };
  }
  if (askedByOf(link) !== otherSide(side)) return NOT_WAITING;
  if (isTeamWorkspaceOrgRow(club)) return { ok: false, status: 409, error: REFUSAL.notAClub };
  if (!clubHasRepTeams(club)) return { ok: false, status: 409, error: REFUSAL.noRepTeams };

  // Room first: it does not depend on what was typed, and at the cap the club's Approve opens the
  // team-cap window from this answer without asking for the name.
  const places = await clubTeamPlaces(club);
  const cap = places.limit == null ? undefined : { planId: places.planId, teamLimit: places.limit, activeTeams: places.used };
  if (places.limit != null && places.used >= places.limit) {
    return rpcRefusal('team_move_team_limit', side, club.name, cap)!;
  }

  if (!team || !teamNameConfirmed(input.confirmTeamName, team.name)) {
    return { ok: false, status: 400, error: REFUSAL.confirmMismatch, code: 'confirm_mismatch' };
  }

  const { data, error } = await supabaseAdmin.rpc('move_team_into_club', {
    p_link_id: link.id,
    p_approving_side: side,
    p_actor_user_id: input.actorUserId,
    p_actor_email: input.actorEmail ?? '',
    // The cap is plan-config (TypeScript); the move re-counts the places under the club's lock.
    p_team_cap: places.limit,
  });
  if (error) {
    const refusal = rpcRefusal(error.message ?? '', side, club.name, cap);
    if (refusal) return refusal;
    console.error('[team-move] move_team_into_club failed:', error);
    await captureError(error, { route: 'lib/team-ownership-transfer#approveTeamMove', severity: 'error', title: 'Team move failed (nothing moved)' });
    return { ok: false, status: 500, error: REFUSAL.moveFailed };
  }

  const result = (data ?? {}) as {
    alreadyMoved?: boolean; teamName?: string; teamSlug?: string | null; slugChanged?: boolean;
    clubSlug?: string; previousStripeSubscriptionId?: string | null; moved?: Record<string, number>;
    staffSeats?: number; workspaceOrgId?: string;
  };
  const moved: TeamMoved = {
    alreadyMoved: Boolean(result.alreadyMoved),
    teamId: link.rep_team_id,
    teamName: result.teamName ?? team.name,
    teamSlug: result.teamSlug ?? team.slug ?? null,
    slugChanged: Boolean(result.slugChanged),
    clubSlug: result.clubSlug ?? club.slug,
    clubName: club.name,
  };
  if (moved.alreadyMoved) return { ok: true, moved, stripeCancellation: 'not_needed' };

  // ⚠ After the commit, never before: the move cleared the Stripe ids, so the webhook this cancel
  // triggers finds no workspace (and sends no "cancelled" email).
  const subscriptionId = result.previousStripeSubscriptionId ?? workspace.stripe_subscription_id ?? null;
  const stripeCancellation = await cancelCoachSubscription(subscriptionId);
  if (stripeCancellation.status === 'failed') {
    console.error('[team-move] the coach’s subscription was not cancelled:', subscriptionId, stripeCancellation.error);
    await captureError(new Error(`Team move: cancel ${subscriptionId} by hand — ${stripeCancellation.error ?? 'Stripe cancellation failed'}`), {
      route: 'lib/team-ownership-transfer#approveTeamMove',
      severity: 'error',
      title: 'Team moved into a club, but the coach’s own subscription was not cancelled',
    });
  }

  await writePlatformEvent({
    eventType: 'team_org_ownership_transfer_completed',
    source: 'app',
    orgId: link.linked_org_id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    planId: 'team',
    metadata: {
      linkId: link.id, approvingSide: side, workspaceOrgId: workspace.workspace_org_id, repTeamId: link.rep_team_id,
      teamSlug: moved.teamSlug, slugChanged: moved.slugChanged, staffSeats: result.staffSeats ?? null,
      moved: result.moved ?? {}, stripeSubscriptionId: subscriptionId,
      stripeCancellation: stripeCancellation.status, stripeCancellationError: stripeCancellation.error ?? null,
    },
  });

  // The team's staff are in the club now: their bell lives there.
  const teamName = moved.teamName ?? 'Your team';
  const staffIds = await listActiveStaffUserIds(link.rep_team_id).catch(() => [] as string[]);
  await bell({
    orgId: club.id,
    eventType: 'team_move_answered',
    ...bellMovedForStaff({ teamName, clubName: club.name }),
    userIds: staffIds,
    excludeUserIds: [input.actorUserId],
    link: `/${club.slug}/coaches/teams/${link.rep_team_id}`,
    metadata: { linkId: link.id, teamId: link.rep_team_id, outcome: 'moved' },
  });
  {
    // Both directions: the club's OTHER owners and admins learn a team joined (the one who pressed
    // Approve is excluded). "{coach} said yes" is true either way — the coach asked, or answered.
    const coachName = side === 'coach'
      ? await coachDisplayName(workspace.workspace_org_id, input.actorUserId, input.actorEmail)
      : await coachDisplayName(workspace.workspace_org_id, link.approved_by_team_user_id ?? '', null);
    await bell({
      orgId: club.id,
      eventType: 'team_move_answered',
      ...bellMovedForClub({ teamName, clubName: club.name, coachName }),
      userIds: await clubAdminUserIds(club.id),
      excludeUserIds: [input.actorUserId],
      link: `/${club.slug}/admin/rep-teams/teams/${link.rep_team_id}`,
      metadata: { linkId: link.id, teamId: link.rep_team_id, outcome: 'moved' },
    });
  }

  return { ok: true, moved, stripeCancellation: stripeCancellation.status };
}

/** The answering side says no. Conditional on the request still being open, so it never races a move. */
export async function declineTeamMove(input: {
  scope: Scope;
  linkId: string;
  actorUserId: string;
  actorEmail: string | null;
}): Promise<TeamMoveAnswerResult> {
  const side = input.scope.side;
  const found = await scopedLink(input.linkId, input.scope);
  if (!found) return NOT_FOUND;
  const { link, workspace } = found;
  if (link.status === 'org_owned') return { ok: false, status: 409, error: REFUSAL.alreadyMoved, code: 'already_moved' };
  if (askedByOf(link) !== otherSide(side)) return NOT_WAITING;

  const { data: updated, error } = await supabaseAdmin
    .from('team_org_links')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', link.id)
    .eq('status', 'ownership_pending')
    .select('id');
  if (error) throw error;
  if (!updated?.length) return answeredMeanwhile(link.id);

  await recordBothSides({
    link,
    workspaceOrgId: workspace.workspace_org_id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    auditAction: side === 'club' ? 'team_move_declined_by_club' : 'team_move_declined_by_coach',
    eventType: side === 'club' ? 'team_org_ownership_request_declined' : 'team_org_ownership_invite_declined',
    eventOrgId: side === 'club' ? link.linked_org_id : workspace.workspace_org_id,
  });

  const [team, club, wsOrg] = await Promise.all([
    fetchNamed('rep_teams', link.rep_team_id),
    fetchNamed('organizations', link.linked_org_id),
    fetchNamed('organizations', workspace.workspace_org_id),
  ]);
  const teamName = team?.name ?? 'The team';
  const clubName = club?.name ?? 'The club';
  if (side === 'club') {
    await bell({
      orgId: workspace.workspace_org_id,
      eventType: 'team_move_answered',
      ...bellClubDeclined({ clubName, teamName }),
      userIds: await listActiveStaffUserIds(link.rep_team_id, { headCoachesOnly: true }),
      link: wsOrg?.slug ? `/${wsOrg.slug}/coaches/link-org` : undefined,
      metadata: { linkId: link.id, outcome: 'declined' },
    });
  } else {
    const coachName = await coachDisplayName(workspace.workspace_org_id, input.actorUserId, input.actorEmail);
    await bell({
      orgId: link.linked_org_id,
      eventType: 'team_move_answered',
      ...bellCoachDeclined({ coachName, teamName, clubName }),
      userIds: await clubAdminUserIds(link.linked_org_id),
      link: club?.slug ? `/${club.slug}/admin/rep-teams/bring-in` : undefined,
      metadata: { linkId: link.id, outcome: 'declined' },
    });
  }

  return { ok: true, link: await getTeamOrgLinkSummary(link.id) };
}

/** The asking side takes its request back, while it is still open. */
export async function withdrawTeamMove(input: {
  scope: Scope;
  linkId: string;
  actorUserId: string;
  actorEmail: string | null;
}): Promise<TeamMoveAnswerResult> {
  const side = input.scope.side;
  const found = await scopedLink(input.linkId, input.scope);
  if (!found) return NOT_FOUND;
  const { link, workspace } = found;
  if (link.status === 'org_owned') return { ok: false, status: 409, error: REFUSAL.alreadyMoved, code: 'already_moved' };
  if (askedByOf(link) !== side) return NOT_WAITING;

  const { data: updated, error } = await supabaseAdmin
    .from('team_org_links')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', link.id)
    .eq('status', 'ownership_pending')
    .select('id');
  if (error) throw error;
  if (!updated?.length) return answeredMeanwhile(link.id);

  await recordBothSides({
    link,
    workspaceOrgId: workspace.workspace_org_id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    auditAction: side === 'club' ? 'team_move_withdrawn_by_club' : 'team_move_withdrawn_by_coach',
    eventType: 'team_org_ownership_withdrawn',
    eventOrgId: side === 'club' ? link.linked_org_id : workspace.workspace_org_id,
  });

  return { ok: true, link: await getTeamOrgLinkSummary(link.id) };
}
