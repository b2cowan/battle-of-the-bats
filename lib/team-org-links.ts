import 'server-only';

import { supabaseAdmin } from './supabase-admin';
import { getOrgMemberDisplayNames } from './db';
import { findAuthUserIdByEmail } from './auth-account-lookup';
import { listHeadCoachOrgIdsForUser } from './coach-membership';
import {
  getTeamWorkspaceForOrg,
} from './team-workspace-entitlements';
import type {
  TeamOrgLinkSharingLevel,
  TeamOrgLinkStatus,
  TeamOrgLinkType,
  TeamWorkspace,
  TeamWorkspaceBillingMode,
} from './team-workspace-entitlements';
import type { MoveHistoryState } from './team-move-words';
import { askedByOf, historyStateOf, type TeamMoveAskedBy } from './team-move-state';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE LINK ROWS BETWEEN A COACH'S OWN TEAM AND A CLUB — the READ side (Club Tier Stage 2, Ask 2).
 *
 * One row (`team_org_links`) is one request to bring a team into a club. Today it has three live
 * shapes, all `link_type = 'ownership'`, `status = 'ownership_pending'`:
 *   - the CLUB asked  → `approved_by_org_user_id` set, waiting on the coach;
 *   - the COACH asked → `approved_by_team_user_id` set, waiting on the club;
 * and it ends as `org_owned` (moved — `move_team_into_club`, mig 313), `declined`, or `revoked`
 * (withdrawn, or closed by the move for every other open row of that team).
 *
 * ⚠ THE BASIC VISIBILITY LINK IS RETIRED (B12, owner ruling 2026-09-28). No club screen ever read
 * it; it existed only as a required first step before a transfer. Its rows (`requested`, `invited`,
 * `linked`, link_type `visibility`/`billing`) stay as HISTORY and are never offered as actions.
 * The writes live in `lib/team-ownership-transfer.ts`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Statuses the unique index `team_org_links_active_unique` covers (one per workspace + org). */
export const ACTIVE_LINK_STATUSES: TeamOrgLinkStatus[] = [
  'requested',
  'invited',
  'linked',
  'ownership_pending',
  'org_owned',
];

export type TeamOrgLinkRow = {
  id: string;
  team_workspace_id: string;
  rep_team_id: string;
  linked_org_id: string;
  status: TeamOrgLinkStatus;
  link_type: TeamOrgLinkType;
  sharing_level: TeamOrgLinkSharingLevel;
  requested_by_user_id: string | null;
  approved_by_team_user_id: string | null;
  approved_by_org_user_id: string | null;
  billing_mode_after_approval: TeamWorkspaceBillingMode | null;
  created_at: string;
  updated_at: string;
};

type TeamWorkspaceLinkRow = {
  id: string;
  workspace_org_id: string;
  rep_team_id: string;
  primary_owner_user_id: string | null;
  workspace_state: string | null;
  billing_mode: string | null;
  source: string | null;
  subscription_status: string | null;
};

type RepTeamLinkRow = {
  id: string;
  name: string;
  slug: string | null;
  division: string | null;
  color: string | null;
};

export type OrgLinkRow = {
  id: string;
  name: string;
  slug: string;
  contact_email?: string | null;
  account_kind: string | null;
  plan_id: string | null;
  is_discoverable: boolean | null;
};

type OrgPublicSiteContactRow = {
  org_id: string;
  contact_email: string | null;
};

export type TeamOrgLinkOrgSummary = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  accountKind: string | null;
  planId: string | null;
  isDiscoverable: boolean;
};

export type TeamOrgLinkRepTeamSummary = {
  id: string;
  name: string;
  slug: string | null;
  division: string | null;
  color: string | null;
};

export type TeamOrgLinkWorkspaceSummary = {
  id: string;
  workspaceOrgId: string;
  workspaceState: string | null;
  billingMode: string | null;
  source: string | null;
  subscriptionStatus: string | null;
};

