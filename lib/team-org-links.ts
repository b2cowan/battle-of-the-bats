import { supabaseAdmin } from './supabase-admin';
import { writePlatformEvent } from './platform-events';
import {
  getActiveTeamEntitlement,
  getTeamWorkspaceForOrg,
} from './team-workspace-entitlements';
import type {
  TeamOrgLinkSharingLevel,
  TeamOrgLinkStatus,
  TeamOrgLinkType,
  TeamWorkspace,
  TeamWorkspaceBillingMode,
} from './team-workspace-entitlements';

const ACTIVE_LINK_STATUSES: TeamOrgLinkStatus[] = [
  'requested',
  'invited',
  'linked',
  'ownership_pending',
  'org_owned',
];

const ORG_REVIEWABLE_LINK_STATUSES: TeamOrgLinkStatus[] = ['requested'];
const TEAM_REVIEWABLE_LINK_STATUSES: TeamOrgLinkStatus[] = ['invited'];

type TeamOrgLinkRow = {
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
  workspace_state: string | null;
  billing_mode: string | null;
  source: string | null;
  subscription_status: string | null;
};

type RepTeamLinkRow = {
  id: string;
  name: string;
  slug: string | null;
  age_group: string | null;
  color: string | null;
};

type OrgLinkRow = {
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
  ageGroup: string | null;
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
};

export type CreateTeamOrgLinkRequestResult =
  | { ok: true; link: TeamOrgLinkSummary; reusedExisting: boolean }
  | { ok: false; status: number; error: string };

export type CreateTeamOrgLinkInviteResult =
  | { ok: true; link: TeamOrgLinkSummary; reusedExisting: boolean }
  | { ok: false; status: number; error: string };

export type ReviewTeamOrgLinkResult =
  | { ok: true; link: TeamOrgLinkSummary }
  | { ok: false; status: number; error: string };

export type RespondTeamOrgLinkInvitationResult =
  | { ok: true; link: TeamOrgLinkSummary }
  | { ok: false; status: number; error: string };

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
    ageGroup: row.age_group ?? null,
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
    .select('id, name, slug, age_group, color')
    .in('id', teamIds);
  if (error) throw error;
  return new Map(((data ?? []) as RepTeamLinkRow[]).map(row => [row.id, row]));
}

