import { getPlatformAuthContext, requirePlatformPermission } from '@/lib/platform-auth';
import {
  recordCatalogChangeApplication,
  requireApprovedCatalogChangeRequest,
} from '@/lib/platform-catalog-approval';
import { sanitizePlatformChangeNote } from '@/lib/platform-change-note';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { getAllPlanConfigOverrideRows, upsertPlanConfigOverride } from '@/lib/plan-config-db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_PLANS = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];

export const GET = withObservability(async () => {
  const user = await getPlatformAuthContext();
  if (!user) return unauthorized();

  const rows = await getAllPlanConfigOverrideRows();
  return Response.json(rows);
}, { route: '/api/platform-admin/plan-config' });

export const PATCH = withObservability(async (req: Request) => {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const body = await req.json() as {
    plan_id: string;
    tournament_limit?: number | null;
    seat_limit?: number | null;
    trial_days?: number | null;
    change_note?: string | null;
    approved_change_request_id?: string | null;
  };

  const { plan_id, tournament_limit, seat_limit, trial_days } = body;
  const changeNote = sanitizePlatformChangeNote(body.change_note);

  if (!plan_id) return badRequest('Missing plan_id');
  if (!VALID_PLANS.includes(plan_id)) return badRequest('Invalid plan_id');

  const approval = await requireApprovedCatalogChangeRequest(body.approved_change_request_id, 'plan_config');
  if (!approval.ok) return approval.response;

  // Validate each numeric field: must be null, undefined, or a non-negative integer
  const numericFields = [
    ['tournament_limit', tournament_limit],
    ['seat_limit',       seat_limit],
    ['trial_days',       trial_days],
  ] as [string, unknown][];

  for (const [key, val] of numericFields) {
    if (val !== null && val !== undefined) {
      if (!Number.isInteger(val) || (val as number) < 0) {
        return badRequest(`${key} must be a non-negative integer or null`);
      }
    }
  }

  try {
    const { data: current } = await supabaseAdmin
      .from('plan_config_overrides')
      .select('*')
      .eq('plan_id', plan_id)
      .maybeSingle();

    await upsertPlanConfigOverride(
      plan_id,
      { tournament_limit, seat_limit, trial_days },
      auth.user.email,
      changeNote,
    );

    await writePlatformAuditLog(
      auth.user.email!,
      null,
      'update_plan_config_override',
      plan_id,
      current
        ? {
            tournament_limit: current.tournament_limit,
            seat_limit: current.seat_limit,
            trial_days: current.trial_days,
            change_note: current.last_change_note ?? null,
          }
        : null,
      { tournament_limit, seat_limit, trial_days, change_note: changeNote, approved_change_request_id: approval.changeRequest.id },
    );

    await recordCatalogChangeApplication(
      approval.changeRequest.id,
      'plan_config',
      plan_id,
      auth.user.email!,
      { tournament_limit, seat_limit, trial_days, change_note: changeNote },
    );
    return Response.json({
      ok: true,
      updated_at: new Date().toISOString(),
      updated_by_email: auth.user.email,
      last_change_note: changeNote,
      approved_change_request_id: approval.changeRequest.id,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}, { route: '/api/platform-admin/plan-config' });
