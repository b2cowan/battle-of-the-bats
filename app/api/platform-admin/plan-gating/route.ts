import { getPlatformAuthContext, requirePlatformPermission } from '@/lib/platform-auth';
import {
  recordCatalogChangeApplication,
  requireApprovedCatalogChangeRequest,
} from '@/lib/platform-catalog-approval';
import { sanitizePlatformChangeNote } from '@/lib/platform-change-note';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET = withObservability(async () => {
  const user = await getPlatformAuthContext();
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('plan_gating')
    .select('*')
    .order('plan_key');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return Response.json(data);
}, { route: '/api/platform-admin/plan-gating' });

export const POST = withObservability(async (req: Request) => {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const {
    planKey,
    gatingStatus,
    changeNote,
    approvedChangeRequestId,
  }: { planKey: string; gatingStatus: string; changeNote?: string; approvedChangeRequestId?: string } = await req.json();
  const sanitizedNote = sanitizePlatformChangeNote(changeNote);

  const validKeys = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];
  const validStatuses = ['live', 'early_access'];
  if (!validKeys.includes(planKey) || !validStatuses.includes(gatingStatus)) {
    return new Response(JSON.stringify({ error: 'Invalid planKey or gatingStatus' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const approval = await requireApprovedCatalogChangeRequest(approvedChangeRequestId, 'plan_gating');
  if (!approval.ok) return approval.response;

  const { data: current } = await supabaseAdmin
    .from('plan_gating')
    .select('*')
    .eq('plan_key', planKey)
    .maybeSingle();

  const updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('plan_gating')
    .update({
      gating_status: gatingStatus,
      updated_at: updatedAt,
      updated_by_email: auth.user.email,
      last_change_note: sanitizedNote,
    })
    .eq('plan_key', planKey);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_plan_gating',
    'gating_status',
    {
      planKey,
      gatingStatus: current?.gating_status ?? null,
      changeNote: current?.last_change_note ?? null,
      approvedChangeRequestId: approval.changeRequest.id,
    },
    { planKey, gatingStatus, changeNote: sanitizedNote, approvedChangeRequestId: approval.changeRequest.id },
  );

  await recordCatalogChangeApplication(
    approval.changeRequest.id,
    'plan_gating',
    planKey,
    auth.user.email!,
    { planKey, gatingStatus, changeNote: sanitizedNote },
  );

  return Response.json({
    ok: true,
    planKey,
    gatingStatus,
    updated_at: updatedAt,
    updated_by_email: auth.user.email,
    last_change_note: sanitizedNote,
    approved_change_request_id: approval.changeRequest.id,
  });
}, { route: '/api/platform-admin/plan-gating' });