async function fetchWorkspaceMap(workspaceIds: string[]): Promise<Map<string, TeamWorkspaceLinkRow>> {
  if (!workspaceIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, workspace_state, billing_mode, source, subscription_status')
    .in('id', workspaceIds);
  if (error) throw error;
  return new Map(((data ?? []) as TeamWorkspaceLinkRow[]).map(row => [row.id, row]));
}

async function mapLinkRows(rows: TeamOrgLinkRow[]): Promise<TeamOrgLinkSummary[]> {
  const workspaceMap = await fetchWorkspaceMap(unique(rows.map(row => row.team_workspace_id)));
  const orgIds = unique([
    ...rows.map(row => row.linked_org_id),
    ...[...workspaceMap.values()].map(row => row.workspace_org_id),
  ]);
  const [orgMap, teamMap] = await Promise.all([
    fetchOrgMap(orgIds),
    fetchRepTeamMap(unique(rows.map(row => row.rep_team_id))),
  ]);

  return rows.map(row => {
    const workspace = workspaceMap.get(row.team_workspace_id);
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

async function getTeamOrgLinkSummary(linkId: string): Promise<TeamOrgLinkSummary | null> {
  const { data, error } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('id', linkId)
    .maybeSingle();
  if (error) throw error;
  const summaries = await mapLinkRows(data ? [data as TeamOrgLinkRow] : []);
  return summaries[0] ?? null;
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

async function findLinkableOrg(targetInput: string): Promise<OrgLinkRow | null> {
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

function isNormalLinkableOrg(org: OrgLinkRow): boolean {
  return org.account_kind !== 'team_workspace' && org.plan_id !== 'team' && org.is_discoverable !== false;
}

function isTeamWorkspaceOrgRow(org: OrgLinkRow): boolean {
  return org.account_kind === 'team_workspace' || org.plan_id === 'team';
}

async function getOrgById(orgId: string): Promise<OrgLinkRow | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, account_kind, plan_id, is_discoverable')
    .eq('id', orgId)
    .maybeSingle();

  if (error) throw error;
  return (data as OrgLinkRow | null) ?? null;
}

async function findAuthUserByEmail(email: string): Promise<{ id: string; email: string | null } | null> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const user = data?.users.find(authUser => authUser.email?.toLowerCase() === email.toLowerCase());
  return user ? { id: user.id, email: user.email ?? null } : null;
}

type FindInvitableTeamWorkspaceResult =
  | {
      ok: true;
      workspace: TeamWorkspace;
      workspaceOrg: OrgLinkRow;
    }
  | { ok: false; status: number; error: string };

async function ensureInvitableTeamWorkspace(
  workspace: TeamWorkspace | null,
  workspaceOrg: OrgLinkRow | null,
): Promise<FindInvitableTeamWorkspaceResult> {
  if (!workspace || !workspaceOrg) {
    return { ok: false, status: 404, error: 'Standalone Team workspace not found.' };
  }

  if (!isTeamWorkspaceOrgRow(workspaceOrg)) {
    return { ok: false, status: 400, error: 'Enter a standalone Team workspace URL slug or primary coach email.' };
  }

  if (workspace.workspaceState === 'archived' || workspace.workspaceState === 'org_owned') {
    return { ok: false, status: 409, error: 'This Team workspace is not available for a Basic visibility invitation.' };
  }

  const entitlement = await getActiveTeamEntitlement(workspace.workspaceOrgId, workspace.repTeamId);
  if (!entitlement) {
    return { ok: false, status: 409, error: 'This Team workspace does not have an active Team entitlement.' };
  }

  return { ok: true, workspace, workspaceOrg };
}

async function findInvitableTeamWorkspace(targetInput: string): Promise<FindInvitableTeamWorkspaceResult> {
  const lookup = normalizeLinkTarget(targetInput);
  if (!lookup) {
    return { ok: false, status: 400, error: 'Enter a Team workspace URL slug or primary coach email.' };
  }

  if (lookup.kind === 'email') {
    const user = await findAuthUserByEmail(lookup.value);
    if (!user) {
      return { ok: false, status: 404, error: 'No Team workspace owner was found for that email.' };
    }

    const { data, error } = await supabaseAdmin
      .from('team_workspaces')
      .select('workspace_org_id')
      .eq('primary_owner_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2);
    if (error) throw error;

    const rows = (data ?? []) as Array<{ workspace_org_id: string }>;
    if (rows.length > 1) {
      return {
        ok: false,
        status: 409,
        error: 'That coach owns more than one Team workspace. Use the Team workspace URL slug instead.',
      };
    }
    if (rows.length === 0) {
      return { ok: false, status: 404, error: 'No Team workspace owner was found for that email.' };
    }

    const workspaceOrg = await getOrgById(rows[0].workspace_org_id);
    const workspace = workspaceOrg ? await getTeamWorkspaceForOrg(workspaceOrg.id) : null;
    return ensureInvitableTeamWorkspace(workspace, workspaceOrg);
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, account_kind, plan_id, is_discoverable')
    .eq('slug', lookup.value)
    .maybeSingle();
  if (error) throw error;

  const workspaceOrg = (data as OrgLinkRow | null) ?? null;
  const workspace = workspaceOrg ? await getTeamWorkspaceForOrg(workspaceOrg.id) : null;
  return ensureInvitableTeamWorkspace(workspace, workspaceOrg);
}

export async function createTeamOrgLinkRequest(input: {
  workspace: TeamWorkspace;
  targetInput: string;
  requestedByUserId: string;
  requestedByEmail?: string | null;
}): Promise<CreateTeamOrgLinkRequestResult> {
  const targetOrg = await findLinkableOrg(input.targetInput);
  if (!targetOrg) {
    return { ok: false, status: 404, error: 'Organization not found. Use the parent organization slug or contact email.' };
  }
  if (!isNormalLinkableOrg(targetOrg)) {
    return { ok: false, status: 400, error: 'Team workspaces can only link to a normal organization account.' };
  }
  if (targetOrg.id === input.workspace.workspaceOrgId) {
    return { ok: false, status: 400, error: 'Choose a different parent organization.' };
  }

  const { data: activeLinks, error: activeError } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('team_workspace_id', input.workspace.id)
    .in('status', ACTIVE_LINK_STATUSES);
  if (activeError) throw activeError;

  const existing = ((activeLinks ?? []) as TeamOrgLinkRow[]).find(row => row.linked_org_id === targetOrg.id);
  if (existing) {
    const summary = await getTeamOrgLinkSummary(existing.id);
    if (!summary) return { ok: false, status: 500, error: 'Existing link could not be loaded.' };
    return { ok: true, link: summary, reusedExisting: true };
  }

  if ((activeLinks ?? []).length > 0) {
    return {
      ok: false,
      status: 409,
      error: 'This Team workspace already has an active or pending organization link.',
    };
  }

  const { data, error } = await supabaseAdmin
    .from('team_org_links')
    .insert({
      team_workspace_id: input.workspace.id,
      rep_team_id: input.workspace.repTeamId,
      linked_org_id: targetOrg.id,
      status: 'requested',
      link_type: 'visibility',
      sharing_level: 'basic',
      requested_by_user_id: input.requestedByUserId,
      approved_by_team_user_id: input.requestedByUserId,
      billing_mode_after_approval: null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const summaries = await listTeamOrgLinksForWorkspace(input.workspace.id);
      const duplicate = summaries.find(link => link.linkedOrgId === targetOrg.id && ACTIVE_LINK_STATUSES.includes(link.status));
      if (duplicate) return { ok: true, link: duplicate, reusedExisting: true };
    }
    throw error;
  }

  const summary = (await mapLinkRows([data as TeamOrgLinkRow]))[0];
  await Promise.all([
    writeOrgAudit(input.workspace.workspaceOrgId, input.requestedByUserId, summary.id, 'team_org_link_requested_by_team', {
      linkedOrgId: targetOrg.id,
      linkedOrgName: targetOrg.name,
      repTeamId: input.workspace.repTeamId,
      sharingLevel: 'basic',
    }),
    writePlatformEvent({
      eventType: 'team_org_link_requested',
      source: 'app',
      orgId: input.workspace.workspaceOrgId,
      actorUserId: input.requestedByUserId,
      actorEmail: input.requestedByEmail ?? null,
      metadata: {
        teamWorkspaceId: input.workspace.id,
        linkedOrgId: targetOrg.id,
        repTeamId: input.workspace.repTeamId,
        linkType: 'visibility',
        sharingLevel: 'basic',
      },
    }),
  ]);

  return { ok: true, link: summary, reusedExisting: false };
}

export async function createTeamOrgLinkInvite(input: {
  orgId: string;
  targetInput: string;
  invitedByUserId: string;
  invitedByEmail?: string | null;
}): Promise<CreateTeamOrgLinkInviteResult> {
  const target = await findInvitableTeamWorkspace(input.targetInput);
  if (!target.ok) return target;

  if (target.workspace.workspaceOrgId === input.orgId) {
    return { ok: false, status: 400, error: 'Choose a different Team workspace.' };
  }

  const { data: activeLinks, error: activeError } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('team_workspace_id', target.workspace.id)
    .in('status', ACTIVE_LINK_STATUSES);
  if (activeError) throw activeError;

  const existing = ((activeLinks ?? []) as TeamOrgLinkRow[]).find(row => row.linked_org_id === input.orgId);
  if (existing) {
    const summary = await getTeamOrgLinkSummary(existing.id);
    if (!summary) return { ok: false, status: 500, error: 'Existing link could not be loaded.' };
    return { ok: true, link: summary, reusedExisting: true };
  }

  if ((activeLinks ?? []).length > 0) {
    return {
      ok: false,
      status: 409,
      error: 'This Team workspace already has an active or pending organization link.',
    };
  }

  const { data, error } = await supabaseAdmin
    .from('team_org_links')
    .insert({
      team_workspace_id: target.workspace.id,
      rep_team_id: target.workspace.repTeamId,
      linked_org_id: input.orgId,
      status: 'invited',
      link_type: 'visibility',
      sharing_level: 'basic',
      requested_by_user_id: null,
      approved_by_org_user_id: input.invitedByUserId,
      billing_mode_after_approval: null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const summaries = await listTeamOrgLinksForWorkspace(target.workspace.id);
      const duplicate = summaries.find(link => link.linkedOrgId === input.orgId && ACTIVE_LINK_STATUSES.includes(link.status));
      if (duplicate) return { ok: true, link: duplicate, reusedExisting: true };
    }
    throw error;
  }

  const summary = (await mapLinkRows([data as TeamOrgLinkRow]))[0];
  await Promise.all([
    writeOrgAudit(input.orgId, input.invitedByUserId, summary.id, 'team_org_link_invited_by_org', {
      teamWorkspaceId: target.workspace.id,
      workspaceOrgId: target.workspace.workspaceOrgId,
      workspaceOrgName: target.workspaceOrg.name,
      repTeamId: target.workspace.repTeamId,
      sharingLevel: 'basic',
    }),
    writeOrgAudit(target.workspace.workspaceOrgId, input.invitedByUserId, summary.id, 'team_org_link_invited_by_org', {
      linkedOrgId: input.orgId,
      repTeamId: target.workspace.repTeamId,
      sharingLevel: 'basic',
    }),
    writePlatformEvent({
      eventType: 'team_org_link_invited',
      source: 'app',
      orgId: input.orgId,
      actorUserId: input.invitedByUserId,
      actorEmail: input.invitedByEmail ?? null,
      metadata: {
        teamWorkspaceId: target.workspace.id,
        workspaceOrgId: target.workspace.workspaceOrgId,
        repTeamId: target.workspace.repTeamId,
        linkId: summary.id,
        linkType: 'visibility',
        sharingLevel: 'basic',
      },
    }),
  ]);

  return { ok: true, link: summary, reusedExisting: false };
}

async function markWorkspaceLinked(teamWorkspaceId: string, now: string): Promise<void> {
  const workspaceResult = await supabaseAdmin
    .from('team_workspaces')
    .update({ workspace_state: 'linked', updated_at: now })
    .eq('id', teamWorkspaceId);
  if (workspaceResult.error) throw workspaceResult.error;

  const workspaceOrgId = await getWorkspaceOrgId(teamWorkspaceId);
  if (workspaceOrgId) {
    const orgResult = await supabaseAdmin
      .from('organizations')
      .update({ team_workspace_status: 'linked' })
      .eq('id', workspaceOrgId);
    if (orgResult.error) throw orgResult.error;
  }
}

export async function reviewTeamOrgLink(input: {
  orgId: string;
  linkId: string;
  action: 'approve' | 'decline';
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<ReviewTeamOrgLinkResult> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('id', input.linkId)
    .eq('linked_org_id', input.orgId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!existing) return { ok: false, status: 404, error: 'Team link request not found.' };

  const link = existing as TeamOrgLinkRow;
  if (input.action === 'approve' && link.status === 'linked') {
    const summary = await getTeamOrgLinkSummary(link.id);
    if (!summary) return { ok: false, status: 500, error: 'Link could not be loaded.' };
    return { ok: true, link: summary };
  }
  if (link.status === 'invited') {
    return { ok: false, status: 409, error: 'This Team link invitation is waiting for the Team coach to respond.' };
  }
  if (!ORG_REVIEWABLE_LINK_STATUSES.includes(link.status)) {
    return { ok: false, status: 409, error: 'This Team link request has already been reviewed.' };
  }

  const nextStatus: TeamOrgLinkStatus = input.action === 'approve' ? 'linked' : 'declined';
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('team_org_links')
    .update({
      status: nextStatus,
      approved_by_org_user_id: input.action === 'approve' ? input.actorUserId : null,
      updated_at: now,
    })
    .eq('id', input.linkId)
    .eq('linked_org_id', input.orgId)
    .select()
    .single();
  if (updateError) throw updateError;

  if (input.action === 'approve') {
    await markWorkspaceLinked(link.team_workspace_id, now);
  }

  const summary = (await mapLinkRows([updated as TeamOrgLinkRow]))[0];
  const auditAction = input.action === 'approve' ? 'team_org_link_approved' : 'team_org_link_declined';

  await Promise.all([
    writeOrgAudit(input.orgId, input.actorUserId, link.id, auditAction, {
      teamWorkspaceId: link.team_workspace_id,
      repTeamId: link.rep_team_id,
      linkType: link.link_type,
      sharingLevel: link.sharing_level,
      status: nextStatus,
    }),
    writePlatformEvent({
      eventType: input.action === 'approve' ? 'team_org_link_approved' : 'team_org_link_declined',
      source: 'app',
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      metadata: {
        teamWorkspaceId: link.team_workspace_id,
        repTeamId: link.rep_team_id,
        linkId: link.id,
        linkType: link.link_type,
        sharingLevel: link.sharing_level,
      },
    }),
  ]);

  return { ok: true, link: summary };
}

export async function respondToTeamOrgLinkInvitation(input: {
  workspace: TeamWorkspace;
  linkId: string;
  action: 'accept' | 'decline';
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<RespondTeamOrgLinkInvitationResult> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('id', input.linkId)
    .eq('team_workspace_id', input.workspace.id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!existing) return { ok: false, status: 404, error: 'Team link invitation not found.' };

  const link = existing as TeamOrgLinkRow;
  if (input.action === 'accept' && link.status === 'linked') {
    const summary = await getTeamOrgLinkSummary(link.id);
    if (!summary) return { ok: false, status: 500, error: 'Link could not be loaded.' };
    return { ok: true, link: summary };
  }
  if (!TEAM_REVIEWABLE_LINK_STATUSES.includes(link.status)) {
    return { ok: false, status: 409, error: 'This Team link invitation has already been reviewed.' };
  }

  const nextStatus: TeamOrgLinkStatus = input.action === 'accept' ? 'linked' : 'declined';
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('team_org_links')
    .update({
      status: nextStatus,
      approved_by_team_user_id: input.actorUserId,
      updated_at: now,
    })
    .eq('id', input.linkId)
    .eq('team_workspace_id', input.workspace.id)
    .select()
    .single();
  if (updateError) throw updateError;

  if (input.action === 'accept') {
    await markWorkspaceLinked(link.team_workspace_id, now);
  }

  const summary = (await mapLinkRows([updated as TeamOrgLinkRow]))[0];
  const auditAction = input.action === 'accept'
    ? 'team_org_link_invite_accepted_by_team'
    : 'team_org_link_invite_declined_by_team';

  await Promise.all([
    writeOrgAudit(input.workspace.workspaceOrgId, input.actorUserId, link.id, auditAction, {
      linkedOrgId: link.linked_org_id,
      repTeamId: link.rep_team_id,
      linkType: link.link_type,
      sharingLevel: link.sharing_level,
      status: nextStatus,
    }),
    writeOrgAudit(link.linked_org_id, input.actorUserId, link.id, auditAction, {
      teamWorkspaceId: link.team_workspace_id,
      workspaceOrgId: input.workspace.workspaceOrgId,
      repTeamId: link.rep_team_id,
      linkType: link.link_type,
      sharingLevel: link.sharing_level,
      status: nextStatus,
    }),
    writePlatformEvent({
      eventType: input.action === 'accept'
        ? 'team_org_link_invite_accepted'
        : 'team_org_link_invite_declined',
      source: 'app',
      orgId: input.workspace.workspaceOrgId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      metadata: {
        teamWorkspaceId: link.team_workspace_id,
        linkedOrgId: link.linked_org_id,
        repTeamId: link.rep_team_id,
        linkId: link.id,
        linkType: link.link_type,
        sharingLevel: link.sharing_level,
      },
    }),
  ]);

  return { ok: true, link: summary };
}

async function getWorkspaceOrgId(teamWorkspaceId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('workspace_org_id')
    .eq('id', teamWorkspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data?.workspace_org_id as string | undefined) ?? null;
}

async function writeOrgAudit(
  orgId: string,
  actorId: string,
  targetId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin.from('org_audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    target_id: targetId,
    action,
    payload,
  });
  if (error) {
    console.error('[team-org-links] audit write error:', error);
  }
}