export type TeamOrgLinkSummary = {
  id: string;
  teamWorkspaceId: string;
  repTeamId: string;
  linkedOrgId: string;
  status: TeamOrgLinkStatus;
  linkType: TeamOrgLinkType;
  sharingLevel: TeamOrgLinkSharingLevel;
  requestedByUserId: string | null;
  approvedByTeamUserId: string | null;
  approvedByOrgUserId: string | null;
  billingModeAfterApproval: TeamWorkspaceBillingMode | null;
  createdAt: string;
  updatedAt: string;
  linkedOrg: TeamOrgLinkOrgSummary | null;
  workspaceOrg: TeamOrgLinkOrgSummary | null;
  workspace: TeamOrgLinkWorkspaceSummary | null;
  repTeam: TeamOrgLinkRepTeamSummary | null;
  /** An open move request: which side asked (and so which side answers). */
  askedBy: TeamMoveAskedBy;
  /** Where an answered row stands, for the history lists; null while open. */
  historyState: MoveHistoryState | null;
  /** The coach, by name: whoever said yes on the team's side, else the portal's owner. */
  coachName: string | null;
  /** The coach's own tournament still open (draft/active) — the move waits for it. Open rows only. */
  openTournamentName: string | null;
};

function mapOrg(row: OrgLinkRow | undefined): TeamOrgLinkOrgSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    contactEmail: row.contact_email ?? null,
    accountKind: row.account_kind ?? 'organization',
    planId: row.plan_id ?? null,
    isDiscoverable: row.is_discoverable ?? true,
  };
}

function mapRepTeam(row: RepTeamLinkRow | undefined): TeamOrgLinkRepTeamSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? null,
    division: row.division ?? null,
    color: row.color ?? null,
  };
}

