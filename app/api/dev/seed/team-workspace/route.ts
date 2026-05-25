import { NextResponse } from 'next/server';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { provisionStandaloneTeamWorkspace, TeamWorkspaceProvisioningError } from '@/lib/team-workspace-provisioning';

const DEV_TEAM_WORKSPACE_SLUG = 'dev-standalone-team';
const STANDALONE_OWNER_EMAIL  = 'standalone-owner@dev.local';
const DEV_PASSWORD             = 'devpass123';

async function findOrCreateSeedOwner() {
  const { data } = await supabaseAdmin.auth.admin.listUsers();

  // Prefer coach@dev.local if the User Set has been seeded
  const coach = data?.users.find(u => u.email?.toLowerCase() === 'coach@dev.local');
  if (coach) {
    return { userId: coach.id, email: coach.email ?? STANDALONE_OWNER_EMAIL, source: 'coach@dev.local' };
  }

  // Fall back to a dedicated synthetic owner — never use the real platform admin account
  let owner = data?.users.find(u => u.email?.toLowerCase() === STANDALONE_OWNER_EMAIL);
  if (!owner) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email:         STANDALONE_OWNER_EMAIL,
      password:      DEV_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create standalone owner: ${error.message}`);
    owner = created.user;
  }

  return { userId: owner.id, email: STANDALONE_OWNER_EMAIL, source: STANDALONE_OWNER_EMAIL };
}

export async function POST() {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const log: string[] = [];
  let owner: { userId: string; email: string; source: string };

  const { data: existingOrg, error: existingError } = await supabaseAdmin
    .from('organizations')
    .select('id, slug')
    .eq('slug', DEV_TEAM_WORKSPACE_SLUG)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingOrg) {
    const { data: workspace } = await supabaseAdmin
      .from('team_workspaces')
      .select('id, rep_team_id, active_program_year_id')
      .eq('workspace_org_id', existingOrg.id)
      .maybeSingle();

    log.push('Standalone Team workspace already exists - skipping');
    return NextResponse.json({
      ok: true,
      log,
      orgId: existingOrg.id,
      orgSlug: existingOrg.slug,
      coachesUrl: `/${existingOrg.slug}/coaches`,
      expectedAuthDestination: `/${existingOrg.slug}/coaches`,
      teamWorkspaceId: workspace?.id ?? null,
      repTeamId: workspace?.rep_team_id ?? null,
      programYearId: workspace?.active_program_year_id ?? null,
    });
  }

  try {
    owner = await findOrCreateSeedOwner();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, log }, { status: 500 });
  }
  log.push(owner.source === 'coach@dev.local'
    ? 'Using coach@dev.local as standalone Team owner'
    : `Using ${owner.source} as standalone Team owner (seed User Set to use coach@dev.local instead)`);

  try {
    const result = await provisionStandaloneTeamWorkspace({
      ownerUserId: owner.userId,
      ownerEmail: owner.email,
      workspaceName: 'Dev Standalone Team',
      workspaceSlug: DEV_TEAM_WORKSPACE_SLUG,
      teamName: 'Dev Standalone U13 Bats',
      teamSlug: 'dev-standalone-u13-bats',
      sport: 'softball',
      division: 'U13',
      seasonName: `${new Date().getFullYear()} Dev Standalone Season`,
      seasonYear: new Date().getFullYear(),
      source: 'platform_admin',
      billingMode: 'platform_override',
      entitlementSource: 'platform_override',
      eventSource: 'platform_admin',
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
    });

    log.push('Created lightweight Team workspace org');
    log.push('Created rep team, active season, head coach assignment, entitlement, and team ledger');

    return NextResponse.json({
      ok: true,
      log,
      orgId: result.org.id,
      orgSlug: result.org.slug,
      coachesUrl: `/${result.org.slug}/coaches`,
      expectedAuthDestination: `/${result.org.slug}/coaches`,
      teamWorkspaceId: result.teamWorkspaceId,
      repTeamId: result.team.id,
      programYearId: result.programYear.id,
      entitlementId: result.entitlementId,
      teamLedgerId: result.teamLedger.id,
    });
  } catch (error) {
    if (error instanceof TeamWorkspaceProvisioningError) {
      return NextResponse.json({ error: error.message, code: error.code, log }, { status: 400 });
    }

    console.error('[dev seed team workspace] error:', error);
    return NextResponse.json({ error: 'Failed to create standalone Team workspace.', log }, { status: 500 });
  }
}
