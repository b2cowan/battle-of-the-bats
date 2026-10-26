import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import {
  cleanupBasicCoachTeamsForUserDeletion,
  getBasicCoachTeamDeletionImpactForUser,
} from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';
import { personAuditValue, personForAction, readReason, reasonRequired } from '@/lib/platform-person-action';

/**
 * GET — free-coach deletion impact for the delete-confirmation window (informed consent). Unlike the
 * org Members removal (which preserves the account), a platform-admin delete is a DELIBERATE account
 * deletion, so it stays a hard delete — but the operator must see that the person runs a free Coaches
 * Portal and how many teams will be permanently destroyed before confirming.
 */
export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('delete_records');
  if (auth.response) return auth.response;

  const { id } = await params;
  const impact = await getBasicCoachTeamDeletionImpactForUser(id);
  return NextResponse.json(impact);
}, { route: '/api/platform-admin/users/[id]/delete' });

/**
 * DELETE — permanent, irreversible account deletion; super admin only (matches the club delete). Body
 * `{ reason, confirmEmail }`: the person's email typed to confirm, checked HERE against the account (Support console
 * Stage 2; it rode in the address before, which the error catcher keeps).
 */
export const DELETE = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('delete_records');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { confirmEmail?: string; reason?: string };
  const found = await personForAction(id);
  if (found.response) return found.response;
  const { person } = found;
  if ((body.confirmEmail ?? '').trim().toLowerCase() !== person.email) {
    return NextResponse.json({ error: 'Type the person’s email exactly to confirm.' }, { status: 400 });
  }
  const reason = readReason(body);
  if (!reason) return reasonRequired();

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
    return NextResponse.json({ error: error.message ?? 'The person could not be deleted.' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'delete_user', 'user_id', person.email,
    personAuditValue(person, cleanedTeamIds.length > 0 ? { cleanedBasicCoachTeams: cleanedTeamIds.length } : {}), { reason });
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/delete' });