function mapWorkspace(row: TeamWorkspaceLinkRow | undefined): TeamOrgLinkWorkspaceSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    workspaceOrgId: row.workspace_org_id,
    workspaceState: row.workspace_state ?? null,
    billingMode: row.billing_mode ?? null,
    source: row.source ?? null,
    subscriptionStatus: row.subscription_status ?? null,
  };
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function fetchOrgMap(orgIds: string[]): Promise<Map<string, OrgLinkRow>> {
  if (!orgIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, account_kind, plan_id, is_discoverable')
    .in('id', orgIds);
  if (error) throw error;

  const rows = (data ?? []) as OrgLinkRow[];
  const { data: contactRows, error: contactError } = await supabaseAdmin
    .from('org_public_site_content')
    .select('org_id, contact_email')
    .in('org_id', orgIds);
  if (contactError) throw contactError;

  const contactMap = new Map(
    ((contactRows ?? []) as OrgPublicSiteContactRow[]).map(row => [row.org_id, row.contact_email]),
  );
  return new Map(rows.map(row => [row.id, { ...row, contact_email: contactMap.get(row.id) ?? null }]));
}

async function fetchRepTeamMap(teamIds: string[]): Promise<Map<string, RepTeamLinkRow>> {
  if (!teamIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select('id, name, slug, division, color')
    .in('id', teamIds);
  if (error) throw error;
  return new Map(((data ?? []) as RepTeamLinkRow[]).map(row => [row.id, row]));
}

async function fetchWorkspaceMap(workspaceIds: string[]): Promise<Map<string, TeamWorkspaceLinkRow>> {
  if (!workspaceIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, primary_owner_user_id, workspace_state, billing_mode, source, subscription_status')
    .in('id', workspaceIds);
  if (error) throw error;
  return new Map(((data ?? []) as TeamWorkspaceLinkRow[]).map(row => [row.id, row]));
}

/** The coach orgs' open tournaments (draft/active), one name per org — the move waits for them. */
async function fetchOpenTournamentNames(orgIds: string[]): Promise<Map<string, string>> {
  if (!orgIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('org_id, name, start_date')
    .in('org_id', orgIds)
    .in('status', ['draft', 'active'])
    .order('start_date', { ascending: true });
  if (error) throw error;
  const out = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ org_id: string; name: string }>) {
    if (!out.has(row.org_id)) out.set(row.org_id, row.name);
  }
  return out;
}

async function mapLinkRows(rows: TeamOrgLinkRow[]): Promise<TeamOrgLinkSummary[]> {
  const workspaceMap = await fetchWorkspaceMap(unique(rows.map(row => row.team_workspace_id)));
  const workspaceOrgIds = unique([...workspaceMap.values()].map(row => row.workspace_org_id));
  const openRowWorkspaceOrgIds = unique(rows
    .filter(row => askedByOf(row) !== null)
    .map(row => workspaceMap.get(row.team_workspace_id)?.workspace_org_id));
  const orgIds = unique([...rows.map(row => row.linked_org_id), ...workspaceOrgIds]);
  const [orgMap, teamMap, openTournaments] = await Promise.all([
    fetchOrgMap(orgIds),
    fetchRepTeamMap(unique(rows.map(row => row.rep_team_id))),
    fetchOpenTournamentNames(openRowWorkspaceOrgIds),
  ]);

  // The coach's name, from the coach's own org (they are a member there): the head coach who said
  // yes, else the portal's owner. One read per coach org.
  const namesByOrg = new Map<string, Record<string, string>>();
  await Promise.all(workspaceOrgIds.map(async orgId => {
    const userIds = unique(rows
      .filter(row => workspaceMap.get(row.team_workspace_id)?.workspace_org_id === orgId)
      .flatMap(row => [row.approved_by_team_user_id, workspaceMap.get(row.team_workspace_id)?.primary_owner_user_id]));
    namesByOrg.set(orgId, userIds.length ? await getOrgMemberDisplayNames(orgId, userIds) : {});
  }));

  return rows.map(row => {
    const workspace = workspaceMap.get(row.team_workspace_id);
    const names = workspace ? namesByOrg.get(workspace.workspace_org_id) ?? {} : {};
    const coachUserId = row.approved_by_team_user_id ?? workspace?.primary_owner_user_id ?? null;
    const askedBy = askedByOf(row);
    return {
      id: row.id,
      teamWorkspaceId: row.team_workspace_id,
      repTeamId: row.rep_team_id,
      linkedOrgId: row.linked_org_id,
      status: row.status,
      linkType: row.link_type,
      sharingLevel: row.sharing_level,
      requestedByUserId: row.requested_by_user_id ?? null,
      approvedByTeamUserId: row.approved_by_team_user_id ?? null,
      approvedByOrgUserId: row.approved_by_org_user_id ?? null,
      billingModeAfterApproval: row.billing_mode_after_approval ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      linkedOrg: mapOrg(orgMap.get(row.linked_org_id)),
      workspaceOrg: mapOrg(workspace ? orgMap.get(workspace.workspace_org_id) : undefined),
      workspace: mapWorkspace(workspace),
      repTeam: mapRepTeam(teamMap.get(row.rep_team_id)),
      askedBy,
      historyState: askedBy ? null : historyStateOf(row),
      coachName: coachUserId ? names[coachUserId] ?? null : null,
      openTournamentName: askedBy && workspace ? openTournaments.get(workspace.workspace_org_id) ?? null : null,
    };
  });
}

export async function listTeamOrgLinksForWorkspace(workspaceId: string): Promise<TeamOrgLinkSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('team_workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return mapLinkRows((data ?? []) as TeamOrgLinkRow[]);
}

export async function listTeamOrgLinksForLinkedOrg(orgId: string): Promise<TeamOrgLinkSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('linked_org_id', orgId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return mapLinkRows((data ?? []) as TeamOrgLinkRow[]);
}

export async function getTeamOrgLinkSummary(linkId: string): Promise<TeamOrgLinkSummary | null> {
  const { data, error } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('id', linkId)
    .maybeSingle();
  if (error) throw error;
  const summaries = await mapLinkRows(data ? [data as TeamOrgLinkRow] : []);
  return summaries[0] ?? null;
}

export async function getTeamOrgLinkRow(linkId: string): Promise<TeamOrgLinkRow | null> {
  const { data, error } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('id', linkId)
    .maybeSingle();
  if (error) throw error;
  return (data as TeamOrgLinkRow | null) ?? null;
}

function normalizeLinkTarget(input: string): { kind: 'email' | 'slug'; value: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { kind: 'email', value: trimmed.toLowerCase() };
  }

  let slug = trimmed.toLowerCase();
  slug = slug.replace(/^https?:\/\/[^/]+/i, '');
  slug = slug.replace(/^\/+/, '');
  slug = slug.split(/[/?#]/)[0] ?? '';
  slug = slug.replace(/[^a-z0-9-]/g, '');
  if (!slug) return null;
  return { kind: 'slug', value: slug };
}

/** A club the coach names by its web address or its public contact email. */
export async function findLinkableOrg(targetInput: string): Promise<OrgLinkRow | null> {
  const lookup = normalizeLinkTarget(targetInput);
  if (!lookup) return null;

  const orgSelect = 'id, name, slug, account_kind, plan_id, is_discoverable';

  if (lookup.kind === 'email') {
    const { data: contactRow, error: contactError } = await supabaseAdmin
      .from('org_public_site_content')
      .select('org_id, contact_email')
      .ilike('contact_email', lookup.value)
      .limit(1)
      .maybeSingle();

    if (contactError) throw contactError;
    if (!contactRow?.org_id) return null;

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select(orgSelect)
      .eq('id', contactRow.org_id)
      .maybeSingle();

    if (error) throw error;
    return data ? { ...(data as OrgLinkRow), contact_email: contactRow.contact_email ?? null } : null;
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select(orgSelect)
    .eq('slug', lookup.value)
    .maybeSingle();

  if (error) throw error;
  return (data as OrgLinkRow | null) ?? null;
}

export function isTeamWorkspaceOrgRow(org: Pick<OrgLinkRow, 'account_kind' | 'plan_id'>): boolean {
  return org.account_kind === 'team_workspace' || org.plan_id === 'team';
}

export type CoachOwnTeamLookup =
  | { ok: true; workspace: TeamWorkspace }
  | { ok: false; reason: 'no_account' | 'no_own_team' | 'more_than_one' };

/**
 * The coach's own team, found by the coach's email (the club's "Send request"). The coach is the
 * portal's owner OR an active head coach of it (co-heads exist). A closed portal still counts as
 * found — the caller refuses it in words; "no such coach" would be the wrong sentence.
 */
export async function findCoachOwnTeamByEmail(email: string): Promise<CoachOwnTeamLookup> {
  const userId = await findAuthUserIdByEmail(email);
  if (!userId) return { ok: false, reason: 'no_account' };

  const [{ data: owned, error: ownedError }, headCoachOrgIds] = await Promise.all([
    supabaseAdmin.from('team_workspaces').select('workspace_org_id').eq('primary_owner_user_id', userId),
    listHeadCoachOrgIdsForUser(userId),
  ]);
  if (ownedError) throw ownedError;

  const candidateOrgIds = unique([
    ...((owned ?? []) as Array<{ workspace_org_id: string }>).map(r => r.workspace_org_id),
    ...headCoachOrgIds,
  ]);
  const workspaces = (await Promise.all(candidateOrgIds.map(id => getTeamWorkspaceForOrg(id))))
    .filter((w): w is TeamWorkspace => Boolean(w))
    .filter(w => w.workspaceState !== 'org_owned');

  if (workspaces.length === 0) return { ok: false, reason: 'no_own_team' };
  if (workspaces.length > 1) return { ok: false, reason: 'more_than_one' };
  return { ok: true, workspace: workspaces[0] };
}
