import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import {
  cleanupBasicCoachTeamsForUserDeletion,
  getBasicCoachTeamDeletionImpactForUser,
} from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';

/**
 * GET — free-coach deletion impact for the delete-confirmation modal (informed consent). Unlike the
 * org Members removal (which preserves the account), a platform-admin delete is a DELIBERATE account
 * deletion, so it stays a hard delete — but the operator must see that the person runs a free Coaches
 * Portal and how many teams will be permanently destroyed before confirming.
 */
export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const impact = await getBasicCoachTeamDeletionImpactForUser(id);
  return NextResponse.json(impact);
}, { route: '/api/platform-admin/users/[id]/delete' });

export const DELETE = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  // Permanent, irreversible account deletion → super_admin only (matches org delete).
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const url   = new URL(req.url);
  const email = url.searchParams.get('email') ?? id;

  // J5-012: before deleting the auth user (which CASCADE-strips their basic_coach_team_users rows),
  // delete any Basic coach team they were the SOLE active member of — otherwise it becomes an
  // orphan (zero members → unreachable + unclaimable). Best-effort: log but don't block the delete.
  let cleanedTeamIds: string[] = [];
  try {
    cleanedTeamIds = await cleanupBasicCoachTeamsForUserDeletion(id);
  } catch (e) {
    console.error('[platform-admin] basic-coach-team cleanup failed (continuing with user delete):', e);
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

  if (error) {
    console.error('[platform-admin] delete-user error:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to delete user' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'delete_user',
    'user_id',
    email,
    cleanedTeamIds.length > 0 ? { cleanedBasicCoachTeams: cleanedTeamIds.length } : null,
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/delete' });
