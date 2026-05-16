import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import {
  buildDowngradePreflight,
  isLowerPlan,
  normalizePlan,
  retentionDeadline,
  writeOrgBillingAudit,
} from '@/lib/billing-retention';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ConfirmBody = {
  targetPlan?: unknown;
  keepTournamentIds?: unknown;
  reason?: unknown;
};

function normalizeKeepIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string'))];
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const body = await req.json().catch(() => ({})) as ConfirmBody;
  const targetPlan = normalizePlan(body.targetPlan);
  if (!targetPlan) {
    return Response.json({ error: 'Choose a valid target plan.' }, { status: 400 });
  }
  if (!isLowerPlan(ctx.org.planId, targetPlan)) {
    return Response.json({ error: 'You can only confirm a downgrade to a lower plan.' }, { status: 400 });
  }

  const preflight = await buildDowngradePreflight(ctx.org, targetPlan);
  const keepTournamentIds = normalizeKeepIds(body.keepTournamentIds);
  const knownIds = new Set(preflight.tournaments.map(t => t.id));

  if (preflight.requiresTournamentChoice) {
    if (keepTournamentIds.length !== preflight.allowedKeepCount) {
      return Response.json(
        { error: `Choose ${preflight.allowedKeepCount} tournament${preflight.allowedKeepCount === 1 ? '' : 's'} to keep active.` },
        { status: 400 },
      );
    }
    if (keepTournamentIds.some(id => !knownIds.has(id))) {
      return Response.json({ error: 'One selected tournament does not belong to this organization.' }, { status: 400 });
    }
  }

  const keepSet = new Set(keepTournamentIds);
  const retainedTournaments = preflight.requiresTournamentChoice
    ? preflight.tournaments.filter(t => !keepSet.has(t.id))
    : [];
  const retentionUntil = retentionDeadline();
  const targetCfg = PLAN_CONFIG[targetPlan];
  const actorEmail = ctx.user.email ?? null;
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : null;

  const { data: intent, error: intentError } = await supabaseAdmin
    .from('billing_retention_intents')
    .insert({
      org_id: ctx.org.id,
      intent_type: 'downgrade',
      status: 'applied',
      from_plan: ctx.org.planId,
      target_plan: targetPlan,
      keep_tournament_ids: keepTournamentIds,
      retention_until: retentionUntil,
      reason,
      created_by: ctx.user.id,
      created_by_email: actorEmail,
      applied_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (intentError) {
    return Response.json({ error: intentError.message }, { status: 500 });
  }

  if (retainedTournaments.length > 0) {
    const retainedIds = retainedTournaments.map(t => t.id);
    const { error: archiveError } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'archived', is_active: false })
      .eq('organization_id', ctx.org.id)
      .in('id', retainedIds);
    if (archiveError) return Response.json({ error: archiveError.message }, { status: 500 });

    const { error: recordError } = await supabaseAdmin
      .from('billing_retained_records')
      .insert(retainedTournaments.map(t => ({
        intent_id: intent.id,
        org_id: ctx.org.id,
        record_type: 'tournament',
        record_id: t.id,
        display_name: t.name,
        retained_state: 'retained_inactive',
        retention_until: retentionUntil,
        metadata: {
          previousStatus: t.status,
          slug: t.slug,
          year: t.year,
          startDate: t.startDate,
          endDate: t.endDate,
          retentionReason: 'plan_downgrade',
          fromPlan: ctx.org.planId,
          targetPlan,
        },
      })));
    if (recordError) return Response.json({ error: recordError.message }, { status: 500 });
  }

  const { error: orgError } = await supabaseAdmin
    .from('organizations')
    .update({
      plan_id: targetPlan,
      tournament_limit: targetCfg.tournamentLimit,
      subscription_status: 'active',
    })
    .eq('id', ctx.org.id);
  if (orgError) return Response.json({ error: orgError.message }, { status: 500 });

  await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_downgrade_confirmed', {
    fromPlan: ctx.org.planId,
    targetPlan,
    retainedTournamentIds: retainedTournaments.map(t => t.id),
    keepTournamentIds,
    retentionUntil,
  });

  return Response.json({
    ok: true,
    targetPlan,
    retainedCount: retainedTournaments.length,
    retentionUntil,
  });
}
