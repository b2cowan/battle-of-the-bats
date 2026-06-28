import {
  addRepTeamCoach,
  createOrganization,
  createOrganizationMember,
  createRepTeam,
  getOrCreateOrgLedger,
  getOrCreateRepTeamLedger,
} from './db';
import { writePlatformAuditLog } from './platform-audit';
import { writePlatformEvent, type PlatformEventInput } from './platform-events';
import { supabaseAdmin } from './supabase-admin';
import { findBasicCoachTeamIdForTournamentRegistration } from './basic-coach-teams';
import { migrateBasicTeamIntoWorkspace } from './coach-upgrade-migration';
import { DEFAULT_SPORT } from './sports';
import type {
  AccountingLedger,
  Organization,
  RepProgramYear,
  RepTeam,
  RepTeamCoach,
  SubscriptionStatus,
} from './types';
import type {
  TeamEntitlementSource,
  TeamEntitlementStatus,
  TeamWorkspaceBillingMode,
  TeamWorkspaceSource,
} from './team-workspace-entitlements';

type ProvisionSource = TeamWorkspaceSource;

export type ProvisionStandaloneTeamWorkspaceInput = {
  ownerUserId: string;
  ownerEmail?: string | null;
  teamName: string;
  teamSlug?: string | null;
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  sport?: string | null;
  division?: string | null;
  teamDescription?: string | null;
  teamColor?: string | null;
  seasonName?: string | null;
  seasonYear?: number | null;
  source?: ProvisionSource;
  sourceTournamentId?: string | null;
  sourceTournamentTeamId?: string | null;
  basicCoachTeamId?: string | null;
  billingMode?: TeamWorkspaceBillingMode;
  billingOwnerOrgId?: string | null;
  billingOwnerUserId?: string | null;
  subscriptionStatus?: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionItemId?: string | null;
  currentPeriodEnd?: string | null;
  entitlementSource?: TeamEntitlementSource;
  entitlementStatus?: TeamEntitlementStatus;
  eventSource?: PlatformEventInput['source'];
  sourceEventId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
};

export type ProvisionStandaloneTeamWorkspaceResult = {
  org: Organization;
  team: RepTeam;
  programYear: RepProgramYear;
  coachAssignment: RepTeamCoach;
  orgLedger: AccountingLedger;
  teamLedger: AccountingLedger;
  teamWorkspaceId: string;
  entitlementId: string;
};

export class TeamWorkspaceProvisioningError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeamWorkspaceProvisioningError';
    this.code = code;
  }
}

type RepProgramYearRow = {
  id: string;
  team_id: string;
  org_id: string;
  name: string;
  year: number;
  status: RepProgramYear['status'];
  tryout_open: boolean;
  tryout_description: string | null;
  budget_amount: number | string | null;
  auto_reminders_enabled: boolean | null;
  created_at: string;
  updated_at: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanRequiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TeamWorkspaceProvisioningError('missing_required_field', `${field} is required.`);
  }
  return trimmed;
}

function normalizeSeasonYear(value: number | null | undefined): number {
  const year = value ?? new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new TeamWorkspaceProvisioningError('invalid_season_year', 'Season year must be a valid four-digit year.');
  }
  return year;
}

function mapProgramYear(row: RepProgramYearRow): RepProgramYear {
  return {
    id: row.id,
    teamId: row.team_id,
    orgId: row.org_id,
    name: row.name,
    year: row.year,
    status: row.status,
    tryoutOpen: row.tryout_open,
    tryoutDescription: row.tryout_description,
    budgetAmount: row.budget_amount != null ? Number(row.budget_amount) : null,
    autoRemindersEnabled: row.auto_reminders_enabled ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveUniqueOrgSlug(baseValue: string): Promise<string> {
  const base = slugify(baseValue) || 'team-workspace';
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  throw new TeamWorkspaceProvisioningError('workspace_slug_unavailable', 'Could not find an available workspace URL.');
}

/** A unique-violation on organizations.slug. createOrganization rethrows as a plain Error (the PG
 *  `code` is lost), so match the constraint NAME in the message — narrow on purpose: a bare 23505
 *  code-match would over-match any other unique index on organizations. */
function isOrgSlugUniqueViolation(err: unknown): boolean {
  return (err as { message?: string } | null)?.message?.includes('organizations_slug_key') ?? false;
}

/**
 * resolveUniqueOrgSlug → createOrganization is a check-then-insert: a concurrent provisioner (the two
 * Stripe events for one checkout fire together) can claim the same slug between our SELECT and INSERT,
 * tripping organizations_slug_key with a 500. Retry on exactly that conflict with a freshly resolved
 * slug so the loser simply lands on `base-2`; the genuine duplicate is then caught downstream by the
 * team_workspaces.stripe_subscription_id guard (mig 156), which the webhook resolves to already_exists.
 * Bounded so a truly exhausted namespace still surfaces an error.
 */
async function createWorkspaceOrgWithUniqueSlug(workspaceName: string, slugBase: string): Promise<Organization> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = await resolveUniqueOrgSlug(slugBase);
    try {
      return await createOrganization(workspaceName, slug, 'team', {
        accountKind: 'team_workspace',
        teamWorkspaceStatus: 'active',
        isDiscoverable: false,
      });
    } catch (err) {
      if (!isOrgSlugUniqueViolation(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr ?? new TeamWorkspaceProvisioningError('workspace_slug_unavailable', 'Could not find an available workspace URL.');
}

async function resolveUniqueTeamSlug(orgId: string, baseValue: string): Promise<string> {
  const base = slugify(baseValue) || 'team';
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const { data, error } = await supabaseAdmin
      .from('rep_teams')
      .select('id')
      .eq('org_id', orgId)
      .eq('slug', candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  throw new TeamWorkspaceProvisioningError('team_slug_unavailable', 'Could not find an available team URL.');
}

async function createActiveProgramYear(fields: {
  orgId: string;
  teamId: string;
  name: string;
  year: number;
}): Promise<RepProgramYear> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .insert({
      org_id: fields.orgId,
      team_id: fields.teamId,
      name: fields.name,
      year: fields.year,
      status: 'active',
      tryout_open: false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapProgramYear(data as RepProgramYearRow);
}

async function rollbackWorkspaceOrg(orgId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', orgId);

  if (error) {
    console.error('[team-workspace-provisioning] rollback failed:', error);
  }
}

export async function provisionStandaloneTeamWorkspace(
  input: ProvisionStandaloneTeamWorkspaceInput,
): Promise<ProvisionStandaloneTeamWorkspaceResult> {
  const ownerUserId = cleanRequiredText(input.ownerUserId, 'Owner user');
  const teamName = cleanRequiredText(input.teamName, 'Team name');
  const workspaceName = cleanRequiredText(input.workspaceName ?? `${teamName} Coaches Portal`, 'Workspace name');
  const seasonYear = normalizeSeasonYear(input.seasonYear);
  const seasonName = cleanRequiredText(input.seasonName ?? `${teamName} ${seasonYear}`, 'Season name');
  const sport = cleanRequiredText(input.sport ?? DEFAULT_SPORT, 'Sport');
  const subscriptionStatus = input.subscriptionStatus ?? 'active';
  const source = input.source ?? 'direct_signup';
  const billingMode = input.billingMode ?? 'team_direct';
  const entitlementSource = input.entitlementSource ?? 'team_plan';
  const entitlementStatus = input.entitlementStatus ?? subscriptionStatus;
  const basicCoachTeamId = input.basicCoachTeamId !== undefined
    ? input.basicCoachTeamId
    : await findBasicCoachTeamIdForTournamentRegistration(input.sourceTournamentTeamId);

  let createdOrgId: string | null = null;

  try {
    const org = await createWorkspaceOrgWithUniqueSlug(workspaceName, input.workspaceSlug ?? workspaceName);
    createdOrgId = org.id;

    const orgPatch: Record<string, string | null> = {
      subscription_status: subscriptionStatus,
    };
    if (input.stripeCustomerId !== undefined) orgPatch.stripe_customer_id = input.stripeCustomerId;
    if (input.stripeSubscriptionId !== undefined) orgPatch.stripe_subscription_id = input.stripeSubscriptionId;
    if (input.currentPeriodEnd !== undefined) orgPatch.current_period_end = input.currentPeriodEnd;

    const { error: orgPatchError } = await supabaseAdmin
      .from('organizations')
      .update(orgPatch)
      .eq('id', org.id);
    if (orgPatchError) throw orgPatchError;
    const provisionedOrg: Organization = {
      ...org,
      subscriptionStatus,
      stripeCustomerId: input.stripeCustomerId ?? org.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId ?? org.stripeSubscriptionId,
      currentPeriodEnd: input.currentPeriodEnd ?? org.currentPeriodEnd,
    };

    await createOrganizationMember(provisionedOrg.id, ownerUserId, 'owner');

    const teamSlug = await resolveUniqueTeamSlug(provisionedOrg.id, input.teamSlug ?? teamName);
    const team = await createRepTeam(provisionedOrg.id, {
      name: teamName,
      slug: teamSlug,
      sport,
      division: input.division ?? null,
      description: input.teamDescription ?? null,
      color: input.teamColor ?? null,
    });

    const programYear = await createActiveProgramYear({
      orgId: provisionedOrg.id,
      teamId: team.id,
      name: seasonName,
      year: seasonYear,
    });

    const coachAssignment = await addRepTeamCoach(programYear.id, team.id, provisionedOrg.id, ownerUserId, 'head_coach');
    const orgLedger = await getOrCreateOrgLedger(provisionedOrg.id, provisionedOrg.name);
    const teamLedger = await getOrCreateRepTeamLedger(provisionedOrg.id, team.id, team.name);

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('team_workspaces')
      .insert({
        workspace_org_id: provisionedOrg.id,
        rep_team_id: team.id,
        active_program_year_id: programYear.id,
        primary_owner_user_id: ownerUserId,
        source,
        source_tournament_id: input.sourceTournamentId ?? null,
        source_tournament_team_id: input.sourceTournamentTeamId ?? null,
        basic_coach_team_id: basicCoachTeamId ?? null,
        workspace_state: 'independent',
        billing_mode: billingMode,
        billing_owner_org_id: input.billingOwnerOrgId ?? null,
        billing_owner_user_id: input.billingOwnerUserId ?? ownerUserId,
        stripe_customer_id: input.stripeCustomerId ?? null,
        stripe_subscription_id: input.stripeSubscriptionId ?? null,
        subscription_status: subscriptionStatus,
        current_period_end: input.currentPeriodEnd ?? null,
      })
      .select('id')
      .single();
    if (workspaceError) throw workspaceError;

    // Back-link the free team to its new paid workspace — as an ATOMIC, race-safe claim. The
    // `WHERE team_workspace_id IS NULL` makes exactly one provisioner win even if both Stripe events
    // (or a re-upgrade) race; the winner gets a returned row and owns the one-time data migration.
    let migrationClaimed = false;
    if (basicCoachTeamId) {
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('basic_coach_teams')
        .update({ team_workspace_id: workspace.id, updated_at: new Date().toISOString() })
        .eq('id', basicCoachTeamId)
        .is('team_workspace_id', null)
        .select('id');
      if (claimError) throw claimError;
      migrationClaimed = (claimed?.length ?? 0) > 0;
    }

    const { data: entitlement, error: entitlementError } = await supabaseAdmin
      .from('team_entitlements')
      .insert({
        team_workspace_id: workspace.id,
        org_id: provisionedOrg.id,
        rep_team_id: team.id,
        source: entitlementSource,
        status: entitlementStatus,
        stripe_subscription_item_id: input.stripeSubscriptionItemId ?? null,
      })
      .select('id')
      .single();
    if (entitlementError) throw entitlementError;

    await writePlatformEvent({
      eventType: 'team_workspace_created',
      source: input.eventSource ?? 'app',
      sourceEventId: input.sourceEventId ?? null,
      orgId: provisionedOrg.id,
      actorUserId: input.actorUserId ?? ownerUserId,
      actorEmail: input.actorEmail ?? input.ownerEmail ?? null,
      planId: 'team',
      subscriptionStatus,
      metadata: {
        teamWorkspaceId: workspace.id,
        repTeamId: team.id,
        programYearId: programYear.id,
        billingMode,
        source,
        entitlementSource,
      },
    });

    const auditEmail = input.actorEmail ?? input.ownerEmail;
    if (auditEmail) {
      await writePlatformAuditLog(
        auditEmail,
        provisionedOrg.id,
        'team_workspace_created',
        'team_workspace',
        null,
        {
          teamWorkspaceId: workspace.id,
          repTeamId: team.id,
          programYearId: programYear.id,
          billingMode,
          source,
        },
      );
    }

    createdOrgId = null;

    // Free→Premium data migration (Phase 4) — runs ONLY for the provisioner that won the atomic
    // claim above (so exactly once per upgraded team), and only AFTER provisioning is committed +
    // rollback is disarmed. Best-effort + per-entity resilient + never throws out of this path: a
    // migration hiccup must never fail the payment/provision. The honest "check these" summary is
    // stored on the workspace for the Premium portal to surface on first load.
    if (migrationClaimed && basicCoachTeamId) {
      try {
        const migrationSummary = await migrateBasicTeamIntoWorkspace({
          basicCoachTeamId,
          orgId: provisionedOrg.id,
          teamId: team.id,
          programYearId: programYear.id,
        });
        await supabaseAdmin
          .from('team_workspaces')
          .update({ migration_summary: migrationSummary })
          .eq('id', workspace.id);
      } catch (err) {
        console.error('[provisionStandaloneTeamWorkspace] free→premium data migration failed (non-fatal, workspace still provisioned):', err);
      }
    }

    return {
      org: provisionedOrg,
      team,
      programYear,
      coachAssignment,
      orgLedger,
      teamLedger,
      teamWorkspaceId: workspace.id as string,
      entitlementId: entitlement.id as string,
    };
  } catch (error) {
    if (createdOrgId) await rollbackWorkspaceOrg(createdOrgId);
    throw error;
  }
}
